import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationFixture } from '../support/application-fixture.js'
import { normalizeReferenceRecord, normalizeTopicNotes } from '../../src/domain/leetcode-reference.js'
import { createMaterialsFence } from '../../src/application/leetcode-materials-fence.js'

const OFFICIAL = {
  slug: 'two-sum',
  number: '1',
  title: '两数之和',
  difficulty: 'easy',
  category: '哈希',
  tags: ['数组', '哈希表'],
  url: 'https://leetcode.cn/problems/two-sum/',
  statement: '给定一个整数数组 nums 和一个整数目标值 target，返回和为目标值的两个整数的下标。',
  examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', note: '因为 nums[0] + nums[1] == 9' }],
  constraints: ['2 <= nums.length <= 10^4', '只会存在一个有效答案'],
  idea: '边遍历边把见过的数存进哈希表，找 target - num。',
  mnemonic: '边走边查配对数',
  diagram: '需要的数 = target - num',
  code: 'class Solution:\n    def twoSum(self, nums, target):\n        pass',
  complexity: '时间复杂度 O(n)，空间复杂度 O(n)',
  sourceFile: 'Hot100_哈希题解.md',
  sourceAnchor: '## 1. 两数之和',
}

const HASH_TOPIC = {
  category: '哈希',
  core: '用空间换时间，快速判断某个值是否见过。',
  topics: [{ title: '什么时候该想到哈希', detail: '出现「是否存在」「找配对」时先想哈希。' }],
  pitfalls: ['顺序反了会把自己和自己配对'],
  sourceFile: 'Hot100_哈希题解.md',
}

async function fixtureWithLibrary(references = [OFFICIAL], topics = [HASH_TOPIC]) {
  const fixture = applicationFixture()
  await fixture.repository.saveReferenceLibrary({
    references: references.map((item) => normalizeReferenceRecord(item)),
    topics: topics.map((item) => normalizeTopicNotes(item)),
  })
  await fixture.application.createAtomicPractice('session-1', {
    mode: 'leetcode', config: { language: 'python', guidance: 'guided' },
  })
  return fixture
}

test('题解库按题目、关键词与专题读取', async () => {
  const fixture = await fixtureWithLibrary()
  const reference = await fixture.repository.findReference('two-sum')
  assert.equal(reference.title, '两数之和')
  assert.equal(reference.examples[0].output, '[0,1]')
  assert.equal(reference.sourceAnchor, '## 1. 两数之和')

  const byTitle = await fixture.repository.listReferences({ keyword: '两数' })
  assert.deepEqual(byTitle.map((item) => item.slug), ['two-sum'])
  const byCategory = await fixture.repository.listReferences({ category: '哈希' })
  assert.equal(byCategory.length, 1)
  assert.equal((await fixture.repository.listReferences({ category: '链表' })).length, 0)
  assert.equal((await fixture.repository.findReference('not-exist')), null)

  const stats = await fixture.repository.referenceStats()
  assert.deepEqual(stats, { total: 1, withNotes: 1, topics: 1 })
})

test('interview_notes read 给出官方题面与笔记参考', async () => {
  const fixture = await fixtureWithLibrary()
  const drawn = await fixture.application.drawAtomicLeetcode('session-1', { selection: { slug: 'two-sum' } })
  const result = await fixture.application.readAtomicReference('session-1', {})
  const brief = result.resource.data
  assert.equal(result.resource.kind, 'reference-brief')
  assert.equal(brief.problem.slug, 'two-sum')
  assert.equal(brief.problem.difficulty, 'easy')
  assert.equal(brief.official.examples[0].input, 'nums = [2,7,11,15], target = 9')
  assert.deepEqual(brief.official.constraints, ['2 <= nums.length <= 10^4', '只会存在一个有效答案'])
  assert.equal(brief.notes.mnemonic, '边走边查配对数')
  assert.match(brief.notes.idea, /边遍历边把见过的数/)
  assert.equal(brief.topic.core, '用空间换时间，快速判断某个值是否见过。')
  assert.equal(brief.topic.pitfalls[0], '顺序反了会把自己和自己配对')
  assert.equal(brief.source.file, 'Hot100_哈希题解.md')
  assert.match(brief.source.note, /官方题面是事实基线/)
  // 当前题 DTO 一起带上，模型不用再查一次会话
  assert.equal(brief.question.id, drawn.references.questionId)
  assert.equal(brief.question.hintTotal, 0)

  // 也可以直接按题号 / slug 取，不依赖会话
  const byNumber = await fixture.application.readAtomicReference('session-1', { number: '1' })
  assert.equal(byNumber.resource.data.problem.slug, 'two-sum')
})

test('题解库没有这道题时明确报错，不静默降级', async () => {
  const fixture = await fixtureWithLibrary()
  await fixture.application.drawAtomicLeetcode('session-1', { selection: { slug: 'permutations' } })
  await assert.rejects(fixture.application.readAtomicReference('session-1', {}), /题解库里没有这道题/)
})

test('保存材料时官方示例与数据范围覆盖模型版本并标注来源', async () => {
  const fixture = await fixtureWithLibrary()
  const drawn = await fixture.application.drawAtomicLeetcode('session-1', { selection: { slug: 'two-sum' } })
  const saved = await fixture.application.saveAtomicMaterials('session-1', {
    questionId: drawn.references.questionId,
    materials: {
      statement: '在数组里找两个数，它们的和等于目标值（自己的复述）。',
      examples: [{ input: '模型写错的示例', output: '999' }],
      constraints: ['模型写错的范围'],
      hints: ['先想暴力解法', '再用哈希表'],
      knowledge: [{ title: '哈希表', detail: '平均 O(1) 查询。' }],
      pitfalls: ['别把自己和自己配对'],
      related: [{ id: '167', title: '两数之和 II', slug: 'two-sum-ii-input-array-is-sorted' }],
    },
  })
  const materials = saved.resource.data.materials
  // 事实层：示例与数据范围以官方为准
  assert.deepEqual(materials.examples, OFFICIAL.examples)
  assert.deepEqual(materials.constraints, OFFICIAL.constraints)
  // 表达层：仍然是模型写的
  assert.match(materials.statement, /自己的复述/)
  assert.equal(materials.hints.length, 2)
  assert.equal(materials.knowledge[0].title, '哈希表')
  // 来源可追溯
  assert.equal(materials.source.official, true)
  assert.equal(materials.source.file, 'Hot100_哈希题解.md')
  assert.equal(materials.source.anchor, '## 1. 两数之和')
  assert.equal(materials.source.kind, 'model')
})

test('题解库里没有的题只保存模型材料，不硬塞来源', async () => {
  const fixture = await fixtureWithLibrary()
  const drawn = await fixture.application.drawAtomicLeetcode('session-1', { selection: { slug: 'permutations' } })
  const saved = await fixture.application.saveAtomicMaterials('session-1', {
    questionId: drawn.references.questionId,
    materials: { statement: '全排列的题意复述', examples: [{ input: 'nums = [1,2,3]', output: '六种排列' }] },
  })
  const materials = saved.resource.data.materials
  assert.equal(materials.examples[0].input, 'nums = [1,2,3]')
  assert.equal(materials.source, null)
})

test('点名题解库里的题时用官方元数据补齐自定义题目', async () => {
  const fixture = await fixtureWithLibrary([
    OFFICIAL,
    {
      slug: 'valid-anagram', number: '242', title: '有效的字母异位词', difficulty: 'easy', category: '哈希',
      url: 'https://leetcode.cn/problems/valid-anagram/', statement: '判断两个字符串是否互为字母异位词。',
      sourceFile: 'Hot100_哈希题解.md', sourceAnchor: '## 242. 有效的字母异位词',
    },
  ])
  // 242 不在热题 100 里：以前只会得到「自定义题目、难度未知」
  const drawn = await fixture.application.drawAtomicLeetcode('session-1', { selection: { slug: 'valid-anagram' } })
  const problem = drawn.resource.data.leetcode
  assert.equal(problem.custom, true)
  assert.equal(problem.id, '242')
  assert.equal(problem.title, '有效的字母异位词')
  assert.equal(problem.difficulty, 'easy')
  assert.equal(problem.category, '哈希')
  assert.equal(problem.url, 'https://leetcode.cn/problems/valid-anagram/')
})

test('材料围栏带上来源说明', async () => {
  const fixture = await fixtureWithLibrary()
  const drawn = await fixture.application.drawAtomicLeetcode('session-1', { selection: { slug: 'two-sum' } })
  const saved = await fixture.application.saveAtomicMaterials('session-1', {
    questionId: drawn.references.questionId,
    materials: { statement: '自己写的题意', hints: ['先想暴力', '再想哈希'] },
  })
  const fence = createMaterialsFence(
    { ...drawn.resource.data, materials: saved.resource.data.materials, hintLevel: 0 },
    { guidance: 'guided' },
  )
  const spec = JSON.parse(fence.split('\n').slice(1, -1).join('\n'))
  const captions = spec.items.filter((item) => item.type === 'text' && item.size === 'caption').map((item) => item.content)
  assert.ok(captions.some((line) => line.includes('示例与数据范围取自官方题面')))
  assert.ok(captions.some((line) => line.includes('Hot100_哈希题解.md · 1. 两数之和')))
  assert.ok(captions.some((line) => line.includes('已按需重写')))
})

test('题解库检索与专题列表可供模型取证', async () => {
  const fixture = await fixtureWithLibrary()
  const search = await fixture.application.searchAtomicReferences({ keyword: '两数' })
  assert.equal(search.resource.kind, 'reference-search')
  assert.equal(search.resource.data.total, 1)
  assert.equal(search.resource.data.problems[0].hasOfficialStatement, true)
  assert.ok(search.resource.data.categories.includes('哈希'))

  const topic = await fixture.application.readAtomicTopicNotes('哈希')
  assert.equal(topic.resource.data.core, '用空间换时间，快速判断某个值是否见过。')
  assert.equal(topic.resource.data.topics[0].title, '什么时候该想到哈希')
  assert.ok(topic.resource.data.related.some((item) => item.slug === 'two-sum'))
  await assert.rejects(fixture.application.readAtomicTopicNotes('链表'), /没有「链表」的前置知识/)

  const list = await fixture.application.listAtomicTopics()
  assert.deepEqual(list.resource.data.topics.map((item) => item.category), ['哈希'])
})
