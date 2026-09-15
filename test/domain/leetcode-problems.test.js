import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LEETCODE_CATEGORIES, customLeetcodeProblem, listLeetcodeProblems, resolveLeetcodeProblem,
} from '../../src/domain/leetcode-problems.js'
import { LEETCODE_GUIDANCE_IDS, effectiveLeetcodeGuidance, leetcodeGuidanceLabel } from '../../src/domain/leetcode-guidance.js'
import { normalizeLeetcodeMaterials } from '../../src/domain/leetcode-materials.js'
import { DomainError } from '../../src/domain/errors.js'
import { askQuestion, createPractice, revealHint, saveMaterials } from '../../src/domain/practice.js'

function leetcodePractice(config = {}) {
  return createPractice({
    id: 'leetcode-1', mode: 'leetcode', config: { language: 'cpp', guidance: 'guided', ...config }, now: 1,
  })
}

function practiceWithQuestion() {
  return askQuestion(leetcodePractice(), {
    id: 'question-1', prompt: '33. 搜索旋转排序数组', leetcode: { slug: 'search-in-rotated-sorted-array' }, now: 2,
  }).practice
}

test('刷力扣必须显式选择引导强度', () => {
  assert.deepEqual(LEETCODE_GUIDANCE_IDS, ['guided', 'standard'])
  assert.throws(() => createPractice({ id: 'p', mode: 'leetcode', config: { language: 'cpp' }, now: 1 }), {
    code: 'LEETCODE_GUIDANCE_REQUIRED',
  })
  assert.throws(() => createPractice({ id: 'p', mode: 'leetcode', config: { language: 'cpp', guidance: 'expert' }, now: 1 }), {
    code: 'INVALID_LEETCODE_GUIDANCE',
  })
  assert.deepEqual(leetcodePractice().config, { language: 'cpp', guidance: 'guided' })
  assert.equal(leetcodeGuidanceLabel('guided'), '引导模式')
  // 历史练习只保存了 language，读取时按标准模式处理。
  assert.equal(effectiveLeetcodeGuidance({ language: 'cpp' }), 'standard')
  assert.equal(effectiveLeetcodeGuidance({ language: 'cpp', guidance: 'guided' }), 'guided')
})

test('题库支持按关键字、难度和题型筛选', () => {
  const byNumber = listLeetcodeProblems({ keyword: '33' })
  assert.equal(byNumber[0].slug, 'search-in-rotated-sorted-array')

  const byTitle = listLeetcodeProblems({ keyword: '最长递增子序列' })
  assert.deepEqual(byTitle.map((problem) => problem.slug), ['longest-increasing-subsequence'])

  const hard = listLeetcodeProblems({ difficulty: 'hard' })
  assert.ok(hard.length > 0)
  assert.ok(hard.every((problem) => problem.difficulty === 'hard'))

  const dp = listLeetcodeProblems({ category: '动态规划' })
  assert.ok(dp.every((problem) => problem.category === '动态规划'))

  const combined = listLeetcodeProblems({ category: '动态规划', difficulty: '简单' })
  assert.deepEqual(combined.map((problem) => problem.slug), ['climbing-stairs', 'pascals-triangle'])

  assert.equal(listLeetcodeProblems({ keyword: '33' }).length, 1)
  assert.equal(listLeetcodeProblems({ keyword: '不存在的题' }).length, 0)
  assert.ok(LEETCODE_CATEGORIES.includes('动态规划'))
})

test('自由选题支持题库内题号题名与热题 100 之外的自定义题目', () => {
  assert.equal(resolveLeetcodeProblem({ slug: 'two-sum' }).id, '1')
  assert.equal(resolveLeetcodeProblem({ number: '33' }).slug, 'search-in-rotated-sorted-array')
  assert.equal(resolveLeetcodeProblem({ title: '两数之和' }).slug, 'two-sum')
  assert.equal(resolveLeetcodeProblem({ number: '33', title: '搜索旋转排序数组' }).slug, 'search-in-rotated-sorted-array')
  assert.equal(resolveLeetcodeProblem({}), null)

  const custom = resolveLeetcodeProblem({ number: '剑指 Offer 09', title: '用两个栈实现队列' })
  assert.equal(custom.custom, true)
  assert.equal(custom.category, '自定义题目')
  assert.equal(custom.difficulty, '')
  assert.match(custom.url, /^https:\/\/leetcode\.cn\/problemset\/\?search=/)

  const bySlug = customLeetcodeProblem({ title: '用两个栈实现队列', slug: 'yong-liang-ge-zhan-shi-xian-dui-lie-lcof' })
  assert.equal(bySlug.url, 'https://leetcode.cn/problems/yong-liang-ge-zhan-shi-xian-dui-lie-lcof/')
  assert.throws(() => customLeetcodeProblem({}), { code: 'LEETCODE_PROBLEM_REQUIRED' })
})

test('自定义题目按原样保存元数据并参与刷题汇总', () => {
  const practice = createPractice({ id: 'p', mode: 'leetcode', config: { language: 'python', guidance: 'standard' }, now: 1 })
  const asked = askQuestion(practice, {
    id: 'q', prompt: '剑指 Offer 09. 用两个栈实现队列',
    leetcode: { number: '剑指 Offer 09', title: '用两个栈实现队列', custom: true }, now: 2,
  })
  assert.equal(asked.question.leetcode.custom, true)
  assert.equal(asked.practice.topic, '用两个栈实现队列')
  assert.match(asked.practice.source.content, /problemset\/\?search=/)
})

test('题目材料按上限规范化并保留题意、示例、提示与前置知识', () => {
  const materials = normalizeLeetcodeMaterials({
    statement: '  给定旋转后的升序数组，返回目标值的下标。  ',
    examples: [
      { input: 'nums = [4,5,6,7,0,1,2], target = 0', output: '4' },
      { input: 'nums = [4,5,6,7,0,1,2], target = 3', output: '-1', note: '不存在时返回 -1' },
      { input: 'x', output: 'y' }, { input: 'x', output: 'y' }, { input: '超出上限', output: 'y' },
    ],
    constraints: ['1 <= nums.length <= 5000', '', 'nums 中的每个值都独一无二'],
    hints: ['先想有序数组怎么做', '二分时总有一半是有序的', '判断 target 是否落在有序那一半', '再处理另一半', '第五条会被丢弃'],
    knowledge: [{ title: '二分查找', detail: '每次排除一半区间，时间 O(log n)。' }],
    pitfalls: ['直接对整个数组二分会错过旋转点'],
    related: [{ id: '153', title: '寻找旋转排序数组中的最小值', slug: 'find-minimum-in-rotated-sorted-array' }],
    extra: 'ignored',
  })
  assert.equal(materials.statement, '给定旋转后的升序数组，返回目标值的下标。')
  assert.equal(materials.examples.length, 4)
  assert.equal(materials.examples[1].note, '不存在时返回 -1')
  assert.deepEqual(materials.constraints, ['1 <= nums.length <= 5000', 'nums 中的每个值都独一无二'])
  assert.equal(materials.hints.length, 4)
  assert.equal(materials.knowledge[0].title, '二分查找')
  assert.equal(materials.related[0].url, 'https://leetcode.cn/problems/find-minimum-in-rotated-sorted-array/')
  assert.equal('extra' in materials, false)

  assert.throws(() => normalizeLeetcodeMaterials({}), { code: 'INVALID_MATERIALS_STATEMENT' })
  assert.throws(() => normalizeLeetcodeMaterials({ statement: '题意', examples: [{ input: 'x' }] }), { code: 'INVALID_MATERIALS_EXAMPLE' })
  assert.throws(() => normalizeLeetcodeMaterials({ statement: '题意', knowledge: [{ title: '二分' }] }), { code: 'INVALID_MATERIALS_KNOWLEDGE' })
})

test('材料与提示阶梯按引导强度保存并在用完后拒绝继续提示', () => {
  let practice = practiceWithQuestion()
  const saved = saveMaterials(practice, {
    questionId: 'question-1',
    materials: { statement: '题意', hints: ['方向', '关键观察', '伪代码骨架'] },
    now: 3,
  })
  practice = saved.practice
  assert.equal(saved.question.materials.hints.length, 3)
  assert.equal(saved.question.hintLevel, 0)
  assert.throws(() => saveMaterials(practice, {
    questionId: 'question-1', materials: { statement: '重复' }, now: 4,
  }), { code: 'MATERIALS_ALREADY_EXISTS' })

  const first = revealHint(practice, { questionId: 'question-1', now: 5 })
  assert.equal(first.hint, '方向')
  assert.equal(first.hintLevel, 1)
  const second = revealHint(first.practice, { questionId: 'question-1', now: 6 })
  const third = revealHint(second.practice, { questionId: 'question-1', now: 7 })
  assert.equal(third.hint, '伪代码骨架')
  assert.equal(third.hintLevel, 3)
  assert.throws(() => revealHint(third.practice, { questionId: 'question-1', now: 8 }), (error) => (
    error instanceof DomainError && error.code === 'NO_MORE_HINTS'
  ))

  // 重写材料后已解锁级数按新的提示条数收敛。
  const replaced = saveMaterials(third.practice, {
    questionId: 'question-1', materials: { statement: '新题意', hints: ['只有一级'] }, replace: true, now: 9,
  })
  assert.equal(replaced.question.hintLevel, 1)
  assert.equal(replaced.question.materials.statement, '新题意')
})

test('没有材料时不能提示，非力扣题不能保存材料', () => {
  const practice = practiceWithQuestion()
  assert.throws(() => revealHint(practice, { questionId: 'question-1', now: 3 }), { code: 'MATERIALS_REQUIRED' })
  const bagu = askQuestion(createPractice({ id: 'p', mode: 'bagu', config: { topic: 'JVM' }, now: 1 }), {
    id: 'q', prompt: '什么是逃逸分析？', now: 2,
  }).practice
  assert.throws(() => saveMaterials(bagu, { questionId: 'q', materials: { statement: '题意' }, now: 3 }), {
    code: 'MATERIALS_NOT_ALLOWED',
  })
})
