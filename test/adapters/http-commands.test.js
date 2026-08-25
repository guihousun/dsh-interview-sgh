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
    event: { type: 'question.generate', practiceId: result.resource.data.practice.id, mode: 'bagu', includeModeContext: true },
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
  assert.equal(context.dispatched.at(-1).event.mode, 'bagu')
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
  assert.equal(context.dispatched.at(-1).event.mode, 'bagu')
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
      mode: 'bagu',
      includeModeContext: true,
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
  const text = instructionFor({ type: 'practice.continue', practiceId: 'practice-1', mode: 'bagu' })
  assert.match(text, /interview_session read/)
  assert.doesNotMatch(text, /nextAction|interview_continue_practice|状态机|pendingTask/)
})

test('绑定练习时注入一次当前模式上下文，操作任务不重复注入', () => {
  const event = (mode) => instructionFor({ type: 'question.generate', practiceId: 'practice-1', mode, includeModeContext: true })

  assert.match(event('bagu'), /当前激活练习模式为背八股（bagu）/)
  assert.match(event('bagu'), /【看答案】背八股看答案时/)
  assert.match(event('mock'), /config\.interviewerStyle/)
  assert.match(event('mock'), /config\.targetRole/)
  assert.match(event('mock'), /覆盖简历中的全部主要项目/)
  assert.match(event('mock'), /不得假设技术栈/)
  assert.match(event('mock'), /config\.coding 为 false 时整场禁止手撕代码/)
  assert.match(event('mock'), /每段主要经历至少验证：项目背景、个人职责/)
  assert.match(event('mock'), /手撕不能作为第一题，前面必须完成项目或技术背景铺垫/)
  assert.match(event('mock'), /说重新做某题时保留原题和原作答/)
  assert.match(event('mock'), /证据不足时明确写证据不足/)
  assert.equal((event('mock').match(/config\.coding 为 false 时整场禁止手撕代码/g) || []).length, 1)
  assert.equal((event('mock').match(/每次只能提出一个主要问题/g) || []).length, 1)
  assert.match(event('scenario'), /【看答案】场景题看答案时/)
  assert.match(event('leetcode'), /【看答案】力扣看答案时/)
  assert.doesNotMatch(instructionFor({ type: 'question.generate', practiceId: 'practice-1', mode: 'mock' }), /当前激活练习模式|项目真实性、表达结构/)
})

test('点评讲解与练习总结按当前模式选择策略', () => {
  const review = (mode) => instructionFor({
    type: 'review.generate', practiceId: 'practice-1', questionId: 'question-1', mode, includeModeContext: true,
  })
  const summary = (mode) => instructionFor({ type: 'practice.summarize', practiceId: 'practice-1', mode, includeModeContext: true })

  assert.match(review('bagu'), /底层原理、适用场景、边界和常见误区/)
  assert.match(review('mock'), /项目真实性.*表达结构.*岗位匹配度/)
  assert.match(review('scenario'), /方案推导、关键权衡、风险、边界和落地验证/)
  assert.match(review('leetcode'), /只使用 config\.language 提供一份完整可提交代码/)
  assert.match(summary('bagu'), /知识覆盖、理解准确性和口述完整性/)
  assert.match(summary('mock'), /面试官风格/)
  assert.match(summary('scenario'), /问题拆解、方案合理性、取舍意识/)
})
