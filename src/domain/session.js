import { assertDomain } from './errors.js'

function requiredId(value, code, message) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  assertDomain(normalized, code, message)
  return normalized
}

function revise(binding, patch, now) {
  return {
    ...binding,
    ...patch,
    revision: binding.revision + 1,
    updatedAt: now,
  }
}

export function createSessionBinding({ sessionId, practiceId, now }) {
  return {
    sessionId: requiredId(sessionId, 'INVALID_SESSION_ID', 'sessionId 不能为空'),
    practiceId: requiredId(practiceId, 'INVALID_PRACTICE_ID', 'practiceId 不能为空'),
    currentQuestionId: null,
    revision: 1,
    updatedAt: now,
  }
}

export function transferSessionBinding(binding, sessionId, now) {
  return revise(binding, {
    sessionId: requiredId(sessionId, 'INVALID_SESSION_ID', 'sessionId 不能为空'),
  }, now)
}

export function focusSessionQuestion(binding, questionId, now) {
  return revise(binding, {
    currentQuestionId: requiredId(questionId, 'INVALID_QUESTION_ID', 'questionId 不能为空'),
  }, now)
}

export function clearSessionQuestion(binding, now) {
  return revise(binding, { currentQuestionId: null }, now)
}

export function consumeSessionBinding(binding, now) {
  return revise(binding, {}, now)
}
