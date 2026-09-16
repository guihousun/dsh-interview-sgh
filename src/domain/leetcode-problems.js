import { assertDomain } from './errors.js'
import { LEETCODE_TOP_100, LEETCODE_TOP_100_GROUPS, leetcodeTop100Problem } from './leetcode-top-100.js'

export const LEETCODE_DIFFICULTY_IDS = Object.freeze(['easy', 'medium', 'hard'])
export const LEETCODE_CATEGORIES = Object.freeze(LEETCODE_TOP_100_GROUPS.map((group) => group.category))
export const LEETCODE_CUSTOM_CATEGORY = '自定义题目'

const DIFFICULTY_BY_LABEL = Object.freeze({
  简单: 'easy', 中等: 'medium', 困难: 'hard',
  easy: 'easy', medium: 'medium', hard: 'hard',
})

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function searchText(problem) {
  return `${problem.id} ${problem.title} ${problem.slug} ${problem.category}`.toLowerCase()
}

export function leetcodeDifficultyFromLabel(value) {
  const key = text(value)
  return DIFFICULTY_BY_LABEL[key] || DIFFICULTY_BY_LABEL[key.toLowerCase()] || ''
}

function matchesKeyword(problem, keyword) {
  const haystack = searchText(problem)
  return keyword.split(/\s+/).filter(Boolean).every((part) => haystack.includes(part))
}

function relevance(problem, keyword) {
  if (problem.id === keyword) return 0
  if (problem.slug === keyword) return 1
  if (problem.title === keyword) return 2
  if (problem.title.toLowerCase().includes(keyword)) return 3
  return 4
}

export function listLeetcodeProblems({ keyword, category, difficulty, limit = 20 } = {}) {
  const normalizedKeyword = text(keyword).toLowerCase()
  const normalizedCategory = text(category)
  const normalizedDifficulty = leetcodeDifficultyFromLabel(difficulty) || text(difficulty)
  const matched = LEETCODE_TOP_100
    .filter((problem) => !normalizedCategory || problem.category === normalizedCategory)
    .filter((problem) => !normalizedDifficulty || problem.difficulty === normalizedDifficulty)
    .filter((problem) => !normalizedKeyword || matchesKeyword(problem, normalizedKeyword))
  if (normalizedKeyword) matched.sort((left, right) => relevance(left, normalizedKeyword) - relevance(right, normalizedKeyword) || Number(left.id) - Number(right.id))
  const normalizedLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), LEETCODE_TOP_100.length) : 20
  return matched.slice(0, normalizedLimit).map((problem) => ({ ...problem }))
}

export function customLeetcodeProblem({ number, title, slug } = {}) {
  const customTitle = text(title)
  const customSlug = text(slug)
  const customNumber = text(number)
  assertDomain(
    Boolean(customTitle) || Boolean(customSlug),
    'LEETCODE_PROBLEM_REQUIRED',
    '自定义力扣题目至少需要题名或 slug',
  )
  const displayTitle = customTitle || customSlug
  return {
    id: customNumber,
    title: displayTitle,
    slug: customSlug,
    difficulty: '',
    category: LEETCODE_CUSTOM_CATEGORY,
    url: customSlug
      ? `https://leetcode.cn/problems/${customSlug}/`
      : `https://leetcode.cn/problemset/?search=${encodeURIComponent(displayTitle)}`,
    custom: true,
  }
}

export function leetcodeProblemQueryLabel(selection = {}) {
  return [text(selection.number), text(selection.title), text(selection.slug)].filter(Boolean).join(' · ') || '（空）'
}

// 把用户或模型给出的题号、题名、slug 解析成一道明确的力扣题。
// 命中固定热题 100 时使用官方元数据；未命中且给出了题名或 slug 时视为自定义题目。
export function resolveLeetcodeProblem(selection = {}) {
  // 已经解析过的自定义题目原样通过：应用层可能已经用题解库补齐了题号、难度和题型。
  if (selection.custom === true && text(selection.title)) {
    const customTitle = text(selection.title)
    const customSlug = text(selection.slug)
    return {
      id: text(selection.id) || text(selection.number),
      title: customTitle,
      slug: customSlug,
      difficulty: text(selection.difficulty),
      category: text(selection.category) || LEETCODE_CUSTOM_CATEGORY,
      url: text(selection.url) || (customSlug
        ? `https://leetcode.cn/problems/${customSlug}/`
        : `https://leetcode.cn/problemset/?search=${encodeURIComponent(customTitle)}`),
      custom: true,
    }
  }
  const slug = text(selection.slug)
  const number = text(selection.number)
  const title = text(selection.title)
  if (!slug && !number && !title) return null
  if (slug) {
    const bySlug = leetcodeTop100Problem(slug)
    if (bySlug) return { ...bySlug }
  }
  if (number) {
    const byNumber = LEETCODE_TOP_100.find((problem) => problem.id === number)
    if (byNumber && (!title || byNumber.title === title || byNumber.title.includes(title))) return { ...byNumber }
  }
  if (title) {
    const exact = LEETCODE_TOP_100.find((problem) => problem.title === title)
    if (exact) return { ...exact }
    const contained = LEETCODE_TOP_100.filter((problem) => problem.title.includes(title) || title.includes(problem.title))
    if (contained.length === 1) return { ...contained[0] }
    if (number) {
      const byNumberAndTitle = LEETCODE_TOP_100.find((problem) => problem.id === number)
      if (byNumberAndTitle) return { ...byNumberAndTitle }
    }
  }
  if (!title && !slug) return null
  return customLeetcodeProblem({ number, title, slug })
}

export function leetcodeSelectionFromProblem(problem) {
  if (!problem) return {}
  return problem.custom
    ? { number: problem.id, title: problem.title, slug: problem.slug }
    : { slug: problem.slug }
}
