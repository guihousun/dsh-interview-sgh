import assert from 'node:assert/strict'
import test from 'node:test'
import { createAtomicToolDefinitions } from '../../src/adapters/dsh/atomic-tool-definitions.js'
import { createPresentationToolDefinitions } from '../../src/adapters/dsh/presentation-tool-definitions.js'
import { toolNamesForMode } from '../../src/adapters/dsh/mode-tool-catalog.js'
import { instructionFor } from '../../src/adapters/dsh/agent-event-bridge.js'
import { applicationFixture } from '../support/application-fixture.js'

function fixture() {
  const base = applicationFixture()
  const exec = { agent: { session: { header: { id: 'session-1' } } } }
  return {
    ...base,
    exec,
    tools: Object.fromEntries(createAtomicToolDefinitions(base.application).map((tool) => [tool.name, tool])),
    presentation: Object.fromEntries(createPresentationToolDefinitions(base.application).map((tool) => [tool.name, tool])),
  }
}

async function leetcodePractice(context, guidance = 'guided') {
  const practice = await context.application.createAtomicPractice('session-1', {
    mode: 'leetcode', config: { language: 'cpp', guidance },
  })
  return practice.resource.data.id
}

test('力扣题库工具支持搜索、指定题目与按条件抽题', async () => {
  const context = fixture()
  const created = await context.tools.interview_practice.execute({
    operation: 'create', mode: 'leetcode', language: 'cpp', guidance: 'guided',
  }, context.exec)
  assert.match(created.instruction, /当前练习已激活/)
  assert.match(created.instruction, /引导模式/)
  assert.match(created.instruction, /materialsFence/)

  const search = await context.tools.interview_leetcode.execute({ operation: 'search', keyword: '两数之和' }, context.exec)
  assert.equal(search.resource.kind, 'leetcode-search')
  assert.equal(search.resource.data.problems[0].slug, 'two-sum')

  const specified = await context.tools.interview_leetcode.execute({
    operation: 'draw', number: '33', title: '搜索旋转排序数组',
  }, context.exec)
  assert.equal(specified.resource.data.leetcode.slug, 'search-in-rotated-sorted-array')

  const custom = await context.tools.interview_leetcode.execute({
    operation: 'draw_next', title: '用两个栈实现队列', number: '剑指 Offer 09',
  }, context.exec)
  assert.equal(custom.resource.data.leetcode.custom, true)

  const catalog = await context.tools.interview_leetcode.execute({ operation: 'catalog' }, context.exec)
  assert.ok(catalog.resource.data.categories.includes('动态规划'))
  assert.deepEqual(
    context.tools.interview_leetcode.parameters.properties.operation.enum,
    ['catalog', 'search', 'draw', 'draw_next', 'set_completion'],
  )
})

test('题目材料工具保存材料并返回可原样输出的围栏', async () => {
  const context = fixture()
  await leetcodePractice(context)
  const drawn = await context.tools.interview_leetcode.execute({ operation: 'draw', slug: 'two-sum' }, context.exec)
  const questionId = drawn.references.questionId

  const saved = await context.tools.interview_materials.execute({
    operation: 'create',
    question_id: questionId,
    statement: '在数组中找到两个数，使它们的和等于目标值。',
    examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]' }],
    constraints: ['2 <= nums.length <= 10^4'],
    hints: ['暴力枚举是 O(n^2)', '用哈希表换空间', '边遍历边查补数'],
    knowledge: [{ title: '哈希表', detail: '平均 O(1) 查找。' }],
    pitfalls: ['同一个元素不能使用两次'],
    related: [{ id: '167', title: '两数之和 II', slug: 'two-sum-ii-input-array-is-sorted' }],
  }, context.exec)
  assert.equal(saved.resource.data.materials.hints.length, 3)
  assert.equal(saved.resource.data.hintLevel, 0)

  const shown = await context.presentation.interview_show_question.execute({
    practice_id: drawn.references.practiceId, question_id: questionId,
  }, context.exec)
  assert.equal(shown.artifact.kind, 'question')
  assert.match(shown.materialsFence, /^```dsh-ui\n/)
  assert.match(shown.materialsFence, /```$/)
  assert.match(shown.assistantInstruction, /materialsFence/)
  assert.doesNotMatch(shown.assistantInstruction, /必须且只能是/)
  const spec = JSON.parse(shown.materialsFence.split('\n').slice(1, -1).join('\n'))
  assert.equal(spec.items[0].items.at(-1).label, '引导模式')
  assert.equal(shown.resource.data.materials.hints[0], '暴力枚举是 O(n^2)')

  // 重复 create 会被领域层拒绝，必须使用 replace。
  await assert.rejects(
    context.tools.interview_materials.execute({
      operation: 'create', question_id: questionId, statement: '重复材料',
    }, context.exec),
    /已经存在题目材料/,
  )
  const replaced = await context.tools.interview_materials.execute({
    operation: 'replace', question_id: questionId, statement: '重写后的题意',
  }, context.exec)
  assert.equal(replaced.resource.data.materials.statement, '重写后的题意')
})

test('没有材料的力扣题先被要求生成材料再展示', async () => {
  const context = fixture()
  await leetcodePractice(context, 'standard')
  const drawn = await context.tools.interview_leetcode.execute({ operation: 'draw', slug: 'two-sum' }, context.exec)
  const shown = await context.presentation.interview_show_question.execute({
    practice_id: drawn.references.practiceId, question_id: drawn.references.questionId,
  }, context.exec)
  assert.equal(shown.materialsFence, undefined)
  assert.match(shown.assistantInstruction, /interview_materials create/)
})

test('只有刷力扣模式披露力扣题库与材料工具', () => {
  const leetcode = toolNamesForMode('leetcode')
  assert.ok(leetcode.includes('interview_leetcode'))
  assert.ok(leetcode.includes('interview_materials'))
  for (const mode of ['bagu', 'mock', 'resume_drill', 'scenario', null]) {
    const names = toolNamesForMode(mode)
    assert.equal(names.includes('interview_materials'), false)
    assert.equal(names.includes('interview_leetcode'), false)
  }
})

test('一次性请求按引导强度注入力扣材料与展示规则', () => {
  const guided = instructionFor({
    type: 'leetcode.present', practiceId: 'practice-1', questionId: 'question-1', mode: 'leetcode',
    guidance: 'guided', includeModeContext: true,
  })
  assert.match(guided, /interview_materials create/)
  assert.match(guided, /materialsFence/)
  assert.match(guided, /引导模式/)
  const materials = instructionFor({
    type: 'materials.generate', practiceId: 'practice-1', questionId: 'question-1', mode: 'leetcode',
  })
  assert.match(materials, /interview_practice read/)
  assert.match(materials, /interview_materials/)
  assert.match(materials, /materialsFence/)
})
