// 把「Hot100 题解」分册与 LeetCode 导出 CSV 解析成结构化题解记录。
// 只做「文本 → 对象」：不读文件、不碰数据库，方便单测与复用。

const VARIANT_PREFIXES = Object.freeze([
  ['更优版', 'better'],
  ['简单版', 'simple'],
])

const FILE_SECTION_FIELDS = Object.freeze([
  '题目', '背景知识', '思路', '口诀', '图解', '一步一步怎么做', 'Python', '复杂度', '注意', '易错点',
])

// LeetCode 导出的题面里上下标会退化成普通数字（10^4 写成 104、O(n²) 写成 O(n2)、10⁻⁵ 写成 10-5），
// 只改「出现在比较/乘法/负号语境里的 10 的幂」，避免误伤「第 104 号用例」这种普通数字。
export function normalizeSuperscripts(value) {
  return String(value ?? '')
    .replace(/(<=|>=|<|>|\*)\s*(10[4-9])(?![\d])/g, (_match, operator, power) => `${operator} ${power.slice(0, 2)}^${power.slice(2)}`)
    .replace(/(?<=^|[\s(（,，、])-(10[4-9])(?![\d])/gm, (_match, power) => `-${power.slice(0, 2)}^${power.slice(2)}`)
    .replace(/(?<![\d.])10-([1-9])(?![\d])/g, '10^-$1')
    .replace(/O\(n(\d)\)/g, 'O(n^$1)')
}

// 官方 GraphQL 的题面是 HTML：块级标签转换行、<li> 还原成 markdown 项目符号、<sup> 还原成 ^。
// 关键细节：官方文本里存在**未转义的裸 `<`**（例如 `-100 <= matrix[i][j]`），所以兜底剥标签必须要求标签名以字母开头，
// 否则会把 `<= ...` 直到下一个 `>` 的整段内容当成标签删掉。
export function htmlToText(html) {
  return String(html ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/<sup\s*>([^<]*)<\/sup>/gi, '^$1')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<\s*\/\s*(?:p|div|pre|ul|ol|h[1-6]|li|blockquote)\s*>/gi, '\n')
    .replace(/<\s*(?:p|div|pre|ul|ol|h[1-6]|blockquote)[^>]*>/gi, '\n')
    .replace(/<\s*\/?\s*(?:code|strong|em|b|i|u|s|span|a|sub|small|font|mark)[^>]*>/gi, '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
}

export function parseCsvRows(text) {  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const input = String(text ?? '').replace(/^\uFEFF/, '')
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') { field += '"'; index += 1 } else { quoted = false }
      } else field += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (char !== '\r') field += char
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter((item) => item.some((cell) => String(cell).trim() !== ''))
}

function trimLines(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function fenceContent(block, language = null) {
  const pattern = language
    ? new RegExp('```' + language + '\\s*\\n([\\s\\S]*?)```', 'i')
    : /```[a-z]*\s*\n([\s\S]*?)```/i
  const matched = pattern.exec(block || '')
  return matched ? trimLines(matched[1]) : ''
}

function textWithoutFences(block) {
  return trimLines(String(block ?? '').replace(/```[a-z]*\s*\n[\s\S]*?```/gi, ''))
}

function bulletLines(block) {
  return String(block ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)
}

// 官方题面（CSV content_cn 或题解里的「题目」段）统一切成 题意 / 示例 / 数据范围 / 进阶。
export function parseStatementBlocks(raw) {
  const text = normalizeSuperscripts(trimLines(raw))
  if (!text) return { statement: '', examples: [], constraints: [], advanced: '' }
  const markers = []
  // 官方 HTML 里标记行常带前导 &nbsp;（转成空格）或加粗包裹，所以允许行首尾空白。
  const examplePattern = /^[ \t]*示例\s*(\d*)\s*[：:][ \t]*$/gm
  const hintPattern = /^[ \t]*提示\s*[：:][ \t]*$/gm
  const advancedPattern = /^[ \t]*(?:进阶|进阶提示)\s*[：:][ \t]*/gm
  for (const match of text.matchAll(examplePattern)) markers.push({ kind: 'example', index: match.index, end: match.index + match[0].length })
  for (const match of text.matchAll(hintPattern)) markers.push({ kind: 'hint', index: match.index, end: match.index + match[0].length })
  for (const match of text.matchAll(advancedPattern)) markers.push({ kind: 'advanced', index: match.index, end: match.index + match[0].length })
  markers.sort((left, right) => left.index - right.index)

  const statement = trimLines(markers.length ? text.slice(0, markers[0].index) : text)
  const examples = []
  let constraints = []
  let advanced = ''
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index]
    const body = text.slice(marker.end, markers[index + 1]?.index ?? text.length)
    if (marker.kind === 'example') {
      // 两类写法：`输入：...`（带冒号，可同行可换行）与设计题的 `输入` + 多行 JSON（不带冒号）。
      const parts = { input: [], output: [], note: [] }
      let section = ''
      for (const rawLine of body.split('\n')) {
        const trimmed = rawLine.trim()
        const labeled = /^(输入|输出|解释|说明)\s*[：:]?\s*(.*)$/.exec(trimmed)
        if (labeled) {
          section = labeled[1] === '输入' ? 'input' : labeled[1] === '输出' ? 'output' : 'note'
          if (labeled[2]) parts[section].push(labeled[2])
          continue
        }
        if (section) parts[section].push(rawLine)
      }
      const input = trimLines(parts.input.join('\n'))
      const output = trimLines(parts.output.join('\n'))
      if (input || output) {
        examples.push({ input, output, note: trimLines(parts.note.join('\n')) })
      }
    } else if (marker.kind === 'hint') {
      constraints = bulletLines(body)
    } else if (marker.kind === 'advanced') {
      advanced = trimLines(body)
    }
  }
  return { statement, examples, constraints, advanced }
}

function headingLevel(line) {
  const match = /^(#{1,6})\s+(.*?)\s*$/.exec(line)
  return match ? { level: match[1].length, title: match[2] } : null
}

function variantOf(title) {
  for (const [prefix, variant] of VARIANT_PREFIXES) {
    if (title.startsWith(prefix)) {
      return { variant, field: title.slice(prefix.length).trim() }
    }
  }
  return { variant: 'default', field: title }
}

function normalizeFieldName(title) {
  const cleaned = title.replace(/[（(].*?[)）]\s*$/, '').trim()
  return FILE_SECTION_FIELDS.find((field) => cleaned === field || cleaned.startsWith(field)) || cleaned
}

function parseProblemHeading(title) {
  // 兼容 `## 1. 两数之和` 与硬背版的 `## 1. 哈希：1. 两数之和`
  const prefixed = /^(?:\d+\.\s*)?([^：:]{1,12})[：:]\s*(\d+)\.\s*(.+)$/.exec(title)
  if (prefixed) return { number: prefixed[2], title: prefixed[3].trim(), topic: prefixed[1].trim() }
  const plain = /^(\d+)\.\s*(.+)$/.exec(title)
  if (plain) return { number: plain[1], title: plain[2].trim(), topic: '' }
  return null
}

function slugFromBlock(block) {
  const matched = /leetcode\.cn\/problems\/([a-z0-9-]+)\//i.exec(block || '')
  return matched ? matched[1] : ''
}

// 分册里每个小节末尾常用 --- / *** 分隔，收进文本字段时要丢掉。
function stripTrailingRule(value) {
  const lines = String(value ?? '').split('\n')
  return trimLines(lines.filter((line, index) => {
    const isRule = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)
    return !(isRule && index >= lines.length - 2)
  }).join('\n'))
}
function emptyVariant() {
  return { statement: '', examples: [], constraints: [], advanced: '', idea: '', mnemonic: '', diagram: '', steps: '', background: '', code: '', complexity: '', notes: [] }
}

// 解析一册题解：文件级「预备课 / 前置知识」+ 每道题的思路、口诀、图解、代码与复杂度。
export function parseNotesMarkdown(text, { file = '' } = {}) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n')
  const problems = []
  const topics = []
  const filePitfalls = []
  let core = ''
  let current = null
  let currentTopic = null
  let variantKey = 'default'
  let fieldName = ''
  let buffer = []

  const flushField = () => {
    if (!current || !fieldName || !buffer.length) { buffer = []; return }
    const block = buffer.join('\n')
    const target = current.variants[variantKey] || (current.variants[variantKey] = emptyVariant())
    const field = normalizeFieldName(fieldName)
    if (field === '题目') {
      const blocks = parseStatementBlocks(block.replace(/^原题\s*[：:].*$/m, ''))
      target.statement = target.statement || blocks.statement
      if (!target.examples.length) target.examples = blocks.examples
      if (!target.constraints.length) target.constraints = blocks.constraints
      target.advanced = target.advanced || blocks.advanced
      target.slug = target.slug || slugFromBlock(block)
      target.notice = trimLines(textWithoutFences(block).split('\n').filter((line) => /注意|易错|出错/.test(line)).join('\n'))
    } else if (field === '思路') target.idea = trimLines(textWithoutFences(block))
    else if (field === '口诀') target.mnemonic = trimLines(textWithoutFences(block))
    else if (field === '图解') target.diagram = fenceContent(block) || trimLines(textWithoutFences(block))
    else if (field === '一步一步怎么做') target.steps = trimLines(textWithoutFences(block))
    else if (field === '背景知识') target.background = trimLines(textWithoutFences(block))
    else if (field === 'Python') target.code = target.code || fenceContent(block, 'python')
    else if (field === '复杂度') target.complexity = stripTrailingRule(textWithoutFences(block))
    else if (field) target.notes.push({ title: field, detail: trimLines(textWithoutFences(block)) })
    buffer = []
  }

  const flushTopic = () => {
    if (!currentTopic) return
    const detail = trimLines(textWithoutFences(currentTopic.buffer.join('\n')))
    if (detail) topics.push({ title: currentTopic.title, detail })
    currentTopic = null
  }

  const flushProblem = () => {
    if (!current) return
    flushField()
    const slug = current.variants.default?.slug || Object.values(current.variants).map((item) => item.slug).find(Boolean) || ''
    problems.push({
      number: current.number,
      title: current.title,
      slug,
      topic: current.topic,
      sourceFile: file,
      sourceAnchor: `## ${current.heading}`,
      variants: current.variants,
    })
    current = null
  }

  for (const line of lines) {
    if (/^#\s+/.test(line)) continue
    const heading = headingLevel(line)
    if (heading && heading.level === 2) {
      const problem = parseProblemHeading(heading.title)
      if (problem) {
        flushProblem()
        flushTopic()
        current = { ...problem, heading: heading.title, variants: { default: emptyVariant() } }
        variantKey = 'default'
        fieldName = ''
        continue
      }
      flushProblem()
      flushTopic()
      if (/预备课|前置知识|基础|总览|题目清单|专题题目/.test(heading.title)) {
        currentTopic = { title: '', buffer: [] }
      } else {
        // 「核心」小节之类：作为文件级说明收集
        currentTopic = null
      }
      continue
    }
    if (heading && heading.level === 3) {
      if (currentTopic && !current) {
        flushTopic()
        currentTopic = { title: heading.title, buffer: [] }
        continue
      }
      if (!current) continue
      flushField()
      const { variant, field } = variantOf(heading.title)
      variantKey = variant
      if (!current.variants[variantKey]) current.variants[variantKey] = emptyVariant()
      fieldName = field
      continue
    }
    if (current) { if (fieldName) buffer.push(line); continue }
    if (currentTopic) { if (currentTopic.title) currentTopic.buffer.push(line); continue }
    const coreMatched = /^核心\s*[：:]\s*(.+)$/.exec(line.trim())
    if (coreMatched) core = coreMatched[1].trim()
  }
  flushProblem()
  flushTopic()

  // 「要特别注意」这类文件级提醒：取标记后的项目符号列表。
  const noticeMatch = /(?:要特别注意|常见出错点|最容易出错)[^\n]*\n([\s\S]*?)(?:\n#{1,3}\s|\n速记|$)/.exec(text)
  if (noticeMatch) filePitfalls.push(...bulletLines(noticeMatch[1]))

  return { file, core, topics, pitfalls: filePitfalls, problems }
}

// 硬背版：`## 1. 哈希：1. 两数之和` + `题目：/口诀：/思路伪代码：` 字段式写法。
export function parseHardcodeMarkdown(text, { file = '' } = {}) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n')
  const problems = []
  let current = null
  let field = ''
  let buffer = []
  const flush = () => {
    if (!current || !field) { buffer = []; return }
    const block = buffer.join('\n')
    const target = current
    if (field === '题目') target.statement = trimLines(textWithoutFences(block))
    else if (field === '口诀') target.mnemonic = trimLines(textWithoutFences(block))
    else if (field === '思路伪代码' || field === '思路') target.pseudocode = fenceContent(block) || trimLines(textWithoutFences(block))
    else if (field === 'Python' || field === '代码') target.code = fenceContent(block, 'python') || fenceContent(block)
    else if (field === '复杂度') target.complexity = trimLines(textWithoutFences(block))
    else if (field) target.notes.push({ title: field, detail: trimLines(textWithoutFences(block)) })
    buffer = []
    field = ''
  }
  for (const line of lines) {
    const heading = headingLevel(line)
    if (heading && heading.level === 2) {
      flush()
      const problem = parseProblemHeading(heading.title)
      if (problem) {
        current = { ...problem, sourceFile: file, sourceAnchor: `## ${heading.title}`, statement: '', mnemonic: '', pseudocode: '', code: '', complexity: '', notes: [] }
        problems.push(current)
      } else {
        current = null
      }
      continue
    }
    if (!current) continue
    const fieldMatch = /^\*{0,2}(题目|口诀|思路伪代码|思路|Python|代码|复杂度|注意|易错点)\*{0,2}\s*[：:]\s*(.*)$/.exec(line.trim())
    if (fieldMatch) {
      flush()
      field = fieldMatch[1]
      if (fieldMatch[2]) buffer.push(fieldMatch[2])
      continue
    }
    // 硬背版里代码块没有字段标签：开栅栏按语言归位（text → 伪代码，python → 代码），闭栅栏即收尾。
    const fence = /^```([a-z]*)\s*$/.exec(line.trim())
    if (fence) {
      if (fence[1] && !field) {
        flush()
        field = fence[1].toLowerCase() === 'python' ? 'Python' : '思路伪代码'
      }
      buffer.push(line)
      if (!fence[1] && field) flush()
      continue
    }
    if (field) buffer.push(line)
  }
  flush()
  return { file, problems: problems.filter((problem) => problem.statement || problem.mnemonic || problem.code) }
}

export function parseLeetcodeCsv(text) {
  const rows = parseCsvRows(text)
  if (!rows.length) return []
  const header = rows[0].map((name) => String(name).trim())
  const index = Object.fromEntries(header.map((name, position) => [name, position]))
  const pick = (row, name) => (index[name] === undefined ? '' : String(row[index[name]] ?? '').trim())
  return rows.slice(1).map((row) => {
    const blocks = parseStatementBlocks(pick(row, 'content_cn'))
    return {
      slug: pick(row, 'title_slug'),
      number: pick(row, 'frontend_id'),
      title: pick(row, 'title_cn'),
      titleEn: pick(row, 'title_en'),
      difficulty: pick(row, 'difficulty').toLowerCase(),
      category: pick(row, 'group'),
      tags: pick(row, 'tags_cn').split('、').map((tag) => tag.trim()).filter(Boolean),
      url: pick(row, 'url'),
      ...blocks,
    }
  }).filter((record) => record.slug)
}

export { trimLines, fenceContent, textWithoutFences, bulletLines }
