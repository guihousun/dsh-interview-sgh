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
  assert.equal(learning.guidance.knowledge.length, 0)
  assert.equal(learning.guidance.ready, false)
  assert.equal(learning.guidance.source, 'none')
  assert.equal(learning.guidance.hintTotal, 4)
  assert.deepEqual(learning.guidance.revealedHints, [])
  assert.doesNotMatch(JSON.stringify(learning), /SECRET_REFERENCE_CODE|先排序，再合并/)
  assert.deepEqual(await repository.getPractice(practiceId), before)
})

const AI_MATERIALS = {
  statement: '合并所有重叠区间。', guidanceIntro: '从闭区间端点关系推导可验证的合并过程。',
  knowledge: [{ title: '闭区间', detail: '两个端点也属于区间；同一端点同时属于两段时，它们有交集。' }],
  hints: [
    '关键观察：端点也属于闭区间。\n\n手推：[1,4] 与 [4,5] 共有端点 4。\n\n自检：若第二段从 5 开始，还能合并吗？',
    '关键观察：任意顺序会让你反复检查过去的区间。\n\n手推：[8,10]、[1,3]、[2,6]，统计逐对比较的次数。\n\n自检：哪种排列能减少回头检查？',
    '关键观察：按左端点排序后，保留最后一段的覆盖范围。\n\n手推：[1,6] 后遇到 [2,4]，右端点不能缩到 4。\n\n自检：应更新为哪个值，为什么？',
    '关键观察：当前左端点大于最后右端点时才开新段。\n\n手推：[1,4] 后接 [4,5] 与 [5,7] 两种情况。\n\n自检：单个区间和完全包含时的分支是否正确？',
  ],
}

test('首次生成调用 AI 一次，保存后逐级解锁，原代码作答仍可提交', async () => {
  const { application, repository, practiceId, questionId } = await setup()
  const session = (await application.readAtomicSession('s1')).resource.data
  const binding = await repository.getSessionBinding('s1')
  const events = []
  const runtime = { application, eventBridge: { dispatch(_id, event) { events.push(event); return true } } }
  await assert.rejects(application.revealQuestionLearningHint(practiceId, questionId), { code: 'AI_GUIDANCE_REQUIRED' })
  await Promise.all(Array.from({ length: 4 }, () => dispatchCommand(runtime, 's1', 'question.guidance-generate', { practiceId, questionId, automatic: true })))
  assert.equal(events.length, 1)
  assert.equal(events[0].type, 'guidance.generate')
  assert.equal((await application.getQuestionLearning(practiceId, questionId, 's1')).resource.data.guidance.status, 'generating')
  assert.equal((await repository.getPractice(practiceId)).questions[0].materials.source.kind, 'local')
  assert.deepEqual((await repository.getPractice(practiceId)).questions[0].materials.hints, [])
  await application.saveAtomicMaterials('s1', { questionId, materials: AI_MATERIALS })
  const ready = (await application.getQuestionLearning(practiceId, questionId, 's1')).resource.data.guidance
  assert.equal(ready.source, 'ai')
  assert.equal(ready.status, 'ready')
  assert.equal(ready.introduction, AI_MATERIALS.guidanceIntro)
  assert.deepEqual(ready.revealedHints, [])
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
  await assert.rejects(application.revealQuestionLearningHint(practiceId, questionId), { code: 'AI_GUIDANCE_REQUIRED' })
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

test('已保存的通用模板不冒充 AI，重新生成重置提示并保留作答、答案与绑定', async () => {
  const { application, repository, practiceId, questionId } = await setup()
  const legacyHints = [
    '先画出第一个示例的输入与输出，用自己的话描述任务。用最小的合法输入手推一次，明确需要返回什么，而不是先套算法模板。',
    '先提出一个保证正确的直观办法，再数一数它重复做了什么。结合输入规模，判断这样的时间复杂度是否可接受。',
    '把“已处理部分”与“未处理部分”分开：需要保存什么状态，才能避免重复计算？比较可能的数据结构，说明你选择它的理由。',
    '把思路拆成初始化、每一步更新、终止条件与返回结果。先核对最小输入和边界，再自己写代码，并手工推演示例。',
  ]
  await application.saveAtomicMaterials('s1', { questionId, materials: { ...AI_MATERIALS, hints: legacyHints } })
  const old = await repository.getPractice(practiceId)
  old.questions[0].hintLevel = 4
  await repository.commit({ practice: old })
  await application.createAtomicExplanation('s1', { questionId, detail: '已有正确答案\n```python\nclass Solution:\n    def merge(self, intervals):\n        # 返回已经合并好的区间列表\n        return []\n```', memorizationPoints: '要点' })
  const before = await repository.getPractice(practiceId)
  const binding = await repository.getSessionBinding('s1')
  const view = (await application.getQuestionLearning(practiceId, questionId, 's1')).resource.data.guidance
  assert.equal(view.source, 'local')
  assert.equal(view.ready, false)
  assert.deepEqual(view.revealedHints, [])
  assert.equal(view.canAutoGenerate, true)
  await application.generateQuestionGuidance('s1', { practiceId, questionId }, () => true)
  await assert.rejects(application.saveAtomicMaterials('s1', { questionId, replace: true, materials: { ...AI_MATERIALS, hints: legacyHints } }), { code: 'INVALID_AI_GUIDANCE' })
  await application.saveAtomicMaterials('s1', { questionId, replace: true, materials: AI_MATERIALS })
  await application.revealQuestionLearningHint(practiceId, questionId)
  await application.generateQuestionGuidance('s1', { practiceId, questionId, force: true }, () => true)
  await application.saveAtomicMaterials('s1', { questionId, replace: true, materials: AI_MATERIALS })
  const stored = await repository.getPractice(practiceId)
  assert.equal(stored.questions[0].hintLevel, 0)
  assert.deepEqual(stored.questions[0].attempts, before.questions[0].attempts)
  assert.deepEqual(stored.questions[0].explanation, before.questions[0].explanation)
  assert.deepEqual(await repository.getSessionBinding('s1'), binding)
})

test('失败和超时明确返回，可重试；自动生成不切换会话绑定或处理档案', async () => {
  const { application, repository, practiceId, questionId } = await setup()
  let calls = 0
  const dispatch = () => { calls += 1; return false }
  let result = await application.generateQuestionGuidance('s1', { practiceId, questionId }, dispatch)
  assert.equal(result.analysisQueued, false)
  assert.equal(result.resource.data.guidance.status, 'failed')
  assert.match(result.resource.data.guidance.error, /未启动/)
  result = await application.generateQuestionGuidance('s1', { practiceId, questionId }, () => true)
  assert.equal(result.analysisQueued, true)
  const pending = await repository.findLearningRequest(questionId, 'guidance')
  repository.learningCache.get(pending.key).startedAt = -180000
  assert.equal((await application.getQuestionLearning(practiceId, questionId)).resource.data.guidance.status, 'failed')
  await application.generateQuestionGuidance('s1', { practiceId, questionId }, dispatch)
  assert.equal(calls, 2)
  const before = await repository.getSessionBinding('s1')
  assert.equal((await application.getQuestionLearning(practiceId, questionId, 'other')).resource.data.guidance.canAutoGenerate, false)
  await assert.rejects(application.generateQuestionGuidance('other', { practiceId, questionId, automatic: true }, dispatch), { code: 'GUIDANCE_SESSION_CHANGED' })
  assert.deepEqual(await repository.getSessionBinding('s1'), before)
  await application.completeAtomicPractice('s1', {})
  await assert.rejects(application.generateQuestionGuidance('s1', { practiceId, questionId }, dispatch), { code: 'PRACTICE_COMPLETED' })
})

test('没有 AI 讲解时读取本地 Python 题解，已有讲解优先，读取不写入记录', async () => {
  const { application, repository, practiceId, questionId } = await setup()
  const before = await repository.getPractice(practiceId)
  const solution = (await application.getQuestionSolution(practiceId, questionId)).resource.data
  assert.equal(solution.available, true)
  assert.match(solution.detail, /```python\nclass Solution:/)
  assert.match(solution.detail, /SECRET_REFERENCE_CODE/)
  assert.deepEqual(await repository.getPractice(practiceId), before)
  const detail = '保存的 AI 答案\n```python\nclass Solution:\n    def merge(self, intervals):\n        # 返回已经合并好的区间列表\n        return []\n```'
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

test('不带基本注释的 AI 答案不会落库，也不改变作答记录和会话绑定', async () => {
  const { application, repository, practiceId, questionId } = await setup()
  const before = await repository.getPractice(practiceId)
  const binding = await repository.getSessionBinding('s1')
  await assert.rejects(application.createAtomicExplanation('s1', { questionId,
    detail: '```python\nclass Solution:\n    def merge(self, intervals):\n        return []\n```', memorizationPoints: '区间合并' }),
  { code: 'LEETCODE_SOLUTION_COMMENTS_REQUIRED' })
  assert.deepEqual(await repository.getPractice(practiceId), before)
  assert.deepEqual(await repository.getSessionBinding('s1'), binding)
})
