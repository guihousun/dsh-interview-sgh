import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationFixture } from '../support/application-fixture.js'
import { createMaterialsFence, createMaterialsSpec } from '../../src/application/leetcode-materials-fence.js'

async function leetcodeSession(guidance = 'guided') {
  const fixture = applicationFixture()
  await fixture.application.createAtomicPractice('session-1', {
    mode: 'leetcode', config: { language: 'cpp', guidance },
  })
  return fixture
}

test('自由选题可以指定题目、按难度抽题并搜索题库', async () => {
  const fixture = await leetcodeSession()

  const specified = await fixture.application.drawAtomicLeetcode('session-1', { selection: { slug: 'two-sum' } })
  assert.equal(specified.resource.data.leetcode.slug, 'two-sum')
  assert.equal(specified.resource.data.leetcode.custom, undefined)

  const harder = await fixture.application.drawNextAtomicLeetcode('session-1', { filters: { difficulty: 'hard' } })
  assert.equal(harder.resource.data.leetcode.difficulty, 'hard')
  assert.notEqual(harder.resource.data.leetcode.slug, 'two-sum')

  const custom = await fixture.application.drawNextAtomicLeetcode('session-1', {
    selection: { number: '剑指 Offer 09', title: '用两个栈实现队列' },
  })
  assert.equal(custom.resource.data.leetcode.custom, true)
  assert.equal(custom.resource.data.leetcode.title, '用两个栈实现队列')

  const search = await fixture.application.searchLeetcodeProblems({ keyword: '二分' })
  assert.equal(search.resource.kind, 'leetcode-search')
  assert.ok(search.resource.data.problems.some((problem) => problem.slug === 'binary-search' || problem.category === '二分查找'))
  assert.ok(search.resource.data.categories.includes('动态规划'))

  await assert.rejects(
    fixture.application.drawNextAtomicLeetcode('session-1', { filters: { category: '不存在的题型' } }),
    /没有符合条件的力扣题目/,
  )
})

test('题库目录暴露题型与难度分组，供工作台筛选', async () => {
  const fixture = applicationFixture()
  const catalog = (await fixture.application.getLeetcodeCatalog()).resource.data
  assert.equal(catalog.total, 100)
  assert.ok(catalog.categories.includes('动态规划'))
  assert.deepEqual(catalog.difficulties.map((item) => item.id), ['easy', 'medium', 'hard'])
  assert.deepEqual(catalog.difficulties.map((item) => item.label), ['简单', '中等', '困难'])
  assert.ok(catalog.groups.every((group) => group.problems.every((problem) => problem.completed === false)))
})

test('题目材料与提示阶梯通过应用层保存并回读', async () => {
  const fixture = await leetcodeSession()
  const drawn = await fixture.application.drawAtomicLeetcode('session-1', { selection: { slug: 'two-sum' } })
  const questionId = drawn.references.questionId

  const saved = await fixture.application.saveAtomicMaterials('session-1', {
    questionId,
    materials: {
      statement: '在数组中找到两个数，使它们的和等于目标值。',
      examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]' }],
      constraints: ['2 <= nums.length <= 10^4'],
      hints: ['暴力枚举是 O(n^2)', '用哈希表换空间', '边遍历边查补数'],
      knowledge: [{ title: '哈希表', detail: '平均 O(1) 查找，用空间换时间。' }],
      pitfalls: ['同一个元素不能使用两次'],
      related: [{ id: '167', title: '两数之和 II', slug: 'two-sum-ii-input-array-is-sorted' }],
    },
  })
  const question = saved.resource.data
  assert.equal(question.materials.hints.length, 3)
  assert.equal(question.hintLevel, 0)
  assert.equal(question.hintTotal, 3)
  assert.equal(question.capabilities.allowHints, true)
  assert.equal(question.capabilities.allowMaterials, true)

  const hinted = await fixture.application.revealAtomicHint('session-1', questionId)
  assert.equal(hinted.resource.data.hintLevel, 1)
  const session = (await fixture.application.readAtomicSession('session-1')).resource.data
  assert.equal(session.currentQuestion.materials.knowledge[0].title, '哈希表')

  await fixture.application.revealAtomicHint('session-1', questionId)
  await fixture.application.revealAtomicHint('session-1', questionId)
  await assert.rejects(fixture.application.revealAtomicHint('session-1', questionId), /提示都已经给出/)
})

test('材料围栏是可渲染的 dsh-ui 规格并区分引导强度', async () => {
  const fixture = await leetcodeSession()
  const drawn = await fixture.application.drawAtomicLeetcode('session-1', { selection: { slug: 'two-sum' } })
  await fixture.application.saveAtomicMaterials('session-1', {
    questionId: drawn.references.questionId,
    materials: {
      statement: '在数组中找到两个数，使它们的和等于目标值。',
      examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', note: '返回下标' }],
      constraints: ['2 <= nums.length <= 10^4'],
      hints: ['暴力枚举是 O(n^2)', '用哈希表换空间'],
      knowledge: [{ title: '哈希表', detail: '平均 O(1) 查找。' }],
      pitfalls: ['同一个元素不能使用两次'],
      related: [{ id: '167', title: '两数之和 II', slug: 'two-sum-ii-input-array-is-sorted' }],
    },
  })
  const question = (await fixture.application.readAtomicSession('session-1')).resource.data.currentQuestion

  const fence = createMaterialsFence(question, { guidance: 'guided' })
  const lines = fence.split('\n')
  assert.equal(lines[0], '```dsh-ui')
  assert.equal(lines.at(-1), '```')
  const spec = JSON.parse(lines.slice(1, -1).join('\n'))
  assert.equal(spec.items[0].type, 'row')
  const types = spec.items.map((item) => item.type)
  assert.ok(types.includes('text'))
  assert.ok(types.includes('table'))
  assert.ok(types.includes('list'))
  assert.ok(types.includes('callout'))
  assert.ok(types.includes('accordion'))
  assert.ok(types.includes('keyvalue'))
  assert.equal(spec.items[0].items.at(-1).label, '引导模式')
  assert.match(spec.title, /1\. 两数之和/)
  const exampleTable = spec.items.find((item) => item.type === 'table')
  assert.deepEqual(exampleTable.columns, ['输入', '输出', '说明'])
  assert.equal(spec.items.find((item) => item.type === 'accordion').items.length, 2)

  const standard = createMaterialsSpec(question, { guidance: 'standard' })
  assert.equal(standard.items[0].items.at(-1).label, '标准模式')
  assert.equal(createMaterialsSpec({ leetcode: { title: 'x' } }, { guidance: 'guided' }), null)
  assert.equal(createMaterialsFence({ leetcode: { title: 'x' } }), '')
})
