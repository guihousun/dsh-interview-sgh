import { normalizeLeetcodeMaterials, MATERIALS_LIMITS } from './leetcode-materials.js'

const MAX_TEXT = 4000

function text(value, maximum = MAX_TEXT) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized.length > maximum ? `${normalized.slice(0, maximum)}…` : normalized
}

function list(value, maximum, mapper) {
  return (Array.isArray(value) ? value : []).slice(0, maximum).map(mapper).filter(Boolean)
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => text(value)).filter(Boolean))]
}

// 题解库记录：官方题面（事实层）+ 用户题解笔记（参考层）。导入时统一清洗，读取时可直接用。
export function normalizeReferenceRecord(record = {}) {
  const slug = text(record.slug, 120)
  if (!slug) throw new TypeError('题解库记录缺少 slug')
  const examples = list(record.examples, MATERIALS_LIMITS.examples, (example) => {
    const input = text(example?.input, 400)
    const output = text(example?.output, 400)
    if (!input && !output) return null
    return { input, output, note: text(example?.note, 400) }
  })
  const variants = list(record.variants, 4, (variant) => {
    const kind = text(variant?.kind, 20)
    if (!kind) return null
    return {
      kind,
      idea: text(variant.idea),
      mnemonic: text(variant.mnemonic, 200),
      diagram: text(variant.diagram, 1200),
      code: text(variant.code, 4000),
      complexity: text(variant.complexity, 400),
    }
  })
  const hardcode = record.hardcode && (record.hardcode.code || record.hardcode.pseudocode)
    ? {
      mnemonic: text(record.hardcode.mnemonic, 200),
      pseudocode: text(record.hardcode.pseudocode, 1200),
      code: text(record.hardcode.code, 4000),
      complexity: text(record.hardcode.complexity, 400),
    }
    : null
  return {
    slug,
    number: text(record.number, 20),
    title: text(record.title, 120),
    titleEn: text(record.titleEn, 160),
    difficulty: text(record.difficulty, 20),
    category: text(record.category, 40),
    tags: uniqueStrings(record.tags || []).slice(0, 8),
    url: text(record.url, 300),
    statement: text(record.statement, 3000),
    examples,
    constraints: uniqueStrings(record.constraints || []).slice(0, MATERIALS_LIMITS.constraints),
    advanced: text(record.advanced, 600),
    idea: text(record.idea),
    mnemonic: text(record.mnemonic, 300),
    diagram: text(record.diagram, 1600),
    steps: text(record.steps, 2400),
    background: text(record.background, 2400),
    notes: text(record.notes, 2400),
    code: text(record.code, 4000),
    complexity: text(record.complexity, 600),
    variants,
    hardcode,
    sourceFile: text(record.sourceFile, 200),
    sourceAnchor: text(record.sourceAnchor, 200),
    // 官方题面来自实时抓取还是本地 CSV 快照，做题时可以据此判断新鲜度。
    officialSource: text(record.officialSource, 20),
    fetchedAt: Number(record.fetchedAt) || 0,
  }
}

export function normalizeTopicNotes(record = {}) {
  const category = text(record.category, 40)
  if (!category) throw new TypeError('专题笔记缺少 category')
  return {
    category,
    core: text(record.core, 400),
    topics: list(record.topics, 12, (topic) => {
      const title = text(topic?.title, 120)
      const detail = text(topic?.detail, 1600)
      return title && detail ? { title, detail } : null
    }),
    pitfalls: uniqueStrings(record.pitfalls || []).slice(0, 6),
    sourceFile: text(record.sourceFile, 200),
  }
}

export function referenceSourceLabel(reference) {
  if (!reference) return ''
  const anchor = reference.sourceAnchor ? ` ${reference.sourceAnchor.replace(/^#+\s*/, '')}` : ''
  return reference.sourceFile ? `${reference.sourceFile}${anchor ? ` ·${anchor}` : ''}` : ''
}

// 示例与数据范围属于事实：题解库里有官方版本时以官方为准，只覆盖这两项，其余表达仍由模型决定。
export function mergeOfficialFacts(materials, reference = null) {
  if (!reference) return materials
  const hasOfficialExamples = Array.isArray(reference.examples) && reference.examples.length > 0
  const hasOfficialConstraints = Array.isArray(reference.constraints) && reference.constraints.length > 0
  return {
    ...materials,
    statement: text(materials?.statement) || reference.statement,
    examples: hasOfficialExamples ? reference.examples.slice(0, MATERIALS_LIMITS.examples) : materials?.examples,
    constraints: hasOfficialConstraints ? reference.constraints.slice(0, MATERIALS_LIMITS.constraints) : materials?.constraints,
    source: {
      kind: 'model',
      official: hasOfficialExamples || hasOfficialConstraints,
      file: reference.sourceFile || '',
      anchor: reference.sourceAnchor || '',
      url: reference.url || '',
    },
  }
}

export function materialsWithReference(materials, reference = null) {
  return normalizeLeetcodeMaterials(mergeOfficialFacts(materials, reference))
}
