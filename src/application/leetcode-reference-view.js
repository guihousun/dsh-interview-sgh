// 给模型看的题解库视图：官方题面作为事实基线，用户笔记作为参考素材，来源可追溯。
// 只输出 JSON 友好的标量与数组，不携带任何宿主对象。

function text(value, maximum = 4000) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized.length > maximum ? `${normalized.slice(0, maximum)}…` : normalized
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => {
    if (item === null || item === undefined || item === '') return false
    if (Array.isArray(item)) return item.length > 0
    return true
  }))
}

export function referenceBrief(reference, { topicNotes = null, hardcode = null, question = null } = {}) {
  if (!reference) return null
  const notes = compact({
    idea: text(reference.idea),
    mnemonic: text(reference.mnemonic, 300),
    diagram: text(reference.diagram, 1600),
    steps: text(reference.steps, 2000),
    background: text(reference.background, 2000),
    code: text(reference.code, 4000),
    complexity: text(reference.complexity, 600),
    variants: reference.variants || [],
    extra: text(reference.notes, 2000),
  })
  return compact({
    question: question || null,
    problem: compact({
      slug: reference.slug,
      number: reference.number,
      title: reference.title,
      difficulty: reference.difficulty,
      category: reference.category,
      tags: reference.tags || [],
      url: reference.url,
    }),
    official: compact({
      statement: text(reference.statement, 3000),
      examples: reference.examples || [],
      constraints: reference.constraints || [],
      advanced: text(reference.advanced, 600),
    }),
    notes,
    hardcode: hardcode || reference.hardcode || null,
    topic: topicNotes
      ? compact({
        category: topicNotes.category,
        core: text(topicNotes.core, 400),
        topics: topicNotes.topics || [],
        pitfalls: topicNotes.pitfalls || [],
      })
      : null,
    source: compact({
      file: reference.sourceFile,
      anchor: reference.sourceAnchor,
      officialStatement: Boolean(reference.statement),
      officialFrom: reference.officialSource === 'live' ? 'leetcode.cn 实时抓取' : reference.officialSource === 'csv' ? '本地 CSV 快照（可能过时）' : '',
      fetchedAt: reference.fetchedAt ? new Date(reference.fetchedAt).toISOString().slice(0, 10) : '',
      note: '官方题面是事实基线：示例与数据范围必须与它一致；笔记只作参考，可以改写、补充或重写，不必照抄。',
    }),
  })
}

export function topicBrief(topicNotes, { category = '', related = [] } = {}) {
  if (!topicNotes) return null
  return compact({
    category: topicNotes.category || category,
    core: text(topicNotes.core, 400),
    topics: topicNotes.topics || [],
    pitfalls: topicNotes.pitfalls || [],
    related,
    source: compact({ file: topicNotes.sourceFile }),
  })
}

export function referenceSearchItem(reference) {
  return compact({
    slug: reference.slug,
    number: reference.number,
    title: reference.title,
    difficulty: reference.difficulty,
    category: reference.category,
    tags: reference.tags || [],
    url: reference.url,
    hasOfficialStatement: Boolean(reference.statement),
  })
}
