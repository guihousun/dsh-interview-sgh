import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationFixture } from '../support/application-fixture.js'
import { dispatchCommand } from '../../src/adapters/http/command-dispatcher.js'
import { normalizeReferenceRecord } from '../../src/domain/leetcode-reference.js'

const REFERENCE = normalizeReferenceRecord({
  slug: 'merge-intervals', number: '56', title: '合并区间', category: '普通数组', difficulty: 'medium',
  url: 'https://leetcode.cn/problems/merge-intervals/', officialSource: 'live',
  statement: '合并所有重叠的闭区间，返回恰好覆盖输入范围的不重叠区间数组。',
  examples: [{ input: 'intervals = [[1,4],[4,5]]', output: '[[1,5]]', note: '相接的闭区间也重叠' }],
  constraints: ['1 <= intervals.length <= 10^4'],
  idea: '先排序，再合并重叠区间。', code: 'class Solution:\n    def merge(self, intervals):\n        return SECRET_REFERENCE_CODE',
  complexity: 'O(n log n)', mnemonic: '排序后检查最后一个区间',
})

async function setup({ language = 'python', guidance = 'guided', withReference = true } = {}) {
  const fixture = applicationFixture()
  if (withReference) await fixture.repository.saveReferenceLibrary({ references: [REFERENCE] })
  await fixture.application.createAtomicPractice('s1', { mode: 'leetcode', config: { language, guidance } })
  const drawn = await fixture.application.drawAtomicLeetcode('s1', { selection: { slug: 'merge-intervals' } })
  return { ...fixture, ...drawn.references }
}

test('完整题面读取官方事实，不写入练习，也不泄露答案与未来提示', async () => {
  const { application, repository, practiceId, questionId } = await setup()
  const before = await repository.getPractice(practiceId)
  const learning = (await application.getQuestionLearning(practiceId, questionId)).resource.data
  assert.deepEqual(learning.problem.examples, REFERENCE.examples)
  assert.deepEqual(learning.problem.constraints, REFERENCE.constraints)
  assert.equal(learning.problem.statement, REFERENCE.statement)
  assert.equal(learning.guidance.enabled, true)
  assert.equal(learning.guidance.knowledge.length, 2)
  assert.equal(learning.guidance.hintTotal, 4)
  assert.deepEqual(learning.guidance.revealedHints, [])
  assert.doesNotMatch(JSON.stringify(learning), /SECRET_REFERENCE_CODE|先排序，再合并/)
  assert.deepEqual(await repository.getPractice(practiceId), before)
})

test('无 AI 材料时可逐级解锁并保存引导，原代码作答仍可提交', async () => {
  const { application, repository, practiceId, questionId } = await setup()
  const session = (await application.readAtomicSession('s1')).resource.data
  const binding = await repository.getSessionBinding('s1')
  const runtime = { application, eventBridge: { dispatch() { throw new Error('不应调用 AI') } } }
  for (let level = 1; level <= 4; level += 1) {
    const result = await dispatchCommand(runtime, 's1', 'question.learning-hint', { practiceId, questionId })
    assert.equal(result.resource.data.guidance.hintLevel, level)
    assert.equal(result.resource.data.guidance.revealedHints.length, level)
  }
  const stored = await repository.getPractice(practiceId)
  assert.equal(stored.questions[0].hintLevel, 4)
  assert.equal(stored.questions[0].explanation, null)
  assert.equal(stored.questions[0].attempts.length, 0)
  assert.deepEqual(await repository.getSessionBinding('s1'), binding)
  await assert.rejects(application.revealQuestionLearningHint(practiceId, questionId), /提示都已经给出/)
  await application.submitAtomicCodeAnswer('s1', { practiceId, questionId, sessionRevision: session.revision, presentationId: 'editor-1', code: 'def merge(intervals):\n    return []', language: 'python' })
  assert.equal((await application.getPractice(practiceId)).resource.data.attemptCount, 1)
})

test('标准模式保留三级提示，没有保存的题面明确为空，不编造题意', async () => {
  const { application, practiceId, questionId } = await setup({ guidance: 'standard', withReference: false })
  const { problem, guidance } = (await application.getQuestionLearning(practiceId, questionId)).resource.data
  assert.equal(problem.statement, '')
  assert.deepEqual(problem.examples, [])
  assert.equal(guidance.enabled, false)
  assert.equal(guidance.hintTotal, 3)
  assert.deepEqual(guidance.knowledge, [])
  await assert.rejects(application.revealQuestionLearningHint(practiceId, questionId), { code: 'MATERIALS_REQUIRED' })
})

test('已保存提示继续使用，完整题面仍以官方为准', async () => {
  const { application, repository, practiceId, questionId } = await setup()
  await application.saveAtomicMaterials('s1', { questionId, materials: { statement: 'AI 简短转述', hints: ['已保存的读题提示', '已保存的思路提示'] } })
  await application.revealQuestionLearningHint(practiceId, questionId)
  const learning = (await application.getQuestionLearning(practiceId, questionId)).resource.data
  assert.equal(learning.problem.statement, REFERENCE.statement)
  assert.deepEqual(learning.guidance.revealedHints, ['已保存的读题提示'])
  assert.equal(learning.guidance.hintTotal, 2)
  assert.equal((await repository.getPractice(practiceId)).questions[0].materials.statement, 'AI 简短转述')
})

test('没有 AI 讲解时读取本地 Python 题解，已有讲解优先，读取不写入记录', async () => {
  const { application, repository, practiceId, questionId } = await setup()
  const before = await repository.getPractice(practiceId)
  const solution = (await application.getQuestionSolution(practiceId, questionId)).resource.data
  assert.equal(solution.available, true)
  assert.match(solution.detail, /```python\nclass Solution:/)
  assert.match(solution.detail, /SECRET_REFERENCE_CODE/)
  assert.deepEqual(await repository.getPractice(practiceId), before)
  const detail = '保存的 AI 答案\n```python\nclass Solution:\n    def merge(self, intervals):\n        return []\n```'
  await application.createAtomicExplanation('s1', { questionId, detail, memorizationPoints: '关键点' })
  const saved = (await application.getQuestionSolution(practiceId, questionId)).resource.data
  assert.equal(saved.detail, detail)
  assert.equal(saved.memorizationPoints, '关键点')
})

test('其他语言不会显示 Python 答案，手动生成不消耗当前代码卡片', async () => {
  const { application, repository, practiceId, questionId } = await setup({ language: 'java' })
  const solution = (await application.getQuestionSolution(practiceId, questionId)).resource.data
  assert.equal(solution.available, false)
  assert.equal(solution.allowed, true)
  assert.equal(solution.detail, undefined)
  const before = await repository.getSessionBinding('s1')
  const events = []
  const result = await dispatchCommand({ application, eventBridge: { dispatch(_sessionId, event) { events.push(event); return true } } }, 's1', 'question.solution-generate', { practiceId, questionId })
  assert.equal(result.analysisQueued, true)
  assert.equal(events[0].type, 'review.generate')
  assert.equal(events[0].questionId, questionId)
  assert.deepEqual(await repository.getSessionBinding('s1'), before)
  assert.equal((await application.getPractice(practiceId)).resource.data.attemptCount, 0)
})

test('生成请求未投递时明确返回失败；模拟面试不开放答案或引导', async () => {
  const { application, practiceId, questionId } = await setup({ withReference: false })
  const result = await dispatchCommand({ application, eventBridge: { dispatch() { return false } } }, 's1', 'question.solution-generate', { practiceId, questionId })
  assert.equal(result.analysisQueued, false)
  await application.createAtomicPractice('mock', { mode: 'mock', config: { targetRole: '开发', resume: '基础学习', jobDescriptionProvided: false, difficulty: 'intermediate', interviewerStyle: '专业追问', coding: true } })
  const created = await application.drawAtomicMockCodingQuestion('mock')
  const ids = created.references
  assert.equal((await application.getQuestionSolution(ids.practiceId, ids.questionId)).resource.data.allowed, false)
  assert.equal((await application.getQuestionLearning(ids.practiceId, ids.questionId)).resource.data.guidance.hintTotal, 0)
  await assert.rejects(dispatchCommand({ application }, 'mock', 'question.solution-generate', ids), { code: 'REVEAL_NOT_ALLOWED' })
})

test('长官方题面不再按旧的 3000 字符上限截断', () => {
  const statement = '完整的题目条件。'.repeat(500)
  const reference = normalizeReferenceRecord({ slug: 'long-problem', statement })
  assert.equal(reference.statement, statement)
})
