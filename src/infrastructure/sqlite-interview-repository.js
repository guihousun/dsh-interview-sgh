import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { defaultDatabasePath } from './paths.js'

function parseJson(value, fallback) {
  if (typeof value !== 'string' || !value) return fallback
  try { return JSON.parse(value) } catch { return fallback }
}

export class SqliteInterviewRepository {
  constructor(filePath = defaultDatabasePath()) {
    this.filePath = filePath
    if (filePath !== ':memory:') mkdirSync(dirname(filePath), { recursive: true })
    this.database = new DatabaseSync(filePath)
    this.database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
    this.#initializeSchema()
  }

  #initializeSchema() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS practices (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        topic TEXT NOT NULL,
        source_kind TEXT NOT NULL,
        source_content TEXT NOT NULL,
        config_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        summary_json TEXT
      );

      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        practice_id TEXT NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        leetcode_json TEXT,
        materials_json TEXT,
        hint_level INTEGER NOT NULL DEFAULT 0,
        explanation_detail TEXT,
        explanation_memo TEXT,
        explained_at INTEGER,
        UNIQUE (practice_id, sequence)
      );

      CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        answer TEXT NOT NULL,
        submitted_at INTEGER NOT NULL,
        evaluation_score REAL,
        evaluation_feedback TEXT,
        evaluation_dimensions_json TEXT,
        evaluated_at INTEGER,
        UNIQUE (question_id, sequence)
      );

      CREATE TABLE IF NOT EXISTS session_bindings (
        session_id TEXT PRIMARY KEY,
        practice_id TEXT NOT NULL UNIQUE REFERENCES practices(id) ON DELETE CASCADE,
        current_question_id TEXT,
        revision INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS leetcode_progress (
        slug TEXT PRIMARY KEY,
        completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
        completed_at INTEGER,
        updated_at INTEGER NOT NULL
      );

      -- 题解库：热题 100 的官方题面（事实层）+ 用户自己的题解笔记（参考层）。由导入脚本写入，做题时只读。
      CREATE TABLE IF NOT EXISTS leetcode_reference (
        slug TEXT PRIMARY KEY,
        number TEXT,
        title TEXT,
        title_en TEXT,
        difficulty TEXT,
        category TEXT,
        tags_json TEXT,
        url TEXT,
        statement TEXT,
        examples_json TEXT,
        constraints_json TEXT,
        advanced TEXT,
        idea TEXT,
        mnemonic TEXT,
        diagram TEXT,
        steps TEXT,
        background TEXT,
        notes TEXT,
        code TEXT,
        complexity TEXT,
        variants_json TEXT,
        hardcode_json TEXT,
        source_file TEXT,
        source_anchor TEXT,
        official_source TEXT,
        fetched_at INTEGER,
        updated_at INTEGER
      );

      -- 专题前置知识（栈预备课 / 图论基础…），按题型存放，引导模式补齐前置知识时读取。
      CREATE TABLE IF NOT EXISTS leetcode_topic_notes (
        category TEXT PRIMARY KEY,
        core TEXT,
        topics_json TEXT,
        pitfalls_json TEXT,
        source_file TEXT,
        updated_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_practices_updated_at ON practices(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_practices_mode_status ON practices(mode, status);
      CREATE INDEX IF NOT EXISTS idx_questions_practice ON questions(practice_id, sequence);
      CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts(question_id, sequence);
      CREATE INDEX IF NOT EXISTS idx_reference_category ON leetcode_reference(category);
    `)
    this.#addMissingColumns()
  }

  // 旧数据库缺少题目材料与提示进度列时就地补齐，不重建表、不丢历史数据。
  #addMissingColumns() {
    const columns = new Set(this.database.prepare('PRAGMA table_info(questions)').all().map((column) => column.name))
    if (!columns.has('materials_json')) this.database.exec('ALTER TABLE questions ADD COLUMN materials_json TEXT')
    if (!columns.has('hint_level')) this.database.exec('ALTER TABLE questions ADD COLUMN hint_level INTEGER NOT NULL DEFAULT 0')
    // 题解库表是后加的：早期导入过的库需要补上来源与抓取时间两列。
    const referenceColumns = new Set(this.database.prepare('PRAGMA table_info(leetcode_reference)').all().map((column) => column.name))
    if (referenceColumns.size && !referenceColumns.has('official_source')) this.database.exec('ALTER TABLE leetcode_reference ADD COLUMN official_source TEXT')
    if (referenceColumns.size && !referenceColumns.has('fetched_at')) this.database.exec('ALTER TABLE leetcode_reference ADD COLUMN fetched_at INTEGER')
  }

  #readQuestion(row) {
    const attemptRows = this.database.prepare(`
      SELECT * FROM attempts WHERE question_id = ? ORDER BY sequence ASC
    `).all(row.id)
    const leetcode = parseJson(row.leetcode_json, null)
    return {
      id: row.id,
      sequence: row.sequence,
      prompt: row.prompt,
      createdAt: row.created_at,
      attempts: attemptRows.map((attempt) => ({
        id: attempt.id,
        sequence: attempt.sequence,
        answer: attempt.answer,
        submittedAt: attempt.submitted_at,
        evaluation: attempt.evaluation_score === null ? null : {
          score: attempt.evaluation_score,
          feedback: attempt.evaluation_feedback || '',
          dimensions: parseJson(attempt.evaluation_dimensions_json, {}),
          evaluatedAt: attempt.evaluated_at,
        },
      })),
      explanation: row.explanation_detail === null ? null : {
        detail: row.explanation_detail,
        memorizationPoints: row.explanation_memo || '',
        createdAt: row.explained_at,
      },
      ...(leetcode ? { leetcode, materials: parseJson(row.materials_json, null), hintLevel: Number(row.hint_level) || 0 } : {}),
    }
  }

  async getPractice(id) {
    const row = this.database.prepare('SELECT * FROM practices WHERE id = ?').get(id)
    if (!row) return null
    const questionRows = this.database.prepare(`
      SELECT * FROM questions WHERE practice_id = ? ORDER BY sequence ASC
    `).all(id)
    return {
      id: row.id,
      mode: row.mode,
      topic: row.topic,
      source: { kind: row.source_kind, content: row.source_content },
      config: parseJson(row.config_json, {}),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      summary: parseJson(row.summary_json, null),
      questions: questionRows.map((question) => this.#readQuestion(question)),
    }
  }

  async listPractices(filters = {}) {
    const clauses = []
    const values = []
    if (filters.mode) { clauses.push('mode = ?'); values.push(filters.mode) }
    if (filters.status) { clauses.push('status = ?'); values.push(filters.status) }
    if (filters.query) {
      clauses.push('(LOWER(topic) LIKE ? OR LOWER(source_content) LIKE ? OR LOWER(config_json) LIKE ?)')
      const query = `%${String(filters.query).toLowerCase()}%`
      values.push(query, query, query)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = this.database.prepare(`SELECT id FROM practices ${where} ORDER BY updated_at DESC`).all(...values)
    return Promise.all(rows.map((row) => this.getPractice(row.id)))
  }

  async getSessionBinding(sessionId) {
    const row = this.database.prepare('SELECT * FROM session_bindings WHERE session_id = ?').get(sessionId)
    return this.#readSessionBinding(row)
  }

  async getSessionBindingByPractice(practiceId) {
    const row = this.database.prepare('SELECT * FROM session_bindings WHERE practice_id = ?').get(practiceId)
    return this.#readSessionBinding(row)
  }

  #readSessionBinding(row) {
    return row ? {
      sessionId: row.session_id,
      practiceId: row.practice_id,
      currentQuestionId: row.current_question_id,
      revision: row.revision,
      updatedAt: row.updated_at,
    } : null
  }

  #writePractice(practice) {
    this.database.prepare(`
      INSERT INTO practices (
        id, mode, topic, source_kind, source_content, config_json, status,
        created_at, updated_at, completed_at, summary_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        mode = excluded.mode,
        topic = excluded.topic,
        source_kind = excluded.source_kind,
        source_content = excluded.source_content,
        config_json = excluded.config_json,
        status = excluded.status,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at,
        summary_json = excluded.summary_json
    `).run(
      practice.id,
      practice.mode,
      practice.topic,
      practice.source.kind,
      practice.source.content,
      JSON.stringify(practice.config),
      practice.status,
      practice.createdAt,
      practice.updatedAt,
      practice.completedAt,
      practice.summary ? JSON.stringify(practice.summary) : null,
    )
    this.database.prepare('DELETE FROM questions WHERE practice_id = ?').run(practice.id)
    const insertQuestion = this.database.prepare(`
      INSERT INTO questions (
        id, practice_id, sequence, prompt, created_at,
        leetcode_json, materials_json, hint_level,
        explanation_detail, explanation_memo, explained_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertAttempt = this.database.prepare(`
      INSERT INTO attempts (
        id, question_id, sequence, answer, submitted_at,
        evaluation_score, evaluation_feedback, evaluation_dimensions_json, evaluated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const question of practice.questions) {
      insertQuestion.run(
        question.id,
        practice.id,
        question.sequence,
        question.prompt,
        question.createdAt,
        question.leetcode ? JSON.stringify(question.leetcode) : null,
        question.materials ? JSON.stringify(question.materials) : null,
        Number(question.hintLevel) || 0,
        question.explanation?.detail ?? null,
        question.explanation?.memorizationPoints ?? null,
        question.explanation?.createdAt ?? null,
      )
      for (const attempt of question.attempts) {
        insertAttempt.run(
          attempt.id,
          question.id,
          attempt.sequence,
          attempt.answer,
          attempt.submittedAt,
          attempt.evaluation?.score ?? null,
          attempt.evaluation?.feedback ?? null,
          attempt.evaluation ? JSON.stringify(attempt.evaluation.dimensions) : null,
          attempt.evaluation?.evaluatedAt ?? null,
        )
      }
    }
  }

  #writeSessionBinding(binding) {
    this.database.prepare('DELETE FROM session_bindings WHERE session_id = ? OR practice_id = ?')
      .run(binding.sessionId, binding.practiceId)
    this.database.prepare(`
      INSERT INTO session_bindings (
        session_id, practice_id, current_question_id, revision, updated_at
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      binding.sessionId,
      binding.practiceId,
      binding.currentQuestionId,
      binding.revision,
      binding.updatedAt,
    )
  }

  async commit({ practice, practices = [], binding, unbindSessionId }) {
    this.database.exec('BEGIN IMMEDIATE')
    try {
      for (const item of [...practices, ...(practice ? [practice] : [])]) this.#writePractice(item)
      if (unbindSessionId) this.database.prepare('DELETE FROM session_bindings WHERE session_id = ?').run(unbindSessionId)
      if (binding) this.#writeSessionBinding(binding)
      this.database.exec('COMMIT')
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }

  async deletePractice(id) {
    this.database.prepare('DELETE FROM practices WHERE id = ?').run(id)
  }

  async clearSessionBinding(sessionId) {
    this.database.prepare('DELETE FROM session_bindings WHERE session_id = ?').run(sessionId)
  }

  async listLeetcodeProgress() {
    return this.database.prepare('SELECT * FROM leetcode_progress ORDER BY slug ASC').all().map((row) => ({
      slug: row.slug,
      completed: Boolean(row.completed),
      completedAt: row.completed_at,
      updatedAt: row.updated_at,
    }))
  }

  async saveLeetcodeProgress(progress) {
    this.database.prepare(`
      INSERT INTO leetcode_progress (slug, completed, completed_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        completed = excluded.completed,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at
    `).run(progress.slug, progress.completed ? 1 : 0, progress.completedAt, progress.updatedAt)
  }

  #readReference(row) {
    if (!row) return null
    return {
      slug: row.slug,
      number: row.number || '',
      title: row.title || '',
      titleEn: row.title_en || '',
      difficulty: row.difficulty || '',
      category: row.category || '',
      tags: parseJson(row.tags_json, []),
      url: row.url || '',
      statement: row.statement || '',
      examples: parseJson(row.examples_json, []),
      constraints: parseJson(row.constraints_json, []),
      advanced: row.advanced || '',
      idea: row.idea || '',
      mnemonic: row.mnemonic || '',
      diagram: row.diagram || '',
      steps: row.steps || '',
      background: row.background || '',
      notes: row.notes || '',
      code: row.code || '',
      complexity: row.complexity || '',
      variants: parseJson(row.variants_json, []),
      hardcode: parseJson(row.hardcode_json, null),
      sourceFile: row.source_file || '',
      sourceAnchor: row.source_anchor || '',
      officialSource: row.official_source || '',
      fetchedAt: row.fetched_at || 0,
      updatedAt: row.updated_at || 0,
    }
  }

  // 题解库整批导入：一次事务里 upsert，导入脚本可以反复执行。
  async saveReferenceLibrary({ references = [], topics = [], now = Date.now() } = {}) {
    const insertReference = this.database.prepare(`
      INSERT INTO leetcode_reference (
        slug, number, title, title_en, difficulty, category, tags_json, url,
        statement, examples_json, constraints_json, advanced,
        idea, mnemonic, diagram, steps, background, notes, code, complexity, variants_json, hardcode_json,
        source_file, source_anchor, official_source, fetched_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        number = excluded.number, title = excluded.title, title_en = excluded.title_en,
        difficulty = excluded.difficulty, category = excluded.category, tags_json = excluded.tags_json,
        url = excluded.url, statement = excluded.statement, examples_json = excluded.examples_json,
        constraints_json = excluded.constraints_json, advanced = excluded.advanced,
        idea = excluded.idea, mnemonic = excluded.mnemonic, diagram = excluded.diagram, steps = excluded.steps,
        background = excluded.background, notes = excluded.notes, code = excluded.code,
        complexity = excluded.complexity, variants_json = excluded.variants_json, hardcode_json = excluded.hardcode_json,
        source_file = excluded.source_file, source_anchor = excluded.source_anchor,
        official_source = excluded.official_source, fetched_at = excluded.fetched_at, updated_at = excluded.updated_at
    `)
    const insertTopic = this.database.prepare(`
      INSERT INTO leetcode_topic_notes (category, core, topics_json, pitfalls_json, source_file, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(category) DO UPDATE SET
        core = excluded.core, topics_json = excluded.topics_json, pitfalls_json = excluded.pitfalls_json,
        source_file = excluded.source_file, updated_at = excluded.updated_at
    `)
    this.database.exec('BEGIN IMMEDIATE')
    try {
      for (const reference of references) {
        insertReference.run(
          reference.slug,
          reference.number || '',
          reference.title || '',
          reference.titleEn || '',
          reference.difficulty || '',
          reference.category || '',
          JSON.stringify(reference.tags || []),
          reference.url || '',
          reference.statement || '',
          JSON.stringify(reference.examples || []),
          JSON.stringify(reference.constraints || []),
          reference.advanced || '',
          reference.idea || '',
          reference.mnemonic || '',
          reference.diagram || '',
          reference.steps || '',
          reference.background || '',
          reference.notes || '',
          reference.code || '',
          reference.complexity || '',
          JSON.stringify(reference.variants || []),
          reference.hardcode ? JSON.stringify(reference.hardcode) : null,
          reference.sourceFile || '',
          reference.sourceAnchor || '',
          reference.officialSource || '',
          reference.fetchedAt || now,
          now,
        )
      }
      for (const topic of topics) {
        insertTopic.run(
          topic.category,
          topic.core || '',
          JSON.stringify(topic.topics || []),
          JSON.stringify(topic.pitfalls || []),
          topic.sourceFile || '',
          now,
        )
      }
      this.database.exec('COMMIT')
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
    return { references: references.length, topics: topics.length }
  }

  async findReference(slug) {
    if (typeof slug !== 'string' || !slug.trim()) return null
    return this.#readReference(this.database.prepare('SELECT * FROM leetcode_reference WHERE slug = ?').get(slug.trim()))
  }

  async listReferences({ category, difficulty, keyword, limit = 20 } = {}) {
    const clauses = []
    const parameters = []
    if (category) { clauses.push('category = ?'); parameters.push(category) }
    if (difficulty) { clauses.push('difficulty = ?'); parameters.push(difficulty) }
    if (keyword) {
      // 关键字同时匹配题号、题名、slug、题型与标签，和题库的检索口径保持一致。
      clauses.push('(slug LIKE ? OR title LIKE ? OR number = ? OR category LIKE ? OR tags_json LIKE ?)')
      const like = `%${keyword}%`
      parameters.push(like, like, keyword, like, like)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const size = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), 200) : 20
    const rows = this.database.prepare(`
      SELECT slug, number, title, title_en, difficulty, category, tags_json, url
      FROM leetcode_reference ${where}
      ORDER BY CAST(number AS INTEGER) ASC, number ASC LIMIT ?
    `).all(...parameters, size)
    return rows.map((row) => this.#readReference(row))
  }

  async findTopicNotes(category) {
    if (typeof category !== 'string' || !category.trim()) return null
    const row = this.database.prepare('SELECT * FROM leetcode_topic_notes WHERE category = ?').get(category.trim())
    if (!row) return null
    return {
      category: row.category,
      core: row.core || '',
      topics: parseJson(row.topics_json, []),
      pitfalls: parseJson(row.pitfalls_json, []),
      sourceFile: row.source_file || '',
      updatedAt: row.updated_at || 0,
    }
  }

  async listTopicNotes() {
    return this.database.prepare('SELECT * FROM leetcode_topic_notes ORDER BY category ASC').all().map((row) => ({
      category: row.category,
      core: row.core || '',
      topics: parseJson(row.topics_json, []),
      pitfalls: parseJson(row.pitfalls_json, []),
      sourceFile: row.source_file || '',
      updatedAt: row.updated_at || 0,
    }))
  }

  async referenceStats() {
    const total = this.database.prepare('SELECT COUNT(*) AS total FROM leetcode_reference').get().total
    const withNotes = this.database.prepare('SELECT COUNT(*) AS total FROM leetcode_reference WHERE idea != \'\' OR mnemonic != \'\'').get().total
    const topics = this.database.prepare('SELECT COUNT(*) AS total FROM leetcode_topic_notes').get().total
    return { total, withNotes, topics }
  }

  close() {
    this.database.close()
  }
}
