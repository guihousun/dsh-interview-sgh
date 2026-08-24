import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearSessionQuestion,
  consumeSessionBinding,
  createSessionBinding,
  focusSessionQuestion,
  transferSessionBinding,
} from '../../src/domain/session.js'

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
