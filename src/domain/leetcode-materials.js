import { assertDomain } from './errors.js'

export const MATERIALS_LIMITS = Object.freeze({
  statement: 2000,
  examples: 4,
  exampleField: 300,
  constraints: 10,
  constraint: 300,
  hints: 4,
  hint: 400,
  knowledge: 4,
  knowledgeTitle: 60,
  knowledgeDetail: 600,
  pitfalls: 5,
  pitfall: 300,
  related: 5,
  relatedTitle: 80,
})

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function requiredText(value, code, message, maximum) {
  const normalized = text(value)
  assertDomain(Boolean(normalized), code, message)
  if (maximum) {
    assertDomain(normalized.length <= maximum, code, `${message}（最多 ${maximum} 个字符）`)
  }
  return normalized
}

function optionalText(value, maximum) {
  const normalized = text(value)
  return maximum ? normalized.slice(0, maximum) : normalized
}

function textList(value, { code, message, maximum, itemMaximum }) {
  const list = Array.isArray(value) ? value : []
  return list
    .map((item) => optionalText(item, itemMaximum))
    .filter(Boolean)
    .slice(0, maximum)
    .map((item) => {
      assertDomain(item.length > 0, code, message)
      return item
    })
}

function normalizeExamples(value) {
  const list = Array.isArray(value) ? value : []
  return list.slice(0, MATERIALS_LIMITS.examples).map((item, index) => {
    assertDomain(item && typeof item === 'object' && !Array.isArray(item), 'INVALID_MATERIALS_EXAMPLE', `第 ${index + 1} 个示例必须是对象`)
    return {
      input: requiredText(item.input, 'INVALID_MATERIALS_EXAMPLE', `第 ${index + 1} 个示例必须提供输入`, MATERIALS_LIMITS.exampleField),
      output: requiredText(item.output, 'INVALID_MATERIALS_EXAMPLE', `第 ${index + 1} 个示例必须提供输出`, MATERIALS_LIMITS.exampleField),
      note: optionalText(item.note, MATERIALS_LIMITS.exampleField),
    }
  })
}

function normalizeKnowledge(value) {
  const list = Array.isArray(value) ? value : []
  return list.slice(0, MATERIALS_LIMITS.knowledge).map((item, index) => {
    assertDomain(item && typeof item === 'object' && !Array.isArray(item), 'INVALID_MATERIALS_KNOWLEDGE', `第 ${index + 1} 个前置知识必须是对象`)
    return {
      title: requiredText(item.title, 'INVALID_MATERIALS_KNOWLEDGE', `第 ${index + 1} 个前置知识必须提供标题`, MATERIALS_LIMITS.knowledgeTitle),
      detail: requiredText(item.detail, 'INVALID_MATERIALS_KNOWLEDGE', `第 ${index + 1} 个前置知识必须提供说明`, MATERIALS_LIMITS.knowledgeDetail),
    }
  })
}

function normalizeRelated(value) {
  const list = Array.isArray(value) ? value : []
  return list.slice(0, MATERIALS_LIMITS.related).map((item, index) => {
    assertDomain(item && typeof item === 'object' && !Array.isArray(item), 'INVALID_MATERIALS_RELATED', `第 ${index + 1} 道相似题必须是对象`)
    const title = requiredText(item.title, 'INVALID_MATERIALS_RELATED', `第 ${index + 1} 道相似题必须提供题名`, MATERIALS_LIMITS.relatedTitle)
    const slug = optionalText(item.slug)
    return {
      id: optionalText(item.id, 20),
      title,
      slug,
      url: optionalText(item.url) || (slug ? `https://leetcode.cn/problems/${slug}/` : `https://leetcode.cn/problemset/?search=${encodeURIComponent(title)}`),
    }
  })
}

export function normalizeLeetcodeMaterials(input) {
  assertDomain(input && typeof input === 'object' && !Array.isArray(input), 'MATERIALS_REQUIRED', '必须提供题目材料')
  return {
    statement: requiredText(input.statement, 'INVALID_MATERIALS_STATEMENT', '题目材料必须包含题意说明', MATERIALS_LIMITS.statement),
    examples: normalizeExamples(input.examples),
    constraints: textList(input.constraints, {
      code: 'INVALID_MATERIALS_CONSTRAINTS', message: '数据范围必须是字符串', maximum: MATERIALS_LIMITS.constraints, itemMaximum: MATERIALS_LIMITS.constraint,
    }),
    hints: textList(input.hints, {
      code: 'INVALID_MATERIALS_HINTS', message: '提示必须是字符串', maximum: MATERIALS_LIMITS.hints, itemMaximum: MATERIALS_LIMITS.hint,
    }),
    knowledge: normalizeKnowledge(input.knowledge),
    pitfalls: textList(input.pitfalls, {
      code: 'INVALID_MATERIALS_PITFALLS', message: '常见误区必须是字符串', maximum: MATERIALS_LIMITS.pitfalls, itemMaximum: MATERIALS_LIMITS.pitfall,
    }),
    related: normalizeRelated(input.related),
  }
}

export function hintTotalOf(materials) {
  return Array.isArray(materials?.hints) ? materials.hints.length : 0
}

export function revealedHintsOf(question) {
  const total = hintTotalOf(question?.materials)
  const level = Number(question?.hintLevel)
  if (!Number.isFinite(level) || level <= 0) return 0
  return Math.min(Math.trunc(level), total)
}

export function hasMaterials(question) {
  return Boolean(question?.materials)
}
