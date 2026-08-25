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
  assert.equal(session.resource.data.selected, true)
  assert.equal(session.resource.data.currentQuestion, null)
  assert.equal('stage' in session.resource.data, false)
  assert.equal('allowedOperations' in session.resource.data, false)

  const question = await fixture.application.createAtomicQuestion('session-1', { prompt: '什么是 JMM？' })
  const questionId = question.resource.data.id
  session = await fixture.application.readAtomicSession('session-1')
  assert.equal(session.resource.data.currentQuestion.id, questionId)

  const attempt = await fixture.application.createAtomicAttempt('session-1', {
    questionId, answer: 'Java 内存模型。',
  })
  const attemptId = attempt.resource.data.id
  assert.ok(attempt.revision > question.revision)
  session = await fixture.application.readAtomicSession('session-1')
  assert.equal(session.resource.data.currentQuestion.attempts.at(-1).evaluation, null)

  await fixture.application.createAtomicEvaluation('session-1', {
    questionId, attemptId, score: 7, feedback: '基础正确。',
  })
  session = await fixture.application.readAtomicSession('session-1')
  assert.equal(session.resource.data.currentQuestion.attempts.at(-1).evaluation.score, 7)
  assert.equal(session.resource.data.currentQuestion.explanation, null)

  await fixture.application.createAtomicExplanation('session-1', {
    questionId, detail: 'JMM 规定线程间可见性。', memorizationPoints: 'JMM 解决可见性与有序性。',
  })
  session = await fixture.application.readAtomicSession('session-1')
  assert.equal(session.resource.data.currentQuestion.explanation.detail, 'JMM 规定线程间可见性。')

  const completed = await fixture.application.completeAtomicPractice('session-1', {
    overall: '完成 JVM 练习。', strengths: ['基础清晰。'], improvements: ['补充 happens-before。'],
  })
  assert.equal(completed.resource.data.status, 'completed')
  assert.equal(await fixture.repository.getSessionBinding('session-1'), null)
  assert.equal((await fixture.application.getPractice(practiceId)).resource.data.questions.length, 1)
})

test('模拟面试手撕题从 Hot 100 抽取但仍保留 mock 练习语义', async () => {
  const fixture = applicationFixture()
  await fixture.application.createAtomicPractice('mock-session', {
    mode: 'mock',
    config: {
      resume: '负责服务端项目。', targetRole: '通用技术开发', jobDescriptionProvided: false,
      jobDescription: '', interviewerStyle: '深挖项目', coding: true, difficulty: 'intermediate',
    },
  })
  const first = await fixture.application.drawAtomicMockCodingQuestion('mock-session')
  const second = await fixture.application.drawAtomicMockCodingQuestion('mock-session')
  const practice = (await fixture.application.readAtomicSession('mock-session')).resource.data.practice

  assert.equal(practice.mode, 'mock')
  assert.equal(practice.topic, '模拟面试')
  assert.equal(first.resource.data.hot100.slug, 'two-sum')
  assert.notEqual(second.resource.data.hot100.slug, first.resource.data.hot100.slug)
  assert.equal(first.resource.data.leetcode, undefined)
})

test('模拟面试题目关闭看答案并拒绝点评链路，结束时只归档记录', async () => {
  const fixture = applicationFixture()
  await fixture.application.createAtomicPractice('mock-session', {
    mode: 'mock',
    config: {
      resume: '服务端项目。', targetRole: '通用技术开发', jobDescriptionProvided: false,
      jobDescription: '', interviewerStyle: '专业追问', coding: false, difficulty: 'intermediate',
    },
  })
  const question = await fixture.application.createAtomicQuestion('mock-session', { prompt: '请介绍一个你负责的项目。' })
  const session = (await fixture.application.readAtomicSession('mock-session')).resource.data
  assert.equal(question.resource.data.capabilities.allowReveal, false)
  assert.equal(session.currentQuestion.capabilities.allowReveal, false)
  const attempt = await fixture.application.createAtomicAttempt('mock-session', {
    questionId: question.resource.data.id, answer: '我负责核心服务。',
  })
  await assert.rejects(
    fixture.application.createAtomicEvaluation('mock-session', {
      questionId: question.resource.data.id, attemptId: attempt.resource.data.id, score: 8, feedback: '不应生成',
    }),
    { code: 'MOCK_EVALUATION_NOT_ALLOWED' },
  )
  await assert.rejects(
    fixture.application.createAtomicExplanation('mock-session', {
      questionId: question.resource.data.id, detail: '不应生成', memorizationPoints: '不应生成',
    }),
    { code: 'MOCK_EXPLANATION_NOT_ALLOWED' },
  )
  const completed = await fixture.application.completeAtomicPractice('mock-session')
  assert.equal(completed.resource.data.status, 'completed')
  assert.equal(completed.resource.data.summary, null)
})

test('简历押题独立使用押题范围配置并保留点评能力', async () => {
  const fixture = applicationFixture()
  const created = await fixture.application.createAtomicPractice('resume-session', {
    mode: 'resume_drill',
    config: {
      resume: '服务端项目。', targetRole: '通用技术开发', jobDescriptionProvided: false,
      jobDescription: '', focus: '项目难点与技术选型', difficulty: 'intermediate',
    },
  })
  const question = await fixture.application.createAtomicQuestion('resume-session', { prompt: '项目中最难的技术问题是什么？' })
  assert.equal(created.resource.data.mode, 'resume_drill')
  assert.equal(question.resource.data.capabilities.allowReveal, true)
})

test('重复题可以由删除与创建两个原子操作组合替换', async () => {
  const fixture = applicationFixture()
  await fixture.application.createAtomicPractice('session-1', { mode: 'bagu', config: { topic: 'MySQL' } })
  const duplicate = await fixture.application.createAtomicQuestion('session-1', { prompt: '什么是 redo log？' })
  await fixture.application.deleteAtomicQuestion('session-1', duplicate.resource.data.id)
  let session = await fixture.application.readAtomicSession('session-1')
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

test('展示卡片消费后会推进会话版本且不能重复消费', async () => {
  const fixture = applicationFixture()
  await fixture.application.createAtomicPractice('session-1', { mode: 'bagu', config: { topic: 'JVM' } })
  await fixture.application.createAtomicQuestion('session-1', { prompt: '什么是类加载？' })
  const before = (await fixture.application.readAtomicSession('session-1')).resource.data
  const input = {
    presentationId: 'presentation-1',
    practiceId: before.practice.id,
    questionId: before.currentQuestionId,
    sessionRevision: before.revision,
  }

  await fixture.application.consumeAtomicPresentation('session-1', input)
  const after = (await fixture.application.readAtomicSession('session-1')).resource.data
  assert.equal(after.revision, before.revision + 1)
  assert.equal(after.currentQuestionId, before.currentQuestionId)
  await assert.rejects(
    fixture.application.consumeAtomicPresentation('session-1', input),
    /这张卡片已经完成/,
  )
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
  const session = await fixture.application.readAtomicSession('leetcode-session')
  assert.equal(session.resource.data.currentQuestion.leetcode.slug, next.resource.data.leetcode.slug)
  assert.notEqual(session.resource.data.currentQuestion.leetcode.slug, first.resource.data.leetcode.slug)
})
