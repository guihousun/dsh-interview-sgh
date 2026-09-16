#!/usr/bin/env node
// 把「Hot100 题解」目录导入本地题解库：官方题面（事实层）+ 用户题解笔记（参考层）。
//
// 用法：
//   node scripts/import-leetcode-reference.mjs --notes <题解目录> [选项]
//
// 选项：
//   --official live|csv   题面来源：live=实时抓取 leetcode.cn（默认，逐题失败时回退 CSV），csv=只用本地快照
//   --verify              只核对与当前库/CSV 的漂移，不写库
//   --profile <name>      读写哪个 profile 的数据库（默认 web）
//   --database <path>     直接指定数据库文件
//   --limit <n>           只处理前 n 道题（调试用）
//
// 说明：题解库只写本地 SQLite；官方题面在导入时抓取并缓存到 --notes 目录，不会打进 npm 包。

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SqliteInterviewRepository } from '../src/infrastructure/sqlite-interview-repository.js'
import { defaultDatabasePath } from '../src/infrastructure/paths.js'
import {
  htmlToText, parseCsvRows, parseHardcodeMarkdown, parseNotesMarkdown, parseStatementBlocks, normalizeSuperscripts,
} from '../src/infrastructure/leetcode-reference-parser.js'
import { normalizeReferenceRecord, normalizeTopicNotes } from '../src/domain/leetcode-reference.js'
import { LEETCODE_TOP_100 } from '../src/domain/leetcode-top-100.js'

const QUESTION_QUERY = `query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId title translatedTitle difficulty translatedContent content
    topicTags { name slug }
  }
}`

function parseArgs(argv) {
  const options = { official: 'live', verify: false, notes: '', profile: 'web', database: '', limit: 0 }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--notes') options.notes = argv[++index] || ''
    else if (flag === '--official') options.official = argv[++index] || 'live'
    else if (flag === '--verify') options.verify = true
    else if (flag === '--profile') options.profile = argv[++index] || 'web'
    else if (flag === '--database') options.database = argv[++index] || ''
    else if (flag === '--limit') options.limit = Number(argv[++index]) || 0
    else if (flag === '--help' || flag === '-h') options.help = true
  }
  return options
}

const HELP = readFileSync(new URL(import.meta.url), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('//'))
  .join('\n')
  .replace(/^\/\/ ?/gm, '')

function readCsvIndex(notesDir) {
  const file = readdirSync(notesDir).find((name) => name.toLowerCase().endsWith('.csv'))
  if (!file) return { rows: new Map(), file: '' }
  const text = readFileSync(join(notesDir, file), 'utf8')
  const rows = parseCsvRows(text)
  const header = rows[0].map((name) => String(name).trim())
  const index = Object.fromEntries(header.map((name, position) => [name, position]))
  const bySlug = new Map()
  for (const row of rows.slice(1)) {
    const slug = String(row[index.title_slug] ?? '').trim()
    if (!slug) continue
    bySlug.set(slug, {
      number: String(row[index.frontend_id] ?? '').trim(),
      title: String(row[index.title_cn] ?? '').trim(),
      titleEn: String(row[index.title_en] ?? '').trim(),
      difficulty: String(row[index.difficulty] ?? '').trim().toLowerCase(),
      category: String(row[index.group] ?? '').trim(),
      tags: String(row[index.tags_cn] ?? '').split('、').map((tag) => tag.trim()).filter(Boolean),
      url: String(row[index.url] ?? '').trim(),
      content: String(row[index.content_cn] ?? ''),
    })
  }
  return { rows: bySlug, file }
}

// 解析题解目录：18 册分册 + 硬背版；同一道题在多册出现时以先出现的为主，硬背版只补代码与伪代码。
function readNotes(notesDir) {
  const files = readdirSync(notesDir).filter((name) => name.toLowerCase().endsWith('.md')).sort()
  const bySlug = new Map()
  const topics = new Map()
  const fileCategories = new Map()
  for (const file of files) {
    const text = readFileSync(join(notesDir, file), 'utf8')
    if (/硬背版/.test(file)) {
      for (const problem of parseHardcodeMarkdown(text, { file }).problems) {
        const slug = slugOfHardcode(problem, bySlug)
        if (!slug) continue
        const existing = bySlug.get(slug) || { slug, sourceFile: file, sourceAnchor: problem.sourceAnchor }
        existing.hardcode = {
          mnemonic: problem.mnemonic,
          pseudocode: problem.pseudocode,
          code: problem.code,
          complexity: problem.complexity,
        }
        bySlug.set(slug, existing)
      }
      continue
    }
    const parsed = parseNotesMarkdown(text, { file })
    const categories = new Set()
    for (const problem of parsed.problems) {
      if (!problem.slug) continue
      const main = problem.variants.default || {}
      const variants = Object.entries(problem.variants)
        .filter(([kind]) => kind !== 'default')
        .map(([kind, value]) => ({
          kind: kind === 'better' ? '更优版' : kind === 'simple' ? '简单版' : kind,
          idea: value.idea,
          mnemonic: value.mnemonic,
          diagram: value.diagram,
          code: value.code,
          complexity: value.complexity,
        }))
      const existing = bySlug.get(problem.slug) || {}
      bySlug.set(problem.slug, {
        ...existing,
        slug: problem.slug,
        sourceFile: file,
        sourceAnchor: problem.sourceAnchor,
        idea: existing.idea || main.idea || '',
        mnemonic: existing.mnemonic || main.mnemonic || '',
        diagram: existing.diagram || main.diagram || '',
        steps: existing.steps || main.steps || '',
        background: existing.background || main.background || '',
        notes: existing.notes || main.notice || main.notes?.map((item) => `${item.title}：${item.detail}`).join('\n') || '',
        code: existing.code || main.code || '',
        complexity: existing.complexity || main.complexity || '',
        variants: [...(existing.variants || []), ...variants],
      })
    }
    if (parsed.topics.length || parsed.pitfalls.length) {
      topics.set(file, normalizeTopicNotes({
        category: file.replace(/^Hot100_/, '').replace(/题解\.md$/, ''),
        core: parsed.core,
        topics: parsed.topics.map((topic) => ({ title: topic.title, detail: topic.detail })),
        pitfalls: parsed.pitfalls,
        sourceFile: file,
      }))
    }
    if (categories.size) fileCategories.set(file, categories)
  }
  return { bySlug, topics, fileCategories }
}

// 硬背版只有题名，没有原题链接：按题名回查热题 100 得到 slug。
function slugOfHardcode(problem, bySlug) {
  const known = LEETCODE_TOP_100.find((item) => item.title === problem.title && item.id === problem.number)
  if (known) return known.slug
  for (const [slug, value] of bySlug) {
    if (value.title === problem.title) return slug
  }
  return ''
}

async function fetchOfficial(slug, host = 'leetcode.cn') {
  const response = await fetch(`https://${host}/graphql/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      referer: `https://${host}/problems/${slug}/`,
      origin: `https://${host}`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
    body: JSON.stringify({ query: QUESTION_QUERY, variables: { titleSlug: slug }, operationName: 'questionData' }),
  })
  const payload = await response.json().catch(() => null)
  const question = payload?.data?.question
  if (!question) return null
  return {
    number: question.questionFrontendId,
    title: question.translatedTitle || question.title,
    titleEn: question.title,
    difficulty: String(question.difficulty || '').toLowerCase(),
    tags: (question.topicTags || []).map((tag) => tag.name),
    content: question.translatedContent || question.content || '',
  }
}

async function loadOfficial(slugs, notesDir, mode) {
  const cacheFile = join(notesDir, '.official-cache.json')
  const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {}
  if (mode !== 'live') return { official: new Map(), cache, cacheFile, fetched: 0 }
  const pending = slugs.filter((slug) => !cache[slug])
  let fetched = 0
  if (pending.length) {
    process.stdout.write(`抓取官方题面 ${pending.length} 道（并发 3）…\n`)
    const queue = [...pending]
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (queue.length) {
        const slug = queue.shift()
        try {
          cache[slug] = (await fetchOfficial(slug)) || { missing: true }
        } catch (error) {
          cache[slug] = { error: String(error?.message || error) }
        }
        fetched += 1
        if (fetched % 20 === 0) process.stdout.write(`  …${fetched}/${pending.length}\n`)
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }))
    writeFileSync(cacheFile, JSON.stringify(cache, null, 0))
  }
  const official = new Map()
  for (const slug of slugs) {
    const entry = cache[slug]
    if (entry && !entry.missing && !entry.error) official.set(slug, entry)
  }
  return { official, cache, cacheFile, fetched }
}

function buildRecords({ bySlug, csv, official, mode, now }) {
  const records = []
  const missing = []
  for (const problem of LEETCODE_TOP_100) {
    const notes = bySlug.get(problem.slug)
    const snapshot = csv.rows.get(problem.slug)
    const live = official.get(problem.slug)
    const source = live ? 'live' : snapshot ? 'csv' : notes ? 'notes' : ''
    const blocks = source === 'live'
      ? parseStatementBlocks(htmlToText(live.content))
      : source === 'csv'
        ? parseStatementBlocks(snapshot.content)
        : { statement: '', examples: [], constraints: [], advanced: '' }
    if (!notes && !live && !snapshot) { missing.push(problem.slug); continue }
    records.push(normalizeReferenceRecord({
      slug: problem.slug,
      number: live?.number || snapshot?.number || problem.id,
      title: live?.title || snapshot?.title || problem.title,
      titleEn: live?.titleEn || snapshot?.titleEn || '',
      difficulty: String(live?.difficulty || snapshot?.difficulty || problem.difficulty).toLowerCase(),
      category: snapshot?.category || problem.category,
      tags: live?.tags?.length ? live.tags : snapshot?.tags || [],
      url: snapshot?.url || `https://leetcode.cn/problems/${problem.slug}/`,
      statement: blocks.statement,
      examples: blocks.examples,
      constraints: blocks.constraints,
      advanced: blocks.advanced,
      idea: notes?.idea || '',
      mnemonic: notes?.mnemonic || '',
      diagram: notes?.diagram || '',
      steps: notes?.steps || '',
      background: notes?.background || '',
      notes: notes?.notes || '',
      code: notes?.code || '',
      complexity: notes?.complexity || '',
      variants: notes?.variants || [],
      hardcode: notes?.hardcode || null,
      sourceFile: notes?.sourceFile || '',
      sourceAnchor: notes?.sourceAnchor || '',
      officialSource: source === 'live' ? 'live' : source === 'csv' ? 'csv' : 'notes',
      fetchedAt: now,
    }))
  }
  return { records, missing, mode }
}

// 漂移核对：本地快照 vs 实时官方，按「逐字一致 / 仅空白 / 仅丢上下标 / 真有变化」分类。
function compareDrift(records, csv, cache) {
  const squash = (value) => normalizeSuperscripts(value).replace(/\s+/g, '').replace(/\*\*/g, '')
  const dropCaret = (value) => squash(value).replace(/\^/g, '')
  const buckets = { identical: [], whitespace: [], superscript: [], changed: [] }
  for (const record of records) {
    const entry = cache[record.slug]
    const snapshot = csv.rows.get(record.slug)
    if (!entry || entry.missing || entry.error || !snapshot) continue
    const csvBlocks = parseStatementBlocks(snapshot.content)
    const apiBlocks = parseStatementBlocks(htmlToText(entry.content))
    const left = [csvBlocks.statement, ...csvBlocks.examples.flatMap((e) => [e.input, e.output, e.note]), ...csvBlocks.constraints, csvBlocks.advanced]
    const right = [apiBlocks.statement, ...apiBlocks.examples.flatMap((e) => [e.input, e.output, e.note]), ...apiBlocks.constraints, apiBlocks.advanced]
    const label = `${record.number}. ${record.title}`
    if (JSON.stringify(left) === JSON.stringify(right)) buckets.identical.push(label)
    else if (JSON.stringify(left.map(squash)) === JSON.stringify(right.map(squash))) buckets.whitespace.push(label)
    else if (JSON.stringify(left.map(dropCaret)) === JSON.stringify(right.map(dropCaret))) buckets.superscript.push(label)
    else {
      const diffs = []
      if (dropCaret(csvBlocks.statement) !== dropCaret(apiBlocks.statement)) diffs.push('题意')
      if (JSON.stringify(csvBlocks.examples.map((e) => [e.input, e.output, e.note].map(dropCaret))) !== JSON.stringify(apiBlocks.examples.map((e) => [e.input, e.output, e.note].map(dropCaret)))) diffs.push('示例')
      if (JSON.stringify(csvBlocks.constraints.map(dropCaret)) !== JSON.stringify(apiBlocks.constraints.map(dropCaret))) diffs.push('数据范围')
      buckets.changed.push(`${label}（${diffs.join('、') || '示例解释'}）`)
    }
  }
  return buckets
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help || !options.notes) { process.stdout.write(HELP); return options.help ? 0 : 1 }
  if (!existsSync(options.notes)) { process.stderr.write(`题解目录不存在：${options.notes}\n`); return 1 }
  const now = Date.now()
  process.stdout.write(`题解目录：${options.notes}\n`)

  const csv = readCsvIndex(options.notes)
  const { bySlug, topics } = readNotes(options.notes)
  process.stdout.write(`读到题解笔记 ${bySlug.size} 道、专题前置知识 ${topics.size} 组；CSV 快照 ${csv.rows.size} 行${csv.file ? `（${csv.file}）` : ''}\n`)

  const allSlugs = LEETCODE_TOP_100.map((problem) => problem.slug)
  const { official, cache } = await loadOfficial(allSlugs, options.notes, options.official)
  const { records, missing } = buildRecords({ bySlug, csv, official, mode: options.official, now })
  const limited = options.limit ? records.slice(0, options.limit) : records
  const liveCount = limited.filter((record) => record.officialSource === 'live').length
  const csvCount = limited.filter((record) => record.officialSource === 'csv').length
  process.stdout.write(`构建题解 ${limited.length} 条（题面：实时 ${liveCount} / CSV 快照 ${csvCount}）\n`)
  if (missing.length) process.stdout.write(`没有题面也没有笔记：${missing.join(', ')}\n`)

  if (options.verify) {
    const buckets = compareDrift(records, csv, cache)
    process.stdout.write([
      '\n=== 本地 CSV 快照 vs 实时官方 ===',
      `逐字一致            : ${buckets.identical.length}`,
      `仅空白/缩进差异     : ${buckets.whitespace.length}`,
      `仅快照丢上下标      : ${buckets.superscript.length}`,
      `确有内容变化        : ${buckets.changed.length}`,
      ...buckets.changed.map((item) => `  - ${item}`),
      '',
    ].join('\n'))
    return buckets.changed.length ? 0 : 0
  }

  // 专题前置知识按册覆盖的题型落库：一册覆盖多个题型时（回溯与二分查找）两边都挂。
  const topicRecords = []
  for (const [file, topic] of topics) {
    const categories = new Set()
    for (const record of records) {
      if (record.sourceFile === file && record.category) categories.add(record.category)
    }
    if (!categories.size && file.includes('哈希')) categories.add('哈希')
    for (const category of categories) topicRecords.push({ ...topic, category })
  }

  const databasePath = options.database || (options.profile === 'web' ? defaultDatabasePath() : defaultDatabasePath())
  const repository = new SqliteInterviewRepository(databasePath)
  try {
    const result = await repository.saveReferenceLibrary({ references: limited, topics: topicRecords, now })
    const stats = await repository.referenceStats()
    process.stdout.write([
      `\n已写入题解库：${databasePath}`,
      `  题目 ${result.references} 条，专题前置知识 ${result.topics} 组`,
      `  库内合计：题目 ${stats.total}、其中有笔记 ${stats.withNotes}、专题 ${stats.topics}`,
      '',
      '下一步：重启 dsh web 后，模型在出题/讲解前会先用 interview_notes read 取证；',
      '材料里的示例与数据范围会自动以官方题面为准，并标注来源。',
      '',
    ].join('\n'))
  } finally {
    repository.close()
  }
  return 0
}

process.exitCode = await main()
