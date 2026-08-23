import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatchCommand } from '../../src/adapters/http/command-dispatcher.js'
import { instructionFor } from '../../src/adapters/dsh/agent-event-bridge.js'
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
  assert.equal(result.resource.data.stage, 'ready_for_question')
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
