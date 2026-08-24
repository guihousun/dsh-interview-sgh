import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatchCommand } from '../../src/adapters/http/command-dispatcher.js'
import { instructionFor } from '../../src/adapters/dsh/agent-event-bridge.js'
import { createPresentationToolDefinitions } from '../../src/adapters/dsh/presentation-tool-definitions.js'
import { isCardActive } from '../../src/client/shared/card-activity.js'
import { applicationFixture } from '../support/application-fixture.js'

function fixture() {
  const base = applicationFixture()
  const dispatched = []
  return {
    ...base,
    dispatched,
    runtime: { application: base.application, eventBridge: { dispatch: (sessionId, event) => dispatched.push({ sessionId, event }) } },
  }
}

async function cardPayload(application, sessionId = 'session-1', presentationId = 'presentation-1') {
  const session = (await application.readAtomicSession(sessionId)).resource.data
  return {
    presentationId,
    practiceId: session.practice.id,
    questionId: session.currentQuestionId,
    sessionRevision: session.revision,
  }
}

test('UI 新建知识练习只保存练习并投递一次性出题请求', async () => {
  const context = fixture()
  const result = await dispatchCommand(context.runtime, 'session-1', 'session.start', {
    mode: 'bagu', config: { topic: 'JVM' },
  })
  assert.equal(result.resource.data.currentQuestion, null)
  assert.equal('stage' in result.resource.data, false)
  assert.deepEqual(context.dispatched, [{
    sessionId: 'session-1',
    event: { type: 'question.generate', practiceId: result.resource.data.practice.id },
  }])
  assert.equal('pendingTask' in result.resource.data, false)
})

test('UI 下一题不封装业务状态机而是投递可失败的一次性生成请求', async () => {
  const context = fixture()
  await context.application.createAtomicPractice('session-1', { mode: 'bagu', config: { topic: 'MySQL' } })
  await context.application.createAtomicQuestion('session-1', { prompt: '什么是 redo log？' })
  const result = await dispatchCommand(
    context.runtime,
    'session-1',
    'question.next',
    await cardPayload(context.application),
  )
  assert.equal(result.resource.data.currentQuestion.prompt, '什么是 redo log？')
  assert.equal(context.dispatched.at(-1).event.type, 'question.generate')
})

test('UI 查看答案依据真实数据选择生成或展示讲解', async () => {
  const context = fixture()
  const practice = await context.application.createAtomicPractice('session-1', { mode: 'bagu', config: { topic: 'JVM' } })
  const question = await context.application.createAtomicQuestion('session-1', { prompt: '什么是 JMM？' })
  await dispatchCommand(
    context.runtime,
    'session-1',
    'question.reveal',
    await cardPayload(context.application),
  )
  assert.equal(context.dispatched.at(-1).event.type, 'review.generate')
  await context.application.createAtomicExplanation('session-1', {
    questionId: question.resource.data.id, detail: '详细讲解。', memorizationPoints: '直接背。',
  })
  await dispatchCommand(
    context.runtime,
    'session-1',
    'question.reveal',
    await cardPayload(context.application, 'session-1', 'presentation-2'),
  )
  assert.equal(context.dispatched.at(-1).event.type, 'review.show')
  assert.equal(context.dispatched.at(-1).event.practiceId, practice.resource.data.id)
})

test('重新作答保留历史并创建可操作的新题目卡片', async () => {
  const context = fixture()
  const practice = await context.application.createAtomicPractice('session-1', { mode: 'bagu', config: { topic: 'JVM' } })
  const question = await context.application.createAtomicQuestion('session-1', { prompt: '什么是 JMM？' })
  const attempt = await context.application.createAtomicAttempt('session-1', {
    questionId: question.resource.data.id,
    answer: 'Java 内存模型。',
  })
  await context.application.createAtomicEvaluation('session-1', {
    questionId: question.resource.data.id,
    attemptId: attempt.resource.data.id,
    score: 8,
    feedback: '回答正确。',
  })
  await context.application.createAtomicExplanation('session-1', {
    questionId: question.resource.data.id,
    detail: 'JMM 定义线程间可见性。',
    memorizationPoints: 'JMM 解决可见性与有序性。',
  })

  const tools = Object.fromEntries(createPresentationToolDefinitions(context.application).map((tool) => [tool.name, tool]))
  const exec = { agent: { session: { header: { id: 'session-1' } } } }
  const reviewCard = await tools.interview_show_review.execute({
    practice_id: practice.resource.data.id,
    question_id: question.resource.data.id,
    attempt_id: attempt.resource.data.id,
  }, exec)

  await dispatchCommand(context.runtime, 'session-1', 'question.retry', reviewCard.artifact)
  assert.equal(context.dispatched.at(-1).event.type, 'question.show')

  const questionCard = await tools.interview_show_question.execute({
    practice_id: practice.resource.data.id,
    question_id: question.resource.data.id,
  }, exec)
  const session = (await context.application.readAtomicSession('session-1')).resource.data
  assert.notEqual(questionCard.artifact.presentationId, reviewCard.artifact.presentationId)
  assert.equal(isCardActive(session, questionCard.artifact), true)
  assert.equal(session.currentQuestion.attempts.length, 1)
  assert.equal(session.currentQuestion.explanation.detail, 'JMM 定义线程间可见性。')
})

test('练习档案无需卡片凭证即可聚焦题目并请求展示', async () => {
  const context = fixture()
  const practice = await context.application.createAtomicPractice('session-1', { mode: 'bagu', config: { topic: 'MySQL' } })
  const first = await context.application.createAtomicQuestion('session-1', { prompt: '什么是 redo log？' })
  await context.application.createAtomicQuestion('session-1', { prompt: '什么是 undo log？' })

  const result = await dispatchCommand(context.runtime, 'session-2', 'question.focus', {
    practiceId: practice.resource.data.id,
    questionId: first.resource.data.id,
  })

  assert.equal(result.references.questionId, first.resource.data.id)
  assert.deepEqual(context.dispatched.at(-1), {
    sessionId: 'session-2',
    event: {
      type: 'question.show',
      practiceId: practice.resource.data.id,
      questionId: first.resource.data.id,
    },
  })
})

test('同一张卡片只能推进一次流程', async () => {
  const context = fixture()
  await context.application.createAtomicPractice('session-1', { mode: 'bagu', config: { topic: 'MySQL' } })
  await context.application.createAtomicQuestion('session-1', { prompt: '什么是 undo log？' })
  const payload = await cardPayload(context.application)

  await dispatchCommand(context.runtime, 'session-1', 'question.next', payload)
  await assert.rejects(
    dispatchCommand(context.runtime, 'session-1', 'question.next', payload),
    /这张卡片已经完成/,
  )
  assert.equal(context.dispatched.filter(({ event }) => event.type === 'question.generate').length, 1)
})

test('一次性 Agent 指令只引用原子业务工具和独立展示工具', () => {
  const text = instructionFor({ type: 'practice.continue', practiceId: 'practice-1' })
  assert.match(text, /interview_session read/)
  assert.doesNotMatch(text, /nextAction|interview_continue_practice|状态机|pendingTask/)
})
