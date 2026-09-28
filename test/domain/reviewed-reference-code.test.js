import test from 'node:test'
import assert from 'node:assert/strict'
import review from '../../src/data/reviewed-leetcode-code.json' with { type: 'json' }
import { normalizeReferenceRecord } from '../../src/domain/leetcode-reference.js'
import { reviewReferenceCode, referenceCodeReview } from '../../src/domain/reviewed-reference-code.js'
import { assertSolutionCodeComments } from '../../src/domain/solution-code-comments.js'

test('100 道题的 118 份原有实现全部有审核版本，注释满足答案保存要求', () => {
  assert.equal(referenceCodeReview.problemCount, 100)
  assert.equal(review.entries.length, 118)
  for (const entry of review.entries) {
    assert.ok(entry.original && entry.code && entry.annotatedOriginal, entry.id)
    assert.doesNotThrow(() => assertSolutionCodeComments(`\x60\x60\x60python\n${entry.code}\n\x60\x60\x60`, 'python'), entry.id)
  }
})

test('精确匹配时补注释，保留官方题面与未知的用户自定义实现', () => {
  const entry = review.entries.find((entry) => entry.slug === 'longest-consecutive-sequence')
  const facts = { statement: '官方题面', examples: [{ input: 'nums = []', output: '0' }], constraints: ['n >= 0'],
    sourceFile: '用户原笔记.md', fetchedAt: 123, officialSource: 'live' }
  const result = reviewReferenceCode({ slug: entry.slug, code: entry.original, ...facts })
  assert.equal(result.code, entry.code)
  for (const [key,value] of Object.entries(facts)) assert.deepEqual(result[key],value)
  const custom = { slug: entry.slug, code: 'class Solution:\n    def longestConsecutive(self, nums):\n        return 42', ...facts }
  assert.equal(reviewReferenceCode(custom).code, custom.code)
})

test('五道缺失的主答案从已审核的对应解法补齐，未知替代实现不被替换', () => {
  for (const [slug, id] of Object.entries(review.defaults)) {
    const entry = review.entries.find((entry) => entry.id === id)
    const result = normalizeReferenceRecord({ slug, variants: [{ kind: '原解法', code: entry.original, idea: '原思路', complexity: '原复杂度' }] })
    assert.equal(result.code, entry.code, slug)
    assert.equal(result.variants.length, 1)
    assert.equal(normalizeReferenceRecord({ slug, variants: [{ kind: '自定义', code: '# 用户实现\npass' }] }).code, '')
  }
})

test('改用满足题面要求的主答案时保留最小堆学习版，重复导入不重复增加解法', () => {
  for (const entry of review.entries.filter((entry) => entry.preserveAlternative)) {
    const input = { slug: entry.slug, code: entry.original, complexity: entry.originalComplexity, variants: [] }
    const output = reviewReferenceCode(input)
    assert.equal(output.code, entry.code)
    assert.equal(output.variants.length, 1)
    assert.equal(output.variants[0].code, entry.annotatedOriginal)
    assert.equal(output.variants[0].complexity, entry.originalComplexity)
    assert.deepEqual(reviewReferenceCode(output), output)
    assert.equal(input.variants.length, 0)
  }
})
