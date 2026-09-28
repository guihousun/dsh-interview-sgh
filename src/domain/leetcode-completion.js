import { leetcodeTop100Problem } from './leetcode-top-100.js'

// 勾选表示已经完成过作答，不表示在线判题通过；阅读题面/答案与无作答跳题不算完成。
export function leetcodeCompletionProgress(practice, { at = null, questionId = null, attemptId = null, historical = false, requireEvaluation = false } = {}) {
  if (practice.mode !== 'leetcode') return []
  const progress = new Map()
  for (const question of practice.questions) {
    if (questionId && question.id !== questionId) continue
    const slug = question.leetcode?.slug
    if (!leetcodeTop100Problem(slug) || !question.attempts.length) continue
    const attempts = attemptId ? question.attempts.filter((attempt) => attempt.id === attemptId) : question.attempts
    const evaluated = attempts.filter((attempt) => attempt.evaluation)
    if (requireEvaluation && !evaluated.length) continue
    const timestamps = [...evaluated.map((attempt) => Number(attempt.evaluation.evaluatedAt) || Number(attempt.submittedAt) || 0),
      practice.status === 'completed' ? Number(practice.completedAt) || 0 : 0].filter((time) => time > 0)
    const completedAt = historical ? Math.min(...timestamps) : Number(at)
    if (!Number.isFinite(completedAt) || !(completedAt > 0)) continue
    const answeredAt = Math.max(0, ...attempts.map((attempt) => Number(attempt.submittedAt) || 0))
    const previous = progress.get(slug)
    if (!previous || (historical ? previous.updatedAt > completedAt : previous.updatedAt < completedAt)) progress.set(slug,
      { slug, completed: true, completedAt, updatedAt: completedAt, answeredAt, automatic: true })
  }
  return [...progress.values()]
}
