import assert from 'node:assert/strict'
import test from 'node:test'
import { applicationFixture } from '../support/application-fixture.js'

test('原子操作通过真实数据推进完整知识练习', async () => {
  const fixture = applicationFixture()
  const created = await fixture.application.createAtomicPractice('session-1', {
    mode: 'bagu', config: { topic: 'JVM' },
  })
  const practiceId = created.resource.data.id
  assert.equal('agentTasks' in created, false)

  let session = await fixture.application.readAtomicSession('session-1')
  assert.equal(session.resource.data.stage, 'ready_for_question')
  assert.ok(session.resource.data.allowedOperations.includes('question.create'))

  const question = await fixture.application.createAtomicQuestion('session-1', { prompt: '什么是 JMM？' })
  const questionId = question.resource.data.id
  session = await fixture.application.readAtomicSession('session-1')
  assert.equal(session.resource.data.stage, 'answerable')

  const attempt = await fixture.application.createAtomicAttempt('session-1', {
    questionId, answer: 'Java 内存模型。',
  })
  const attemptId = attempt.resource.data.id
  assert.ok(attempt.revision > question.revision)
  session = await fixture.application.readAtomicSession('session-1')
  assert.equal(session.resource.data.stage, 'needs_evaluation')

  await fixture.application.createAtomicEvaluation('session-1', {
    questionId, attemptId, score: 7, feedback: '基础正确。',
  })
  session = await fixture.application.readAtomicSession('session-1')
  assert.equal(session.resource.data.stage, 'needs_explanation')

  await fixture.application.createAtomicExplanation('session-1', {
    questionId, detail: 'JMM 规定线程间可见性。', memorizationPoints: 'JMM 解决可见性与有序性。',
  })
  session = await fixture.application.readAtomicSession('session-1')
  assert.equal(session.resource.data.stage, 'reviewed')

  const completed = await fixture.application.completeAtomicPractice('session-1', {
    overall: '完成 JVM 练习。', strengths: ['基础清晰。'], improvements: ['补充 happens-before。'],
  })
  assert.equal(completed.resource.data.status, 'completed')
  assert.equal(await fixture.repository.getSessionBinding('session-1'), null)
  assert.equal((await fixture.application.getPractice(practiceId)).resource.data.questions.length, 1)
})

test('重复题可以由删除与创建两个原子操作组合替换', async () => {
  const fixture = applicationFixture()
  await fixture.application.createAtomicPractice('session-1', { mode: 'bagu', config: { topic: 'MySQL' } })
  const duplicate = await fixture.application.createAtomicQuestion('session-1', { prompt: '什么是 redo log？' })
  await fixture.application.deleteAtomicQuestion('session-1', duplicate.resource.data.id)
  let session = await fixture.application.readAtomicSession('session-1')
  assert.equal(session.resource.data.stage, 'ready_for_question')
  assert.equal(session.resource.data.currentQuestion, null)

  const replacement = await fixture.application.createAtomicQuestion('session-1', { prompt: '什么是 undo log？' })
  session = await fixture.application.readAtomicSession('session-1')
  assert.equal(session.resource.data.currentQuestion.id, replacement.resource.data.id)
  assert.deepEqual(session.resource.data.practice.questions.map((item) => item.prompt), ['什么是 undo log？'])
})

test('聚焦历史题只改变当前题指针并保留全部作答', async () => {
  const fixture = applicationFixture()
  await fixture.application.createAtomicPractice('session-1', { mode: 'scenario', config: { topic: '高并发' } })
  const first = await fixture.application.createAtomicQuestion('session-1', { prompt: '如何设计限流？' })
  await fixture.application.createAtomicAttempt('session-1', { questionId: first.resource.data.id, answer: '使用令牌桶。' })
  await fixture.application.createAtomicQuestion('session-1', { prompt: '如何设计熔断？' })
  await fixture.application.focusAtomicQuestion('session-1', first.resource.data.id)
  const session = await fixture.application.readAtomicSession('session-1')
  assert.equal(session.resource.data.currentQuestion.id, first.resource.data.id)
  assert.equal(session.resource.data.currentQuestion.attempts.length, 1)
})

test('力扣抽题与随机下一题是无待办的原子操作', async () => {
  const fixture = applicationFixture()
  await fixture.application.createAtomicPractice('leetcode-session', {
    mode: 'leetcode', config: { language: 'java' },
  })
  const first = await fixture.application.drawAtomicLeetcode('leetcode-session')
  const firstPracticeId = first.references.practiceId
  assert.equal(first.resource.data.leetcode.slug, 'two-sum')

  const next = await fixture.application.drawNextAtomicLeetcode('leetcode-session')
  assert.notEqual(next.references.practiceId, firstPracticeId)
  assert.equal((await fixture.repository.getPractice(firstPracticeId)).status, 'completed')
  assert.equal((await fixture.application.readAtomicSession('leetcode-session')).resource.data.stage, 'solving')
})
