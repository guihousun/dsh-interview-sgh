import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationFixture } from '../support/application-fixture.js'
import { dispatchCommand } from '../../src/adapters/http/command-dispatcher.js'
import { instructionFor } from '../../src/adapters/dsh/agent-event-bridge.js'
import { parseCodeAnswer } from '../../src/domain/code-answer.js'

async function setup() {
  const fixture = applicationFixture()
  const { application } = fixture
  await application.createAtomicPractice('s1', { mode: 'leetcode', config: { language: 'python', guidance: 'standard' } })
  await application.drawAtomicLeetcode('s1', { selection: { slug: 'two-sum' } })
  const session = (await application.readAtomicSession('s1')).resource.data
  return { ...fixture, payload: {
    practiceId: session.practice.id, questionId: session.currentQuestionId,
    presentationId: 'card-1', sessionRevision: session.revision,
    code: 'def twoSum(nums, target):\n    return []', language: 'python', notes: '请检查是否漏掉边界。',
  } }
}

test('UI 提交保存代码后只投递一次指定作答的静态分析任务', async () => {
  const { application, payload } = await setup()
  const events = []
  const result = await dispatchCommand({ application, eventBridge: { dispatch(_id, event) { events.push(event); return true } } }, 's1', 'question.code-review', payload)
  assert.equal(result.analysisQueued, true)
  const question = (await application.getPractice(payload.practiceId)).resource.data.questions[0]
  assert.equal(question.attempts.length, 1)
  assert.deepEqual(parseCodeAnswer(question.attempts[0].answer), { code: payload.code, language: payload.language, notes: payload.notes })
  assert.equal(events.length, 1)
  assert.equal(events[0].attemptId, question.attempts[0].id)
  const instruction = instructionFor(events[0])
  assert.match(instruction, /不要运行、编译代码/)
  assert.match(instruction, /手工推演/)
  assert.match(instruction, /禁止重复创建作答/)
  assert.match(instruction, /完整修正版.*只写入 explanation/)
})

test('并发重复提交只保存一次，过期卡片或语言不匹配不会留下错误作答', async () => {
  const { application, payload } = await setup()
  const results = await Promise.allSettled([application.submitAtomicCodeAnswer('s1', payload), application.submitAtomicCodeAnswer('s1', payload)])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'STALE_PRESENTATION')
  assert.equal((await application.getPractice(payload.practiceId)).resource.data.attemptCount, 1)
  const other = await setup()
  await assert.rejects(other.application.submitAtomicCodeAnswer('s1', { ...other.payload, language: 'java' }), { code: 'CODE_LANGUAGE_MISMATCH' })
  assert.equal((await other.application.getPractice(other.payload.practiceId)).resource.data.attemptCount, 0)
})

test('验证失败或数据库写入失败不会消耗卡片，用户仍可提交原草稿', async () => {
  const { application, repository, payload } = await setup()
  await assert.rejects(application.submitAtomicCodeAnswer('s1', { ...payload, code: '  ' }), { code: 'EMPTY_CODE_ANSWER' })
  const commit = repository.commit.bind(repository)
  repository.commit = async () => { throw new Error('storage unavailable') }
  await assert.rejects(application.submitAtomicCodeAnswer('s1', payload), /storage unavailable/)
  repository.commit = commit
  const session = (await application.readAtomicSession('s1')).resource.data
  assert.equal(session.revision, payload.sessionRevision)
  assert.equal(session.practice.attemptCount, 0)
  await application.submitAtomicCodeAnswer('s1', payload)
  assert.equal((await application.getPractice(payload.practiceId)).resource.data.attemptCount, 1)
})

test('AI 不在线时明确返回未投递，重试分析不重复创建代码作答', async () => {
  const { application, payload } = await setup()
  const runtime = { application, eventBridge: { dispatch() { return false } } }
  const saved = await dispatchCommand(runtime, 's1', 'question.code-review', payload)
  assert.equal(saved.analysisQueued, false)
  runtime.eventBridge.dispatch = () => true
  const retry = await dispatchCommand(runtime, 's1', 'question.code-review.retry', { ...payload, attemptId: saved.references.attemptId })
  assert.equal(retry.analysisQueued, true)
  assert.equal((await application.getPractice(payload.practiceId)).resource.data.attemptCount, 1)
})

test('用户主动分析模拟面试代码时不开放自动评分或参考答案工具', () => {
  const text = instructionFor({ type: 'code.review', mode: 'mock', practiceId: 'p1', questionId: 'q1', attemptId: 'a1', language: 'java' })
  assert.match(text, /用户主动请求的代码分析/)
  assert.match(text, /不打面试分/)
  assert.doesNotMatch(text, /interview_evaluation create|interview_explanation create/)
})

test('工作台写代码只聚焦真实题目，不自动启动 AI 出题或泄露答案', async () => {
  const { application, payload } = await setup()
  const events = []
  const result = await dispatchCommand({ application, eventBridge: { dispatch(_id, event) { events.push(event) } } }, 'editor-session', 'question.code-open', payload)
  assert.equal(result.resource.data.currentQuestionId, payload.questionId)
  assert.equal(result.resource.data.practice.id, payload.practiceId)
  assert.equal(result.resource.data.practice.attemptCount, 0)
  assert.equal(events.length, 0)
  await assert.rejects(dispatchCommand({ application }, 'editor-session', 'question.code-open', { ...payload, questionId: 'missing' }), /找不到题目/)
})

test('单独提交只保存原始代码、思路与完成标记，不请求 AI、不生成评价或讲解', async () => {
  const { application, repository, payload } = await setup()
  const events = []
  const result = await dispatchCommand({ application, eventBridge: { dispatch(_id, event) { events.push(event); return true } } },
    's1', 'question.code-submit', payload)
  assert.equal(result.savedOnly, true)
  assert.equal(result.analysisQueued, false)
  assert.deepEqual(events, [])
  const question = (await repository.getPractice(payload.practiceId)).questions[0]
  assert.deepEqual(parseCodeAnswer(question.attempts[0].answer), { code: payload.code, language: payload.language, notes: payload.notes })
  assert.equal(question.attempts[0].evaluation, null)
  assert.equal(question.explanation, null)
  assert.equal((await repository.listLeetcodeProgress())[0].completed, true)
  assert.equal((await repository.getSessionBinding('s1')).revision, result.revision)
})

test('先单独提交再分析复用已有作答，修改后提交保留两个版本且不重复计算完成进度', async () => {
  const { application, repository, payload } = await setup()
  const events = [], runtime = { application, eventBridge: { dispatch(_id, event) { events.push(event); return true } } }
  const first = await dispatchCommand(runtime, 's1', 'question.code-submit', payload)
  await dispatchCommand(runtime, 's1', 'question.code-review.retry', { ...payload, attemptId: first.references.attemptId })
  assert.equal((await repository.getPractice(payload.practiceId)).questions[0].attempts.length, 1)
  assert.equal(events.length, 1)
  assert.equal(events[0].attemptId, first.references.attemptId)
  const next = { ...payload, sessionRevision: first.revision, presentationId: 'code-version-2', code: payload.code + '\n# 第二版思路' }
  await dispatchCommand(runtime, 's1', 'question.code-submit', next)
  const attempts = (await repository.getPractice(payload.practiceId)).questions[0].attempts
  assert.equal(attempts.length, 2)
  assert.equal(parseCodeAnswer(attempts[0].answer).code, payload.code)
  assert.equal(parseCodeAnswer(attempts[1].answer).code, next.code)
  assert.equal((await application.getLeetcodeCatalog()).resource.data.completedCount, 1)
  assert.equal(events.length, 1)
})

test('单独提交的并发重试与过期卡片不会重复保存，存储失败保留代码并可重试', async () => {
  const { application, repository, payload } = await setup()
  const runtime = { application }
  const results = await Promise.allSettled([dispatchCommand(runtime, 's1', 'question.code-submit', payload), dispatchCommand(runtime, 's1', 'question.code-submit', payload)])
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1)
  assert.equal(results.find((item) => item.status === 'rejected').reason.code, 'STALE_PRESENTATION')
  assert.equal((await repository.getPractice(payload.practiceId)).questions[0].attempts.length, 1)
  const other = await setup(), commit = other.repository.commit.bind(other.repository)
  other.repository.commit = async () => { throw new Error('storage unavailable') }
  await assert.rejects(dispatchCommand({ application: other.application }, 's1', 'question.code-submit', other.payload), /storage unavailable/)
  assert.equal((await other.repository.getPractice(other.payload.practiceId)).questions[0].attempts.length, 0)
  assert.deepEqual(await other.repository.listLeetcodeProgress(), [])
  other.repository.commit = commit
  await dispatchCommand({ application: other.application }, 's1', 'question.code-submit', other.payload)
  assert.equal((await other.repository.getPractice(other.payload.practiceId)).questions[0].attempts.length, 1)
})

test('后续文字回答不遮掉最近的代码作答，分析仍严格指定最近的代码版本', async () => {
  const { application, payload } = await setup()
  const first = await dispatchCommand({ application }, 's1', 'question.code-submit', payload)
  await application.createAtomicAttempt('s1', { questionId: payload.questionId, answer: '我再补充一下思路' })
  const events = []
  await dispatchCommand({ application, eventBridge: { dispatch(_id, event) { events.push(event); return true } } },
    's1', 'question.code-review.retry', { ...payload, attemptId: first.references.attemptId })
  assert.equal(events[0].attemptId, first.references.attemptId)
})
