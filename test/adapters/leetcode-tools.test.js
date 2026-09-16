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

test('题解库工具支持取证、检索与专题前置知识', async () => {
  const context = fixture()
  await context.repository.saveReferenceLibrary({
    references: [{
      slug: 'two-sum', number: '1', title: '两数之和', difficulty: 'easy', category: '哈希',
      url: 'https://leetcode.cn/problems/two-sum/', statement: '官方题意：返回和为目标值的两个下标。',
      examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', note: '' }],
      constraints: ['2 <= nums.length <= 10^4'],
      idea: '边遍历边查补数。', mnemonic: '边走边查配对数', code: 'def solve(): pass',
      sourceFile: 'Hot100_哈希题解.md', sourceAnchor: '## 1. 两数之和',
    }],
    topics: [{
      category: '哈希', core: '用空间换时间。',
      topics: [{ title: '什么时候该想到哈希', detail: '出现「找配对」时。' }],
      pitfalls: ['先放后查会自己配自己'], sourceFile: 'Hot100_哈希题解.md',
    }],
  })
  await context.tools.interview_practice.execute({
    operation: 'create', mode: 'leetcode', language: 'python', guidance: 'guided',
  }, context.exec)
  const drawn = await context.tools.interview_leetcode.execute({ operation: 'draw', slug: 'two-sum' }, context.exec)

  const read = await context.tools.interview_notes.execute({ operation: 'read' }, context.exec)
  assert.equal(read.resource.kind, 'reference-brief')
  assert.equal(read.resource.data.official.statement, '官方题意：返回和为目标值的两个下标。')
  assert.equal(read.resource.data.official.examples[0].output, '[0,1]')
  assert.equal(read.resource.data.notes.mnemonic, '边走边查配对数')
  assert.match(read.resource.data.source.note, /官方题面是事实基线/)
  assert.equal(read.resource.data.question.id, drawn.references.questionId)

  const search = await context.tools.interview_notes.execute({ operation: 'search', keyword: '两数' }, context.exec)
  assert.equal(search.resource.data.problems[0].slug, 'two-sum')
  const topics = await context.tools.interview_notes.execute({ operation: 'topics', category: '哈希' }, context.exec)
  assert.equal(topics.resource.data.topics[0].title, '什么时候该想到哈希')
  const list = await context.tools.interview_notes.execute({ operation: 'topic_list' }, context.exec)
  assert.deepEqual(list.resource.data.topics.map((item) => item.category), ['哈希'])

  // 材料保存时官方示例覆盖模型版本
  await context.tools.interview_materials.execute({
    operation: 'create',
    question_id: drawn.references.questionId,
    statement: '自己的题意复述',
    examples: [{ input: '模型写错', output: 'x' }],
    constraints: ['模型写错'],
  }, context.exec)
  const saved = await context.tools.interview_materials.execute({
    operation: 'replace',
    question_id: drawn.references.questionId,
    statement: '自己的题意复述（重写）',
    examples: [{ input: '模型又写错', output: 'y' }],
  }, context.exec)
  assert.equal(saved.resource.data.materials.examples[0].input, 'nums = [2,7,11,15], target = 9')
  assert.deepEqual(saved.resource.data.materials.constraints, ['2 <= nums.length <= 10^4'])
  assert.equal(saved.resource.data.materials.source.file, 'Hot100_哈希题解.md')
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
