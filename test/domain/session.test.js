import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allowedOperationsFor,
  clearSessionQuestion,
  consumeSessionBinding,
  createSessionBinding,
  deriveSessionStage,
  focusSessionQuestion,
  SESSION_STAGES,
  transferSessionBinding,
} from '../../src/domain/session.js'

function practice(overrides = {}) {
  return { status: 'active', mode: 'bagu', ...overrides }
}

function question(overrides = {}) {
  return { id: 'q1', attempts: [], explanation: null, ...overrides }
}

test('会话绑定只保存练习和当前题指针', () => {
  const created = createSessionBinding({ sessionId: 's1', practiceId: 'p1', now: 1 })
  assert.deepEqual(created, {
    sessionId: 's1', practiceId: 'p1', currentQuestionId: null, revision: 1, updatedAt: 1,
  })
  const focused = focusSessionQuestion(created, 'q1', 2)
  assert.equal(focused.currentQuestionId, 'q1')
  assert.equal(focused.revision, 2)
  const transferred = transferSessionBinding(focused, 's2', 3)
  assert.equal(transferred.sessionId, 's2')
  assert.equal(clearSessionQuestion(transferred, 4).currentQuestionId, null)
})

test('消费卡片只推进会话版本', () => {
  const binding = focusSessionQuestion(
    createSessionBinding({ sessionId: 's1', practiceId: 'p1', now: 1 }),
    'q1',
    2,
  )
  const consumed = consumeSessionBinding(binding, 3)
  assert.deepEqual(consumed, { ...binding, revision: binding.revision + 1, updatedAt: 3 })
})

test('会话阶段完全由练习数据推导', () => {
  assert.equal(deriveSessionStage({ practice: practice() }), SESSION_STAGES.READY_FOR_QUESTION)
  assert.equal(deriveSessionStage({ practice: practice(), question: question() }), SESSION_STAGES.ANSWERABLE)
  assert.equal(deriveSessionStage({
    practice: practice(), question: question({ attempts: [{ evaluation: null }] }),
  }), SESSION_STAGES.NEEDS_EVALUATION)
  assert.equal(deriveSessionStage({
    practice: practice(), question: question({ attempts: [{ evaluation: { score: 8 } }] }),
  }), SESSION_STAGES.NEEDS_EXPLANATION)
  assert.equal(deriveSessionStage({
    practice: practice(), question: question({ explanation: { detail: '讲解' } }),
  }), SESSION_STAGES.REVIEWED)
  assert.equal(deriveSessionStage({
    practice: practice({ status: 'completed' }), question: question(),
  }), SESSION_STAGES.COMPLETED)
})

test('允许操作由真实数据生成且不包含流程宏命令', () => {
  const operations = allowedOperationsFor({ practice: practice(), question: question() })
  assert.ok(operations.includes('attempt.create'))
  assert.ok(operations.includes('question.create'))
  assert.ok(!operations.includes('practice.continue'))
  assert.ok(!operations.includes('question.request_next'))
})
