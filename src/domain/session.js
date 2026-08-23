import { assertDomain } from './errors.js'

export const SESSION_STAGES = Object.freeze({
  READY_FOR_QUESTION: 'ready_for_question',
  ANSWERABLE: 'answerable',
  NEEDS_EVALUATION: 'needs_evaluation',
  NEEDS_EXPLANATION: 'needs_explanation',
  REVIEWED: 'reviewed',
  SOLVING: 'solving',
  READY_FOR_NEXT: 'ready_for_next',
  COMPLETED: 'completed',
})

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

export function deriveSessionStage({ practice, question = null, leetcodeCompleted = false }) {
  assertDomain(practice && typeof practice === 'object', 'PRACTICE_REQUIRED', '练习不能为空')
  if (practice.status === 'completed') return SESSION_STAGES.COMPLETED
  if (!question) return SESSION_STAGES.READY_FOR_QUESTION
  if (question.leetcode) {
    return leetcodeCompleted ? SESSION_STAGES.READY_FOR_NEXT : SESSION_STAGES.SOLVING
  }
  const latestAttempt = question.attempts.at(-1) || null
  if (latestAttempt && !latestAttempt.evaluation) return SESSION_STAGES.NEEDS_EVALUATION
  if (latestAttempt?.evaluation && !question.explanation) return SESSION_STAGES.NEEDS_EXPLANATION
  if (question.explanation) return SESSION_STAGES.REVIEWED
  return SESSION_STAGES.ANSWERABLE
}

const READ_OPERATIONS = Object.freeze([
  'session.read',
  'practice.read',
  'question.read',
  'ui.show_question',
])

export function allowedOperationsFor({ practice, question = null, leetcodeCompleted = false }) {
  const stage = deriveSessionStage({ practice, question, leetcodeCompleted })
  const byStage = {
    [SESSION_STAGES.READY_FOR_QUESTION]: ['question.create', 'practice.complete'],
    [SESSION_STAGES.ANSWERABLE]: ['attempt.create', 'question.create', 'question.delete', 'explanation.create', 'practice.complete'],
    [SESSION_STAGES.NEEDS_EVALUATION]: ['evaluation.create', 'practice.complete'],
    [SESSION_STAGES.NEEDS_EXPLANATION]: ['explanation.create', 'practice.complete'],
    [SESSION_STAGES.REVIEWED]: ['question.create', 'attempt.create', 'question.delete', 'practice.complete'],
    [SESSION_STAGES.SOLVING]: ['leetcode.set_completion', 'leetcode.draw_next', 'explanation.create'],
    [SESSION_STAGES.READY_FOR_NEXT]: ['leetcode.set_completion', 'leetcode.draw_next', 'explanation.create'],
    [SESSION_STAGES.COMPLETED]: ['practice.reopen', 'practice.delete', 'practice.export'],
  }
  return Object.freeze([...new Set([...READ_OPERATIONS, ...(byStage[stage] || [])])])
}
