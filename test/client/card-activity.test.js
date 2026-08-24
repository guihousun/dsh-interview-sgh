import test from 'node:test'
import assert from 'node:assert/strict'
import { isCardActive } from '../../src/client/shared/card-activity.js'

const artifact = { practiceId: 'practice-1', questionId: 'question-1', sessionRevision: 3 }

function session(overrides = {}) {
  return {
    selected: true,
    revision: 3,
    currentQuestionId: 'question-1',
    practice: { id: 'practice-1' },
    ...overrides,
  }
}

test('卡片只根据会话绑定和修订号判断是否有效', () => {
  assert.equal(isCardActive(session(), artifact), true)
  assert.equal(isCardActive(session({ currentQuestionId: 'question-2' }), artifact), false)
  assert.equal(isCardActive(session({ practice: { id: 'practice-2' } }), artifact), false)
  assert.equal(isCardActive(session({ revision: 4 }), artifact), false)
  assert.equal(isCardActive({ selected: false }, artifact), false)
})
