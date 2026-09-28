#!/usr/bin/env node
// 应用逐份审核的精确题解版本，只更新题解字段；事先备份，不修改用户练习和作答。
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { defaultDatabasePath } from '../src/infrastructure/paths.js'
import { reviewReferenceCode, referenceCodeReview } from '../src/domain/reviewed-reference-code.js'

function option(name) { const index = process.argv.indexOf(name); return index < 0 ? '' : process.argv[index + 1] || '' }
const file = resolve(option('--database') || defaultDatabasePath())
const backupDirectory = option('--backup-directory')
if (!backupDirectory || !existsSync(file)) throw new Error('请提供 --backup-directory 并确认题解数据库已存在')
const backup = resolve(backupDirectory)
mkdirSync(backup, { recursive: true })
const database = new DatabaseSync(file)
database.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE')
try {
  const rows = database.prepare('SELECT * FROM leetcode_reference ORDER BY CAST(number AS INTEGER)').all()
  const backupFile = join(backup, `reference-before-${Date.now()}.json`)
  writeFileSync(backupFile, JSON.stringify(rows, null, 2), { encoding: 'utf8', flag: 'wx' })
  const update = database.prepare('UPDATE leetcode_reference SET code=?, idea=?, steps=?, complexity=?, variants_json=?, hardcode_json=?, updated_at=? WHERE slug=?')
  let changed = 0, mainAnswers = 0, codeVersions = 0
  const now = Date.now()
  for (const row of rows) {
    const result = reviewReferenceCode({ slug: row.slug, code: row.code || '', idea: row.idea || '', steps: row.steps || '',
      complexity: row.complexity || '', variants: JSON.parse(row.variants_json || '[]'), hardcode: JSON.parse(row.hardcode_json || 'null') })
    const values = [result.code, result.idea, result.steps, result.complexity, JSON.stringify(result.variants), result.hardcode ? JSON.stringify(result.hardcode) : null]
    const before = [row.code || '', row.idea || '', row.steps || '', row.complexity || '', row.variants_json || '[]', row.hardcode_json]
    if (values.some((value,index) => value !== before[index])) { update.run(...values, now, row.slug); changed += 1 }
    if (result.code) mainAnswers += 1
    codeVersions += Number(Boolean(result.code)) + result.variants.filter((variant) => variant.code).length + Number(Boolean(result.hardcode?.code))
  }
  database.exec('COMMIT')
  console.log(JSON.stringify({ ...referenceCodeReview, totalProblems: rows.length, changed, mainAnswers, codeVersions, backupFile }, null, 2))
} catch (error) {
  database.exec('ROLLBACK'); throw error
} finally { database.close() }
