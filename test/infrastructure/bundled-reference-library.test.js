import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { SqliteInterviewRepository } from '../../src/infrastructure/sqlite-interview-repository.js'
import { initializeBundledReferenceLibrary } from '../../src/infrastructure/bundled-reference-library.js'
import { createRuntime } from '../../src/adapters/dsh/plugin.js'
import { LEETCODE_TOP_100 } from '../../src/domain/leetcode-top-100.js'
import { assertSolutionCodeComments } from '../../src/domain/solution-code-comments.js'
import library from '../../src/data/hot100-reference-library.json' with { type: 'json' }

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-hot100-portable-'))
  const repository = new SqliteInterviewRepository(join(directory, 'interview.sqlite'))
  return { directory, repository, cleanup() {
    repository.close()
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep))
    rmSync(directory, { recursive: true, force: true })
  } }
}

test('发行快照完整覆盖 Hot100 的题面、解析、带注释代码及专题知识', () => {
  assert.equal(library.references.length, 100)
  assert.equal(new Set(library.references.map(r => r.slug)).size, 100)
  assert.equal(library.topics.length, 17)
  for (const category of new Set(library.references.map(r => r.category))) assert.ok(library.topics.some(t => t.category === category), category)
  for (const problem of LEETCODE_TOP_100) {
    const reference = library.references.find(r => r.slug === problem.slug)
    assert.ok(reference?.statement && reference.idea && reference.code && reference.examples.length && reference.constraints.length, problem.slug)
    for (const code of [reference.code, ...reference.variants.map(v => v.code), reference.hardcode?.code].filter(Boolean)) {
      assertSolutionCodeComments('```python\n' + code + '\n```', 'python')
    }
  }
})

test('空白电脑运行插件自动初始化，无需作者的数据库或笔记路径', async () => {
  const f = fixture()
  // 使用真正的 runtime 工厂，覆盖生产启动入口。
  f.repository.close()
  const runtime = createRuntime({}, { databasePath: join(f.directory, 'fresh.sqlite'), exportDirectory: join(f.directory, 'exports') })
  try {
    assert.deepEqual(await runtime.repository.referenceStats(), { total: 100, withNotes: 100, topics: 17 })
    const reference = await runtime.repository.findReference('set-matrix-zeroes')
    assert.ok(reference.statement && reference.code && reference.idea)
    assert.equal((await runtime.repository.listPractices()).length, 0)
    assert.equal(runtime.repository.database.prepare('SELECT count(*) count FROM attempts').get().count, 0)
  } finally {
    runtime.repository.close()
    assert.ok(resolve(f.directory).startsWith(resolve(tmpdir()) + sep))
    rmSync(f.directory, { recursive: true, force: true })
  }
})

test('升级仅补齐缺失记录，重复启动不覆盖个人题解、专题或练习数据', async () => {
  const f = fixture()
  try {
    await f.repository.saveReferenceLibrary({ references: [{ ...library.references[0], idea: '用户自行修改的思路', code: 'custom code' }],
      topics: [{ ...library.topics[0], core: '用户自行修改的专题' }], now: 42 })
    const saved = await f.repository.findReference(library.references[0].slug)
    assert.deepEqual(initializeBundledReferenceLibrary(f.repository), { references: 99, topics: 16 })
    assert.deepEqual(await f.repository.findReference(saved.slug), saved)
    assert.equal((await f.repository.findTopicNotes(library.topics[0].category)).core, '用户自行修改的专题')
    assert.deepEqual(initializeBundledReferenceLibrary(f.repository), { references: 0, topics: 0 })
    assert.deepEqual(await f.repository.findReference(saved.slug), saved)
    assert.deepEqual(await f.repository.listPractices(), [])
  } finally { f.cleanup() }
})

test('题库初始化失败会回滚整批写入，不留下半份快照', async () => {
  const f = fixture()
  try {
    assert.throws(() => f.repository.seedReferenceLibrary({ references: [library.references[0]], topics: [{ category: { invalid: true } }] }))
    assert.deepEqual(await f.repository.referenceStats(), { total: 0, withNotes: 0, topics: 0 })
  } finally { f.cleanup() }
})
