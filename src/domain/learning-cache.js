import { createHash } from 'node:crypto'
import { effectiveLeetcodeGuidance } from './leetcode-guidance.js'
import { guidanceSource } from './question-learning.js'
import { assertSolutionCodeComments } from './solution-code-comments.js'
import { LEETCODE_LANGUAGES, leetcodeLanguageDefinition } from './leetcode-languages.js'

export const LEARNING_CACHE_VERSION = 1
export const LEARNING_REQUEST_TIMEOUT = 180000

// 抓取时间与文件路径不改变教学内容；题面、参考解法及教学规则变化才使缓存失效。
export function learningCacheContext(practice, question, kind, reference = null) {
  const problem = question.leetcode || question.hot100
  if (practice.mode !== 'leetcode' || !problem?.slug) return null
  const language = practice.config.language || 'python'
  const variant = kind === 'guidance' ? effectiveLeetcodeGuidance(practice.config) : 'reference'
  const content = reference ? {
    statement: reference.statement, examples: reference.examples, constraints: reference.constraints,
    advanced: reference.advanced, idea: reference.idea, code: reference.code, steps: reference.steps,
    complexity: reference.complexity, variants: reference.variants, background: reference.background,
  } : { slug: problem.slug, title: problem.title, url: problem.url }
  const fingerprint = createHash('sha256').update(JSON.stringify({ version: LEARNING_CACHE_VERSION, content })).digest('hex')
  return { key: [problem.slug, language, kind, variant, fingerprint].join(':'), slug: problem.slug, language, kind, variant, fingerprint }
}

export function reusableGuidance(practice, question) {
  const count = effectiveLeetcodeGuidance(practice.config) === 'guided' ? 4 : 3
  return guidanceSource(question) === 'ai' && question.materials.hints.length === count
}

export function reusableExplanation(practice, question) {
  if (!question.explanation || question.explanation.scope === 'attempt') return false
  // 旧讲解没有 scope；只回收没有作答的讲解，不把针对个人代码的修正版分享给其他练习。
  if (!question.explanation.scope && question.attempts.length) return false
  const language = leetcodeLanguageDefinition(practice.config.language)
  if (!language?.pattern.test(question.explanation.detail) || LEETCODE_LANGUAGES.some((item) => item.id !== language.id && item.pattern.test(question.explanation.detail))) return false
  try { assertSolutionCodeComments(question.explanation.detail, practice.config.language); return true } catch { return false }
}
