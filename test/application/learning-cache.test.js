import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationFixture } from '../support/application-fixture.js'
import { InterviewApplication } from '../../src/application/interview-application.js'
import { dispatchCommand } from '../../src/adapters/http/command-dispatcher.js'

const REFERENCE = { slug: 'merge-intervals', title: '合并区间', statement: '合并重叠闭区间。',
  examples: [{ input: '[[1,4],[4,5]]', output: '[[1,5]]' }], constraints: ['区间非空'],
  code: 'class Solution:\n    def merge(self, intervals):\n        # 返回合并后的区间列表\n        return []' }
const MATERIALS = { statement: REFERENCE.statement, guidanceIntro: '观察端点的重叠关系。',
  hints: ['观察：[1,4] 与 [4,5] 相接。为什么能合并？', '先手推逐对比较，有哪些重复？',
    '如何保留最后一段的右端点？', '更新边界时为什么不能缩短覆盖范围？'] }
const DETAIL = '通用推导与边界检查\n```python\nclass Solution:\n    def merge(self, intervals):\n        # 返回已经合并的区间列表\n        return []\n```'
const idsOf = (result) => result.references
async function draw(f, session = 's1', config = { language: 'python', guidance: 'guided' }) {
  await f.application.createAtomicPractice(session, { mode: 'leetcode', config })
  return idsOf(await f.application.drawAtomicLeetcode(session, { selection: { slug: 'merge-intervals' } }))
}
function restart(f) {
  const app = f.application
  f.application = new InterviewApplication({ repository: f.repository, events: app.events, exporter: app.exporter,
    clock: app.clock, ids: app.ids, random: app.random })
}
async function setup() {
  const f = applicationFixture()
  await f.repository.saveReferenceLibrary({ references: [REFERENCE] })
  return f
}

test('引导跨练习复用，提示从零开始；读取和复用不请求 AI，不切换绑定', async () => {
  const f = await setup(), first = await draw(f)
  await f.application.saveAtomicMaterials('s1', { questionId: first.questionId, materials: MATERIALS })
  await f.application.revealQuestionLearningHint(first.practiceId, first.questionId)
  const second = await draw(f, 's2')
  const before = await f.repository.getSessionBinding('s2')
  const view = (await f.application.getQuestionLearning(second.practiceId, second.questionId, 's2')).resource.data
  assert.equal(view.guidance.ready, true)
  assert.equal(view.guidance.cached, true)
  assert.equal(view.guidance.reused, true)
  assert.equal(view.guidance.hintLevel, 0)
  assert.deepEqual(view.guidance.revealedHints, [])
  assert.doesNotMatch(JSON.stringify(view), /如何保留最后一段/)
  let calls = 0
  await f.application.generateQuestionGuidance('other', second, () => { calls++; return true })
  assert.equal(calls, 0)
  assert.deepEqual(await f.repository.getSessionBinding('s2'), before)
  await f.application.revealQuestionLearningHint(second.practiceId, second.questionId)
  assert.equal((await f.repository.getPractice(first.practiceId)).questions[0].hintLevel, 1)
  assert.equal((await f.repository.getPractice(second.practiceId)).questions[0].hintLevel, 1)
})

test('同题多个练习、多次点击以及应用重建共用一个持久生成锁', async () => {
  const f = await setup(), first = await draw(f), second = await draw(f, 's2')
  const events = [], dispatch = (event) => { events.push(event); return true }
  await Promise.all([f.application.generateQuestionGuidance('s1', first, dispatch),
    f.application.generateQuestionGuidance('s2', second, dispatch), f.application.generateQuestionGuidance('s1', first, dispatch)])
  assert.equal(events.length, 1)
  const owner = events[0].questionId === first.questionId ? { ids: first, session: 's1' } : { ids: second, session: 's2' }
  restart(f)
  await f.application.generateQuestionGuidance('s1', first, dispatch)
  assert.equal(events.length, 1)
  await f.application.saveAtomicMaterials(owner.session, { questionId: owner.ids.questionId, materials: MATERIALS, requestId: events[0].requestId })
  assert.equal((await f.application.getQuestionLearning(second.practiceId, second.questionId)).resource.data.guidance.ready, true)
})

test('语言与引导模式分别存储，不共用错误级数或语言的引导', async () => {
  const f = await setup(), first = await draw(f)
  await f.application.saveAtomicMaterials('s1', { questionId: first.questionId, materials: MATERIALS })
  for (const config of [{ language: 'java', guidance: 'guided' }, { language: 'python', guidance: 'standard' }]) {
    const ids = await draw(f, 'other', config)
    assert.equal((await f.application.getQuestionLearning(ids.practiceId, ids.questionId)).resource.data.guidance.ready, false)
  }
})

test('通用 AI 讲解复用且独立于引导模式，个人作答修正版不进入缓存', async () => {
  const f = await setup(), first = await draw(f)
  await f.application.createAtomicAttempt('s1', { questionId: first.questionId, answer: '个人实现' })
  let requestId
  await f.application.generateQuestionSolution('s1', { ...first, force: true }, (event) => { requestId = event.requestId; return true })
  await assert.rejects(f.application.createAtomicExplanation('s1', { questionId: first.questionId, scope: 'attempt', requestId,
    detail: DETAIL, memorizationPoints: '个人要点' }), { code: 'INVALID_REFERENCE_SCOPE' })
  await f.application.createAtomicExplanation('s1', { questionId: first.questionId, scope: 'attempt',
    detail: DETAIL.replace('通用推导', '你的代码专属修正'), memorizationPoints: '个人要点' })
  const pending = await f.repository.findLearningRequest(first.questionId, 'solution')
  assert.equal((await f.repository.getLearningCache(pending.key)).payload, undefined)
  await f.repository.failLearningRequest(pending.key, requestId, '测试中取消通用生成')
  const second = await draw(f, 's2')
  assert.equal((await f.application.getQuestionSolution(second.practiceId, second.questionId)).resource.data.scope, undefined)
  assert.equal([...f.repository.learningCache.values()].filter((entry) => entry.payload).length, 0)
  await f.application.createAtomicExplanation('s2', { questionId: second.questionId, detail: DETAIL, memorizationPoints: '通用要点', scope: 'reference' })
  restart(f)
  const third = await draw(f, 's3', { language: 'python', guidance: 'standard' })
  const result = (await f.application.getQuestionSolution(third.practiceId, third.questionId)).resource.data
  assert.equal(result.detail, DETAIL)
  assert.equal(result.reused, true)
  assert.equal(result.scope, 'reference')
  assert.match(result.source, /题库缓存/)
  assert.deepEqual((await f.repository.getPractice(third.practiceId)).questions[0].attempts, [])
})

test('题面或参考代码改变使旧缓存失效，抓取时间改变不影响复用', async () => {
  const f = await setup(), first = await draw(f)
  await f.application.saveAtomicMaterials('s1', { questionId: first.questionId, materials: MATERIALS })
  await f.application.createAtomicExplanation('s1', { questionId: first.questionId, detail: DETAIL, memorizationPoints: '要点' })
  await f.repository.saveReferenceLibrary({ references: [{ ...REFERENCE, fetchedAt: 9999 }] })
  assert.equal((await f.application.getQuestionLearning(first.practiceId, first.questionId)).resource.data.guidance.ready, true)
  await f.repository.saveReferenceLibrary({ references: [{ ...REFERENCE, code: REFERENCE.code + '\n# 新的参考步骤' }] })
  const view = (await f.application.getQuestionLearning(first.practiceId, first.questionId)).resource.data
  assert.equal(view.guidance.ready, false)
  assert.equal((await f.application.getQuestionSolution(first.practiceId, first.questionId)).resource.data.scope, undefined)
  restart(f)
  assert.equal((await f.application.getQuestionLearning(first.practiceId, first.questionId)).resource.data.guidance.ready, false)
})

test('手动重新生成只请求一次，失败时旧缓存继续可读，迟到结果不会覆盖新请求', async () => {
  const f = await setup(), ids = await draw(f)
  await f.application.saveAtomicMaterials('s1', { questionId: ids.questionId, materials: MATERIALS })
  const events = [], dispatch = (event) => { events.push(event); return true }
  await f.application.generateQuestionGuidance('s1', { ...ids, force: true }, dispatch)
  await f.application.generateQuestionGuidance('s1', { ...ids, force: true }, dispatch)
  assert.equal(events.length, 1)
  const context = await f.application.learningCache.context((await f.repository.getPractice(ids.practiceId)),
    (await f.repository.getPractice(ids.practiceId)).questions[0], 'guidance')
  await f.repository.failLearningRequest(context.key, events[0].requestId, '网络断开')
  const old = (await f.application.getQuestionLearning(ids.practiceId, ids.questionId)).resource.data.guidance
  assert.equal(old.ready, true)
  assert.equal(old.status, 'failed')
  await f.application.generateQuestionGuidance('s1', { ...ids, force: true }, dispatch)
  await assert.rejects(f.application.saveAtomicMaterials('s1', { questionId: ids.questionId, materials: MATERIALS,
    replace: true, requestId: events[0].requestId }), { code: 'LEARNING_REQUEST_STALE' })
  const changed = { ...MATERIALS, guidanceIntro: '新的引导路线' }
  await f.application.saveAtomicMaterials('s1', { questionId: ids.questionId, materials: changed, replace: true, requestId: events[1].requestId })
  assert.equal((await f.application.getQuestionLearning(ids.practiceId, ids.questionId)).resource.data.guidance.introduction, changed.guidanceIntro)
})

test('已有本地答案直接读取；强制 AI 详解生成会持久去重并保存通用缓存', async () => {
  const f = await setup(), first = await draw(f), second = await draw(f, 's2')
  const events = [], runtime = { application: f.application, eventBridge: { dispatch(_session, event) { events.push(event); return true } } }
  const hit = await dispatchCommand(runtime, 's1', 'question.solution-generate', first)
  assert.equal(hit.cacheHit, true)
  assert.equal(hit.analysisQueued, false)
  assert.equal(events.length, 0)
  await Promise.all([dispatchCommand(runtime, 's1', 'question.solution-generate', { ...first, force: true }),
    dispatchCommand(runtime, 's2', 'question.solution-generate', { ...second, force: true })])
  assert.equal(events.length, 1)
  const session = events[0].questionId === first.questionId ? 's1' : 's2'
  await f.application.createAtomicExplanation(session, { questionId: events[0].questionId, detail: DETAIL,
    memorizationPoints: '要点', requestId: events[0].requestId })
  assert.equal((await f.application.getQuestionSolution(second.practiceId, second.questionId)).resource.data.detail, DETAIL)
})

test('旧档案安全回收无作答的 AI 内容，删除源练习不丢题库缓存', async () => {
  const f = await setup(), first = await draw(f)
  const practice = await f.repository.getPractice(first.practiceId)
  practice.questions[0].materials = { ...MATERIALS, source: { kind: 'model' } }
  practice.questions[0].explanation = { detail: DETAIL, memorizationPoints: '要点', createdAt: 100 }
  await f.repository.commit({ practice })
  restart(f)
  const second = await draw(f, 's2')
  assert.equal(f.repository.learningCache.size, 2)
  await f.repository.deletePractice(first.practiceId)
  restart(f)
  assert.equal((await f.application.getQuestionSolution(second.practiceId, second.questionId)).resource.data.detail, DETAIL)
  assert.equal((await f.application.getQuestionLearning(second.practiceId, second.questionId)).resource.data.guidance.ready, true)
})

test('已回收的旧档案不会在资料更新和重启后被再次标成新版本缓存', async () => {
  const f = await setup(), first = await draw(f)
  const practice = await f.repository.getPractice(first.practiceId)
  practice.questions[0].materials = { ...MATERIALS, source: { kind: 'model' } }
  await f.repository.commit({ practice })
  restart(f)
  assert.equal((await f.application.getQuestionLearning(first.practiceId, first.questionId)).resource.data.guidance.cached, true)
  await f.repository.saveReferenceLibrary({ references: [{ ...REFERENCE, constraints: ['新的官方约束'] }] })
  restart(f)
  const second = await draw(f, 's2')
  assert.equal((await f.application.getQuestionLearning(first.practiceId, first.questionId)).resource.data.guidance.ready, false)
  assert.equal((await f.application.getQuestionLearning(second.practiceId, second.questionId)).resource.data.guidance.ready, false)
  assert.equal(f.repository.learningCache.size, 1)
})

test('更新通用缓存后旧练习立即读取新内容，同时保留各自提示进度', async () => {
  const f = await setup(), first = await draw(f)
  await f.application.saveAtomicMaterials('s1', { questionId: first.questionId, materials: MATERIALS })
  await f.application.createAtomicExplanation('s1', { questionId: first.questionId, detail: DETAIL, memorizationPoints: '旧要点' })
  const second = await draw(f, 's2')
  await f.application.revealQuestionLearningHint(second.practiceId, second.questionId)
  let guidanceId, solutionId
  await f.application.generateQuestionGuidance('s1', { ...first, force: true }, (event) => { guidanceId = event.requestId; return true })
  await f.application.saveAtomicMaterials('s1', { questionId: first.questionId, materials: { ...MATERIALS, guidanceIntro: '新版引导' }, replace: true, requestId: guidanceId })
  await f.application.generateQuestionSolution('s1', { ...first, force: true }, (event) => { solutionId = event.requestId; return true })
  await f.application.createAtomicExplanation('s1', { questionId: first.questionId, detail: DETAIL.replace('通用推导', '新版推导'), memorizationPoints: '新版要点', replace: true, requestId: solutionId })
  const learning = (await f.application.getQuestionLearning(second.practiceId, second.questionId)).resource.data.guidance
  assert.equal(learning.introduction, '新版引导')
  assert.equal(learning.hintLevel, 1)
  assert.equal((await f.application.getQuestionSolution(second.practiceId, second.questionId)).resource.data.memorizationPoints, '新版要点')
})

test('同题多次代码分析仅首个请求生成通用讲解，未投递时释放生成锁', async () => {
  const f = await setup(), first = await draw(f, 's1', { language: 'java', guidance: 'guided' }), second = await draw(f, 's2', { language: 'java', guidance: 'guided' })
  const [one, two] = await Promise.all([f.application.prepareCodeReviewReference(first.practiceId, first.questionId),
    f.application.prepareCodeReviewReference(second.practiceId, second.questionId)])
  assert.equal(Boolean(one.requestId), true)
  assert.equal(two.referenceSolutionPending, true)
  await f.application.failCodeReviewReference(first.questionId, one.requestId)
  const retry = await f.application.prepareCodeReviewReference(second.practiceId, second.questionId)
  assert.equal(Boolean(retry.requestId), true)
  assert.notEqual(retry.requestId, one.requestId)
})

test('对话卡片查看题目材料直接展示已保存内容，不再生成或替换引导', async () => {
  const f = await setup(), first = await draw(f)
  await f.application.saveAtomicMaterials('s1', { questionId: first.questionId, materials: MATERIALS })
  const events = [], before = await f.repository.getPractice(first.practiceId)
  await dispatchCommand({ application: f.application, eventBridge: { dispatch(_id, event) { events.push(event); return true } } },
    's1', 'question.materials', { questionId: first.questionId })
  assert.deepEqual(events.map((event) => event.type), ['question.show'])
  assert.deepEqual(await f.repository.getPractice(first.practiceId), before)
})
