import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { createPractice, askQuestion, submitAnswer, evaluateAnswer, revealHint, saveExplanation, saveMaterials } from '../../src/domain/practice.js'
import { normalizeReferenceRecord, normalizeTopicNotes } from '../../src/domain/leetcode-reference.js'
import { createSessionBinding, focusSessionQuestion, transferSessionBinding } from '../../src/domain/session.js'
import { SqliteInterviewRepository } from '../../src/infrastructure/sqlite-interview-repository.js'

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-interview-sqlite-'))
  const repository = new SqliteInterviewRepository(join(directory, 'interview.sqlite'))
  return { repository, cleanup() { repository.close(); rmSync(directory, { recursive: true, force: true }) } }
}

function aggregate() {
  let practice = createPractice({
    id: 'practice-1', mode: 'resume_drill',
    config: {
      resume: 'Java 后端简历', targetRole: '后端开发工程师', jobDescriptionProvided: true,
      jobDescription: '负责服务端开发。', focus: '项目难点与技术选型', difficulty: 'intermediate',
    },
    now: 1,
  })
  practice = askQuestion(practice, { id: 'question-1', prompt: '解释 happens-before。', now: 2 }).practice
  practice = submitAnswer(practice, { questionId: 'question-1', attemptId: 'attempt-1', answer: '它描述可见性顺序。', now: 3 }).practice
  practice = evaluateAnswer(practice, { questionId: 'question-1', attemptId: 'attempt-1', score: 8.5, feedback: '准确。', dimensions: { accuracy: 9 }, now: 4 }).practice
  practice = saveExplanation(practice, { questionId: 'question-1', detail: '前一个操作的结果对后一个操作可见。', memorizationPoints: '可见性与有序性。', now: 5 }).practice
  const binding = focusSessionQuestion(createSessionBinding({ sessionId: 'session-1', practiceId: practice.id, now: 1 }), 'question-1', 2)
  return { practice, binding }
}

test('题库缓存与生成锁随 SQLite 重启保留，多个连接共同去重，删练习保留缓存', async () => {
  const context = fixture(), other = new SqliteInterviewRepository(context.repository.filePath)
  try {
    const entry = { key: 'merge-intervals:python:guidance:guided:v1', slug: 'merge-intervals', language: 'python',
      kind: 'guidance', variant: 'guided', fingerprint: 'v1' }
    const first = await context.repository.reserveLearningRequest(entry, { requestId: 'r1', questionId: 'q1', now: 100, timeout: 180000 })
    assert.equal(first.claimed, true)
    const duplicate = await other.reserveLearningRequest(entry, { requestId: 'r2', questionId: 'q2', now: 110, force: true, timeout: 180000 })
    assert.equal(duplicate.claimed, false)
    assert.equal((await other.getLearningCache(entry.key)).requestId, 'r1')
    assert.equal((await other.findLearningRequest('q1', 'guidance')).key, entry.key)
    const payload = { hints: ['已保存提示'] }
    await context.repository.commit({ ...aggregate(), learningCache: [{ ...entry, requestId: 'r1', payload,
      originQuestionId: 'q1', createdAt: 120, updatedAt: 120 }] })
    assert.deepEqual((await other.getLearningCache(entry.key)).payload, payload)
    assert.equal((await other.getLearningCache(entry.key)).requestId, null)
    await context.repository.deletePractice('practice-1')
    assert.equal((await other.getLearningCache(entry.key)).status, 'ready')
    const restarted = new SqliteInterviewRepository(context.repository.filePath)
    try { assert.deepEqual((await restarted.getLearningCache(entry.key)).payload, payload) } finally { restarted.close() }
  } finally { other.close(); context.cleanup() }
})

test('旧生成结果不能覆盖新请求或修改练习，失败状态保留已完成缓存', async () => {
  const context = fixture()
  try {
    const entry = { key: 'test-key', slug: 'merge-intervals', language: 'python', kind: 'solution', variant: 'reference', fingerprint: 'v1' }
    const payload = { detail: '已有完整讲解' }
    assert.equal(await context.repository.seedLearningCache({ ...entry, payload, originQuestionId: 'q1', createdAt: 1, updatedAt: 1 }), true)
    assert.equal(await context.repository.seedLearningCache({ ...entry, payload: { detail: '不得覆盖' }, originQuestionId: 'q2', createdAt: 2, updatedAt: 2 }), false)
    const original = aggregate()
    await context.repository.commit(original)
    const request = await context.repository.reserveLearningRequest(entry, { requestId: 'new', questionId: 'q1', now: 10, force: true, timeout: 180000 })
    assert.equal(request.claimed, true)
    const revised = { ...original.practice, topic: '不应写入' }
    await assert.rejects(context.repository.commit({ practice: revised, learningCache: [{ ...entry, payload: { detail: '迟到结果' },
      requestId: 'old', originQuestionId: 'q1', createdAt: 11, updatedAt: 11 }] }), /旧结果没有覆盖/)
    assert.deepEqual(await context.repository.getPractice(original.practice.id), original.practice)
    assert.deepEqual((await context.repository.getLearningCache(entry.key)).payload, payload)
    await context.repository.failLearningRequest(entry.key, 'new', '服务暂不可用')
    assert.equal((await context.repository.getLearningCache(entry.key)).status, 'failed')
    assert.deepEqual((await context.repository.getLearningCache(entry.key)).payload, payload)
  } finally { context.cleanup() }
})

test('SQLite 事务保存并恢复完整聚合与无阶段会话绑定', async () => {
  const context = fixture()
  try {
    const { practice, binding } = aggregate()
    await context.repository.commit({ practice, binding })
    assert.deepEqual(await context.repository.getPractice(practice.id), practice)
    assert.deepEqual(await context.repository.getSessionBinding(binding.sessionId), binding)
    assert.equal(context.repository.database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_cursors'").get(), undefined)
  } finally { context.cleanup() }
})

test('完成标记与作答聚合事务提交，标记写入失败时不留下半份点评', async () => {
  const context = fixture()
  try {
    const original = aggregate()
    await context.repository.commit(original)
    context.repository.database.exec(`CREATE TEMP TRIGGER reject_progress BEFORE INSERT ON leetcode_progress
      BEGIN SELECT RAISE(ABORT, '模拟完成标记写入失败'); END`)
    await assert.rejects(context.repository.commit({ practice: { ...original.practice, topic: '不应保存' },
      leetcodeProgress: [{ slug: 'two-sum', completed: true, completedAt: 100, updatedAt: 100, automatic: true }] }), /标记写入失败/)
    assert.deepEqual(await context.repository.getPractice(original.practice.id), original.practice)
    assert.deepEqual(await context.repository.listLeetcodeProgress(), [])
  } finally { context.cleanup() }
})

test('自动标记保持首次完成时间，晚到的旧事件不覆盖手动取消，重启后进度持久保留', async () => {
  const context = fixture()
  try {
    const auto = (time) => ({ slug: 'two-sum', completed: true, completedAt: time, updatedAt: time, automatic: true })
    await context.repository.commit({ leetcodeProgress: [auto(100), auto(110)] })
    assert.equal((await context.repository.listLeetcodeProgress())[0].completedAt, 100)
    await context.repository.saveLeetcodeProgress({ slug: 'two-sum', completed: false, completedAt: null, updatedAt: 200 })
    await context.repository.commit({ leetcodeProgress: [auto(150)] })
    assert.equal((await context.repository.listLeetcodeProgress())[0].completed, false)
    await context.repository.commit({ leetcodeProgress: [{ ...auto(250), answeredAt: 150 }] })
    assert.equal((await context.repository.listLeetcodeProgress())[0].completed, false)
    await context.repository.commit({ leetcodeProgress: [auto(250)] })
    const reopened = new SqliteInterviewRepository(context.repository.filePath)
    try { assert.equal((await reopened.listLeetcodeProgress())[0].completedAt, 250) } finally { reopened.close() }
  } finally { context.cleanup() }
})

test('SQLite 原子转移练习绑定并释放旧会话', async () => {
  const context = fixture()
  try {
    const { practice, binding } = aggregate()
    await context.repository.commit({ practice, binding })
    const transferred = transferSessionBinding(binding, 'session-2', 3)
    await context.repository.commit({ binding: transferred })
    assert.equal(await context.repository.getSessionBinding('session-1'), null)
    assert.deepEqual(await context.repository.getSessionBindingByPractice(practice.id), transferred)
    await context.repository.commit({ unbindSessionId: 'session-2' })
    assert.equal(await context.repository.getSessionBindingByPractice(practice.id), null)
  } finally { context.cleanup() }
})

test('SQLite 表结构约束一个练习只能绑定一个会话', async () => {
  const context = fixture()
  try {
    const { practice, binding } = aggregate()
    await context.repository.commit({ practice, binding })
    assert.throws(() => context.repository.database.prepare(`
      INSERT INTO session_bindings (session_id, practice_id, current_question_id, revision, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('session-duplicate', practice.id, binding.currentQuestionId, 1, 3))
  } finally { context.cleanup() }
})

test('SQLite 列表支持模式、状态和主题筛选', async () => {
  const context = fixture()
  try {
    const { practice, binding } = aggregate()
    await context.repository.commit({ practice, binding })
    assert.equal((await context.repository.listPractices({ mode: 'resume_drill', status: 'active', query: 'java' })).length, 1)
    assert.equal((await context.repository.listPractices({ mode: 'scenario' })).length, 0)
  } finally { context.cleanup() }
})

test('删除练习通过外键级联清理题目、作答和会话绑定', async () => {
  const context = fixture()
  try {
    const { practice, binding } = aggregate()
    await context.repository.commit({ practice, binding })
    await context.repository.deletePractice(practice.id)
    assert.equal(await context.repository.getPractice(practice.id), null)
    assert.equal(await context.repository.getSessionBinding(binding.sessionId), null)
  } finally { context.cleanup() }
})

test('SQLite 保存并更新力扣热题完成状态', async () => {
  const context = fixture()
  try {
    await context.repository.saveLeetcodeProgress({ slug: 'two-sum', completed: true, completedAt: 10, updatedAt: 10 })
    assert.deepEqual(await context.repository.listLeetcodeProgress(), [{ slug: 'two-sum', completed: true, completedAt: 10, updatedAt: 10 }])
    await context.repository.saveLeetcodeProgress({ slug: 'two-sum', completed: false, completedAt: null, updatedAt: 11 })
    assert.deepEqual(await context.repository.listLeetcodeProgress(), [{ slug: 'two-sum', completed: false, completedAt: null, updatedAt: 11 }])
  } finally { context.cleanup() }
})

test('SQLite 保存并恢复力扣题库元数据', async () => {
  const context = fixture()
  try {
    let practice = createPractice({ id: 'leetcode-1', mode: 'leetcode', config: { language: 'python', guidance: 'guided' }, now: 1 })
    practice = askQuestion(practice, { id: 'question-1', prompt: '1. 两数之和', leetcode: { slug: 'two-sum' }, now: 2 }).practice
    await context.repository.commit({ practice })
    const restored = await context.repository.getPractice(practice.id)
    assert.deepEqual(restored.config, { language: 'python', guidance: 'guided' })
    assert.deepEqual(restored.questions[0].leetcode, practice.questions[0].leetcode)
  } finally { context.cleanup() }
})

test('SQLite 保存并恢复题目材料与提示阶梯进度', async () => {
  const context = fixture()
  try {
    let practice = createPractice({ id: 'leetcode-1', mode: 'leetcode', config: { language: 'cpp', guidance: 'guided' }, now: 1 })
    practice = askQuestion(practice, { id: 'question-1', prompt: '1. 两数之和', leetcode: { slug: 'two-sum' }, now: 2 }).practice
    practice = saveMaterials(practice, {
      questionId: 'question-1',
      materials: {
        statement: '在数组中找到两个数，使它们的和等于目标值。',
        examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', note: '返回下标' }],
        constraints: ['2 <= nums.length <= 10^4'],
        hints: ['暴力枚举', '哈希表'],
        knowledge: [{ title: '哈希表', detail: '平均 O(1) 查找。' }],
        pitfalls: ['同一个元素不能使用两次'],
        related: [{ id: '167', title: '两数之和 II', slug: 'two-sum-ii-input-array-is-sorted' }],
      },
      now: 3,
    }).practice
    practice = revealHint(practice, { questionId: 'question-1', now: 4 }).practice
    practice = submitAnswer(practice, { questionId: 'question-1', attemptId: 'attempt-1', answer: '用哈希表。', now: 5 }).practice
    await context.repository.commit({ practice })

    const restored = await context.repository.getPractice(practice.id)
    const question = restored.questions[0]
    assert.equal(question.hintLevel, 1)
    assert.equal(question.materials.statement, '在数组中找到两个数，使它们的和等于目标值。')
    assert.deepEqual(question.materials.hints, ['暴力枚举', '哈希表'])
    assert.equal(question.materials.knowledge[0].title, '哈希表')
    assert.equal(question.materials.related[0].url, 'https://leetcode.cn/problems/two-sum-ii-input-array-is-sorted/')

    // 作答与评价等既有数据不受新增列影响。
    const answered = await context.repository.getPractice(practice.id)
    assert.equal(answered.questions[0].attempts.length, 1)
    assert.equal(answered.questions[0].attempts[0].answer, '用哈希表。')
  } finally { context.cleanup() }
})

test('旧数据库缺少题目材料列时就地补齐且保留历史数据', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-interview-legacy-'))
  const file = join(directory, 'interview.sqlite')
  try {
    const legacy = new DatabaseSync(file)
    legacy.exec(`
      CREATE TABLE questions (
        id TEXT PRIMARY KEY,
        practice_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        leetcode_json TEXT,
        explanation_detail TEXT,
        explanation_memo TEXT,
        explained_at INTEGER,
        UNIQUE (practice_id, sequence)
      );
      INSERT INTO questions (id, practice_id, sequence, prompt, created_at, leetcode_json)
      VALUES ('question-1', 'practice-1', 1, '1. 两数之和', 1, '{"slug":"two-sum"}');
    `)
    legacy.close()

    const repository = new SqliteInterviewRepository(file)
    const columns = repository.database.prepare('PRAGMA table_info(questions)').all().map((column) => column.name)
    assert.ok(columns.includes('materials_json'))
    assert.ok(columns.includes('hint_level'))
    const rows = repository.database.prepare('SELECT * FROM questions').all()
    assert.equal(rows.length, 1)
    assert.equal(rows[0].prompt, '1. 两数之和')
    assert.equal(rows[0].hint_level, 0)
    repository.close()
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('SQLite 题解库保存官方题面、笔记与专题前置知识', async () => {
  const context = fixture()
  try {
    const result = await context.repository.saveReferenceLibrary({
      references: [
        normalizeReferenceRecord({
          slug: 'two-sum', number: '1', title: '两数之和', difficulty: 'easy', category: '哈希',
          tags: ['数组', '哈希表'], url: 'https://leetcode.cn/problems/two-sum/',
          statement: '官方题意：返回和为目标值的两个下标。',
          examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', note: '' }],
          constraints: ['2 <= nums.length <= 10^4'],
          idea: '边遍历边查补数。', mnemonic: '边走边查配对数', diagram: 'need = target - num',
          code: 'def solve(): pass', complexity: 'O(n)',
          variants: [{ kind: '更优版', idea: '一次遍历', code: 'def solve(): pass', mnemonic: '', diagram: '', complexity: '' }],
          hardcode: { mnemonic: '字典存数字到下标', pseudocode: '创建字典', code: 'def solve(): pass', complexity: 'O(n)' },
          sourceFile: 'Hot100_哈希题解.md', sourceAnchor: '## 1. 两数之和',
          officialSource: 'live', fetchedAt: 1789563000000,
        }),
        normalizeReferenceRecord({ slug: 'move-zeroes', number: '283', title: '移动零', difficulty: 'easy', category: '双指针' }),
      ],
      topics: [normalizeTopicNotes({
        category: '哈希', core: '用空间换时间。',
        topics: [{ title: '什么时候该想到哈希', detail: '出现找配对时。' }],
        pitfalls: ['先放后查会自己配自己'], sourceFile: 'Hot100_哈希题解.md',
      })],
      now: 1789563000000,
    })
    assert.deepEqual(result, { references: 2, topics: 1 })

    const reference = await context.repository.findReference('two-sum')
    assert.equal(reference.statement, '官方题意：返回和为目标值的两个下标。')
    assert.deepEqual(reference.constraints, ['2 <= nums.length <= 10^4'])
    assert.equal(reference.mnemonic, '边走边查配对数')
    assert.equal(reference.variants[0].kind, '更优版')
    assert.equal(reference.hardcode.code, 'def solve(): pass')
    assert.equal(reference.officialSource, 'live')
    assert.equal(reference.fetchedAt, 1789563000000)
    assert.equal(reference.sourceAnchor, '## 1. 两数之和')

    const filtered = await context.repository.listReferences({ category: '哈希' })
    assert.deepEqual(filtered.map((item) => item.slug), ['two-sum'])
    assert.deepEqual((await context.repository.listReferences({ keyword: '283' })).map((item) => item.slug), ['move-zeroes'])
    assert.deepEqual((await context.repository.listReferences({ difficulty: 'easy' })).map((item) => item.slug), ['two-sum', 'move-zeroes'])

    const topic = await context.repository.findTopicNotes('哈希')
    assert.equal(topic.topics[0].title, '什么时候该想到哈希')
    assert.equal(topic.pitfalls[0], '先放后查会自己配自己')
    assert.equal((await context.repository.listTopicNotes()).length, 1)
    assert.deepEqual(await context.repository.referenceStats(), { total: 2, withNotes: 1, topics: 1 })

    // 重复导入按 slug 覆盖，不产生重复行
    await context.repository.saveReferenceLibrary({
      references: [normalizeReferenceRecord({ slug: 'two-sum', number: '1', title: '两数之和（更新）' })],
      now: 1789563001000,
    })
    assert.equal((await context.repository.findReference('two-sum')).title, '两数之和（更新）')
    assert.equal((await context.repository.referenceStats()).total, 2)
  } finally { context.cleanup() }
})
