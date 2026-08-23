import test from 'node:test'
import assert from 'node:assert/strict'
import { getArtifactQuestionActions, isArtifactQuestionCurrent } from '../../src/client/features/question-actions.js'

const artifact = { practiceId: 'practice-1', questionId: 'question-1', sessionRevision: 3 }

function session(stage, overrides = {}) {
  return {
    selected: true,
    stage,
    revision: 3,
    currentQuestionId: 'question-1',
    practice: { id: 'practice-1' },
    ...overrides,
  }
}

test('只有当前会话绑定的题目被视为当前题', () => {
  assert.equal(isArtifactQuestionCurrent(session('answerable'), artifact), true)
  assert.equal(isArtifactQuestionCurrent(session('answerable', { currentQuestionId: 'question-2' }), artifact), false)
  assert.equal(isArtifactQuestionCurrent(session('answerable', { practice: { id: 'practice-2' } }), artifact), false)
  assert.equal(isArtifactQuestionCurrent(session('answerable', { revision: 4 }), artifact), false)
  assert.equal(isArtifactQuestionCurrent({ selected: false }, artifact), false)
})

test('当前待回答题目只允许查看答案', () => {
  assert.deepEqual(getArtifactQuestionActions(session('answerable'), artifact), {
    canReveal: true,
    canContinue: false,
    canRetry: false,
    canFinish: false,
  })
})

test('当前点评卡只在等待下一题阶段开放操作', () => {
  assert.deepEqual(getArtifactQuestionActions(session('reviewed'), artifact), {
    canReveal: false,
    canContinue: true,
    canRetry: true,
    canFinish: true,
  })
  assert.deepEqual(getArtifactQuestionActions(session('needs_explanation'), artifact), {
    canReveal: false,
    canContinue: false,
    canRetry: false,
    canFinish: false,
  })
})

test('历史题目在任何阶段都不能操作', () => {
  const historical = session('reviewed', { currentQuestionId: 'question-2' })
  assert.deepEqual(getArtifactQuestionActions(historical, artifact), {
    canReveal: false,
    canContinue: false,
    canRetry: false,
    canFinish: false,
  })
})
