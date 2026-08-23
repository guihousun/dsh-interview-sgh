import assert from 'node:assert/strict'
import test from 'node:test'
import { createPresentationToolDefinitions } from '../../src/adapters/dsh/presentation-tool-definitions.js'
import { applicationFixture } from '../support/application-fixture.js'

function fixture() {
  const base = applicationFixture()
  const tools = Object.fromEntries(createPresentationToolDefinitions(base.application).map((tool) => [tool.name, tool]))
  return { ...base, tools, exec: { agent: { session: { header: { id: 'session-1' } } } } }
}

async function reviewedQuestion(context) {
  const practice = await context.application.createAtomicPractice('session-1', { mode: 'bagu', config: { topic: 'JVM' } })
  const question = await context.application.createAtomicQuestion('session-1', { prompt: '什么是 JMM？' })
  const attempt = await context.application.createAtomicAttempt('session-1', {
    questionId: question.resource.data.id, answer: 'Java 内存模型。',
  })
  await context.application.createAtomicEvaluation('session-1', {
    questionId: question.resource.data.id,
    attemptId: attempt.resource.data.id,
    score: 8,
    feedback: '正确。',
  })
  await context.application.createAtomicExplanation('session-1', {
    questionId: question.resource.data.id,
    detail: 'JMM 定义线程间可见性。',
    memorizationPoints: 'JMM 解决可见性与有序性。',
  })
  return {
    practiceId: practice.resource.data.id,
    questionId: question.resource.data.id,
    attemptId: attempt.resource.data.id,
  }
}

test('展示工具与业务工具独立且只通过资源 ID 读取权威数据', async () => {
  const context = fixture()
  const ids = await reviewedQuestion(context)
  const question = await context.tools.interview_show_question.execute({
    practice_id: ids.practiceId, question_id: ids.questionId,
  }, context.exec)
  assert.equal(question.artifact.kind, 'question')
  assert.equal(question.resource.data.prompt, '什么是 JMM？')
  assert.equal(typeof question.artifact.presentationId, 'string')
  assert.equal(typeof question.artifact.sessionRevision, 'number')

  const review = await context.tools.interview_show_review.execute({
    practice_id: ids.practiceId, question_id: ids.questionId, attempt_id: ids.attemptId,
  }, context.exec)
  assert.equal(review.artifact.kind, 'review')
  assert.equal(review.artifact.attemptId, ids.attemptId)
  assert.match(review.assistantInstruction, /禁止复述卡片内容/)
})

test('新建练习先展示空白配置卡且不创建业务数据', async () => {
  const context = fixture()
  const result = await context.tools.interview_show_practice_setup.execute({}, context.exec)
  assert.equal(result.artifact.kind, 'practice-setup')
  assert.equal(typeof result.artifact.presentationId, 'string')
  assert.deepEqual((await context.application.listPractices()).resource.data, [])
  assert.match(context.tools.interview_show_practice_setup.description, /必须调用本工具/)
  assert.match(context.tools.interview_show_practice_setup.description, /禁止自行填写默认值/)
})

test('展示工具不创建或修改业务数据', async () => {
  const context = fixture()
  const ids = await reviewedQuestion(context)
  const before = (await context.application.getPractice(ids.practiceId)).resource.data
  const first = await context.tools.interview_show_question.execute({
    practice_id: ids.practiceId, question_id: ids.questionId,
  }, context.exec)
  const second = await context.tools.interview_show_question.execute({
    practice_id: ids.practiceId, question_id: ids.questionId,
  }, context.exec)
  await context.tools.interview_show_review.execute({
    practice_id: ids.practiceId, question_id: ids.questionId,
  }, context.exec)
  const after = (await context.application.getPractice(ids.practiceId)).resource.data
  assert.deepEqual(after, before)
  assert.notEqual(first.artifact.presentationId, second.artifact.presentationId)
})

test('点评讲解展示拒绝尚未保存讲解的题目', async () => {
  const context = fixture()
  const practice = await context.application.createAtomicPractice('session-1', { mode: 'bagu', config: { topic: 'JVM' } })
  const question = await context.application.createAtomicQuestion('session-1', { prompt: '什么是 JMM？' })
  await assert.rejects(() => context.tools.interview_show_review.execute({
    practice_id: practice.resource.data.id,
    question_id: question.resource.data.id,
  }, context.exec), /还没有讲解/)
})

test('各类展示工具的描述明确禁止普通文本代替 UI', () => {
  const context = fixture()
  for (const tool of Object.values(context.tools)) {
    assert.match(tool.name, /^interview_show_/)
    assert.match(tool.description, /展示/)
  }
  assert.match(context.tools.interview_show_question.description, /禁止使用普通 Assistant Text/)
  assert.match(context.tools.interview_show_review.description, /禁止使用普通 Assistant Text/)
  assert.match(context.tools.interview_show_summary.description, /禁止使用普通 Assistant Text/)
  assert.match(context.tools.interview_show_practice_setup.description, /禁止通过普通 Assistant Text/)
})
