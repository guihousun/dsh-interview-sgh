import { INTERVIEW_MODES } from '../domain/modes.js'
import { summarizePractice } from '../domain/practice.js'

function toSavedSummaryDto(summary) {
  if (!summary) return null
  if (summary.kind === 'leetcode') {
    return { ...summary, problems: summary.problems.map((problem) => ({ ...problem })) }
  }
  return { ...summary, strengths: [...summary.strengths], improvements: [...summary.improvements] }
}

export function toQuestionDto(question, practice = null) {
  const latestAttempt = question.attempts.at(-1) || null
  return {
    id: question.id,
    sequence: question.sequence,
    prompt: question.prompt,
    createdAt: question.createdAt,
    attempts: question.attempts.map((attempt) => ({
      id: attempt.id,
      sequence: attempt.sequence,
      answer: attempt.answer,
      submittedAt: attempt.submittedAt,
      evaluation: attempt.evaluation ? { ...attempt.evaluation, dimensions: { ...attempt.evaluation.dimensions } } : null,
    })),
    latestScore: latestAttempt?.evaluation?.score ?? null,
    explanation: question.explanation ? { ...question.explanation } : null,
    capabilities: { allowReveal: practice?.mode !== 'mock' },
    ...(question.leetcode ? { leetcode: { ...question.leetcode } } : {}),
    ...(question.hot100 ? { hot100: { ...question.hot100 } } : {}),
  }
}

export function toPracticeSummaryDto(practice) {
  const summary = summarizePractice(practice)
  return {
    id: practice.id,
    mode: practice.mode,
    modeLabel: INTERVIEW_MODES[practice.mode]?.label || practice.mode,
    topic: practice.topic,
    status: practice.status,
    createdAt: practice.createdAt,
    updatedAt: practice.updatedAt,
    completedAt: practice.completedAt,
    summary: toSavedSummaryDto(practice.summary),
    ...summary,
  }
}

export function toPracticeDetailDto(practice) {
  return {
    ...toPracticeSummaryDto(practice),
    source: { ...practice.source },
    config: { ...practice.config },
    questions: practice.questions.map((question) => toQuestionDto(question, practice)),
  }
}

export function toSessionContextDto(binding, practice) {
  if (!binding || !practice) return {
    selected: false,
    revision: 0,
    practice: null,
    currentQuestion: null,
  }
  const question = practice.questions.find((item) => item.id === binding.currentQuestionId) || null
  return {
    selected: true,
    sessionId: binding.sessionId,
    revision: binding.revision,
    currentQuestionId: binding.currentQuestionId,
    practice: toPracticeDetailDto(practice),
    currentQuestion: question ? toQuestionDto(question, practice) : null,
  }
}

export function buildInsights(practices) {
  const completedAttempts = practices.flatMap((practice) => practice.questions.flatMap((question) =>
    question.attempts.filter((attempt) => attempt.evaluation).map((attempt) => ({ practice, attempt }))))
  const topicMap = new Map()
  for (const { practice, attempt } of completedAttempts) {
    const stats = topicMap.get(practice.topic) || { topic: practice.topic, evaluatedCount: 0, scoreTotal: 0 }
    stats.evaluatedCount += 1
    stats.scoreTotal += attempt.evaluation.score
    topicMap.set(practice.topic, stats)
  }
  const topics = [...topicMap.values()].map((stats) => ({
    topic: stats.topic,
    evaluatedCount: stats.evaluatedCount,
    averageScore: Math.round((stats.scoreTotal / stats.evaluatedCount) * 10) / 10,
  })).sort((left, right) => left.averageScore - right.averageScore)
  const averageScore = completedAttempts.length
    ? Math.round((completedAttempts.reduce((sum, item) => sum + item.attempt.evaluation.score, 0) / completedAttempts.length) * 10) / 10
    : null
  return {
    practiceCount: practices.length,
    questionCount: practices.reduce((sum, practice) => sum + practice.questions.length, 0),
    evaluatedCount: completedAttempts.length,
    averageScore,
    weakestTopic: topics[0] || null,
    topics,
  }
}
