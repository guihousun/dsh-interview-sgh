import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { InterviewApplication } from '../../src/application/interview-application.js'
import { SqliteInterviewRepository } from '../../src/infrastructure/sqlite-interview-repository.js'

test('完整练习只通过原子资源操作持久化并可重新读取', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-interview-e2e-'))
  const databasePath = join(directory, 'interview.sqlite')
  const repository = new SqliteInterviewRepository(databasePath)
  let sequence = 0
  let now = 100
  const application = new InterviewApplication({
    repository,
    events: { async publish() {} },
    exporter: { async export() { return [] } },
    clock: { now: () => ++now },
    ids: { next: (prefix) => `${prefix}-${++sequence}` },
    random: { next: () => 0 },
  })

  try {
    const created = await application.createAtomicPractice('session-e2e', { mode: 'bagu', config: { topic: 'JVM' } })
    const practiceId = created.resource.data.id
    const question = await application.createAtomicQuestion('session-e2e', { prompt: '什么是 JMM？' })
    const attempt = await application.createAtomicAttempt('session-e2e', { questionId: question.resource.data.id, answer: 'Java 内存模型。' })
    await application.createAtomicEvaluation('session-e2e', {
      questionId: question.resource.data.id, attemptId: attempt.resource.data.id, score: 7, feedback: '基础正确。',
    })
    await application.createAtomicExplanation('session-e2e', {
      questionId: question.resource.data.id, detail: 'JMM 定义线程间可见性和有序性。', memorizationPoints: 'JMM 规范内存可见性。',
    })
    await application.completeAtomicPractice('session-e2e', {
      overall: '已完成。', strengths: ['概念准确。'], improvements: ['补充 happens-before。'],
    })
    assert.equal((await application.getPractice(practiceId)).resource.data.status, 'completed')
    assert.equal((await application.readAtomicSession('session-e2e')).resource.data.selected, false)
  } finally {
    repository.close()
  }

  const restored = new SqliteInterviewRepository(databasePath)
  try {
    const practices = await restored.listPractices({ status: 'completed' })
    assert.equal(practices.length, 1)
    assert.equal(practices[0].questions[0].attempts[0].evaluation.score, 7)
    assert.equal(await restored.getSessionBinding('session-e2e'), null)
  } finally {
    restored.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
