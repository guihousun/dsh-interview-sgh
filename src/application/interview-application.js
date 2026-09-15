import { DomainError, assertDomain } from '../domain/errors.js'
import { LEETCODE_TOP_100, LEETCODE_TOP_100_GROUPS, LEETCODE_TOP_100_SOURCE, leetcodeDifficultyLabel, leetcodeTop100Problem } from '../domain/leetcode-top-100.js'
import { LEETCODE_CATEGORIES, LEETCODE_DIFFICULTY_IDS, leetcodeProblemQueryLabel, listLeetcodeProblems, resolveLeetcodeProblem } from '../domain/leetcode-problems.js'
import {
  askQuestion, completeLeetcodePractice, completePractice, createPractice, deleteQuestion,
  evaluateAnswer, findQuestion, reopenPractice, revealHint, saveExplanation, saveMaterials, submitAnswer,
  updatePractice, updateQuestion,
} from '../domain/practice.js'
import {
  clearSessionQuestion, consumeSessionBinding, createSessionBinding, focusSessionQuestion, transferSessionBinding,
} from '../domain/session.js'
import { buildInsights, toPracticeDetailDto, toPracticeSummaryDto, toQuestionDto, toSessionContextDto } from './dto.js'
import { validateApplicationPorts } from './ports.js'
import { assertModeCapability } from '../domain/mode-capabilities.js'

function requiredId(value, name) {
  assertDomain(typeof value === 'string' && value.trim(), `INVALID_${name.toUpperCase()}`, `${name} 不能为空`)
  return value.trim()
}

export class InterviewApplication {
  constructor(ports) {
    const validated = validateApplicationPorts(ports)
    this.repository = validated.repository
    this.events = validated.events
    this.exporter = validated.exporter
    this.clock = validated.clock
    this.ids = validated.ids
    this.random = validated.random
  }

  async #practice(practiceId) {
    const id = requiredId(practiceId, 'practiceId')
    const practice = await this.repository.getPractice(id)
    if (!practice) throw new DomainError('PRACTICE_NOT_FOUND', `找不到练习：${id}`)
    return practice
  }

  async #session(sessionId) {
    const id = requiredId(sessionId, 'sessionId')
    const binding = await this.repository.getSessionBinding(id)
    if (!binding) throw new DomainError('SESSION_NOT_SELECTED', '当前会话未选择练习')
    return { binding, practice: await this.#practice(binding.practiceId) }
  }

  async #publish(events) {
    if (events.length) await this.events.publish(events)
  }

  #result(kind, data, binding = null, { events = [], references = {} } = {}) {
    return {
      resource: { kind, data },
      references: {
        ...(binding?.practiceId ? { practiceId: binding.practiceId } : {}),
        ...(binding?.currentQuestionId ? { questionId: binding.currentQuestionId } : {}),
        ...references,
      },
      events,
      revision: binding?.revision ?? 0,
    }
  }

  async #leetcodeProgress() {
    return new Map((await this.repository.listLeetcodeProgress()).map((item) => [item.slug, item]))
  }

  async #drawLeetcodeQuestion(practice, binding, now, { selection = null, filters = null, excludedSlugs = [] } = {}) {
    assertDomain(practice.mode === 'leetcode', 'INVALID_PRACTICE_MODE', '只有刷力扣模式可以从题库抽题')
    const problem = selection
      ? resolveLeetcodeProblem(selection)
      : await this.#randomLeetcodeProblem(practice, excludedSlugs, filters)
    assertDomain(
      problem,
      'LEETCODE_PROBLEM_NOT_FOUND',
      selection
        ? `找不到指定的力扣题目：${leetcodeProblemQueryLabel(selection)}`
        : `没有符合条件的力扣题目：${[filters?.category, filters?.difficulty].filter(Boolean).join(' · ') || '（空）'}`,
    )
    const added = askQuestion(practice, {
      id: this.ids.next('question'), prompt: `${problem.id}. ${problem.title}`, leetcode: problem, now,
    })
    return { ...added, binding: focusSessionQuestion(binding, added.question.id, now) }
  }

  async #randomLeetcodeProblem(practice, excludedSlugs, filters = null) {
    const progress = await this.#leetcodeProgress()
    const used = new Set([...practice.questions.map((question) => question.leetcode?.slug).filter(Boolean), ...excludedSlugs])
    const base = filters
      ? listLeetcodeProblems({ category: filters.category, difficulty: filters.difficulty, limit: LEETCODE_TOP_100.length })
      : LEETCODE_TOP_100
    if (base.length === 0) return null
    const incomplete = (problem) => progress.get(problem.slug)?.completed !== true
    const pools = [
      base.filter((problem) => !used.has(problem.slug) && incomplete(problem)),
      base.filter((problem) => !used.has(problem.slug)),
      base.filter(incomplete),
      base,
    ]
    const candidates = pools.find((pool) => pool.length > 0)
    const randomValue = Number(this.random.next())
    assertDomain(Number.isFinite(randomValue) && randomValue >= 0 && randomValue < 1, 'INVALID_RANDOM_VALUE', '随机数必须位于 [0, 1) 区间')
    return { ...candidates[Math.floor(randomValue * candidates.length)] }
  }

  async createAtomicPractice(sessionId, input) {
    const now = this.clock.now()
    const practice = createPractice({ ...input, id: this.ids.next('practice'), now })
    const binding = createSessionBinding({ sessionId, practiceId: practice.id, now })
    const events = [{ type: 'practice.created', sessionId, practiceId: practice.id, mode: practice.mode }]
    await this.repository.commit({ practice, binding })
    await this.#publish(events)
    return this.#result('practice-detail', toPracticeDetailDto(practice), binding, { events })
  }

  async readAtomicSession(sessionId) {
    const binding = await this.repository.getSessionBinding(requiredId(sessionId, 'sessionId'))
    if (!binding) return this.#result('session-context', toSessionContextDto(null, null))
    const practice = await this.#practice(binding.practiceId)
    return this.#result('session-context', toSessionContextDto(binding, practice), binding)
  }

  async bindAtomicPractice(sessionId, practiceId) {
    const now = this.clock.now()
    const practice = await this.#practice(practiceId)
    const existing = await this.repository.getSessionBindingByPractice(practice.id)
    let binding = existing
      ? transferSessionBinding(existing, sessionId, now)
      : createSessionBinding({ sessionId, practiceId: practice.id, now })
    if (!existing && practice.questions.length) binding = focusSessionQuestion(binding, practice.questions.at(-1).id, now)
    await this.repository.commit({ binding })
    return this.#result('session-context', toSessionContextDto(binding, practice), binding)
  }

  async consumeAtomicPresentation(sessionId, input) {
    const now = this.clock.now()
    const { binding } = await this.#session(sessionId)
    const presentationId = requiredId(input.presentationId, 'presentationId')
    const practiceId = requiredId(input.practiceId, 'practiceId')
    const questionId = requiredId(input.questionId, 'questionId')
    const revision = Number(input.sessionRevision)
    assertDomain(Number.isInteger(revision), 'INVALID_SESSION_REVISION', '卡片缺少有效的会话修订号')
    assertDomain(
      binding.practiceId === practiceId
      && binding.currentQuestionId === questionId
      && binding.revision === revision,
      'STALE_PRESENTATION',
      '这张卡片已经完成，不能再次操作',
      { presentationId, currentRevision: binding.revision, expectedRevision: revision },
    )
    const nextBinding = consumeSessionBinding(binding, now)
    await this.repository.commit({ binding: nextBinding })
    return this.#result('presentation-consumed', { presentationId }, nextBinding)
  }

  async createAtomicQuestion(sessionId, { prompt }) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    assertDomain(practice.mode !== 'leetcode', 'LEETCODE_QUESTION_MANAGED_BY_CATALOG', '力扣题必须由固定题库抽取')
    const added = askQuestion(practice, { id: this.ids.next('question'), prompt, now })
    const nextBinding = focusSessionQuestion(binding, added.question.id, now)
    const events = [{ type: 'question.created', sessionId, practiceId: practice.id, questionId: added.question.id }]
    await this.repository.commit({ practice: added.practice, binding: nextBinding })
    await this.#publish(events)
    return this.#result('question-detail', toQuestionDto(added.question, practice), nextBinding, { events })
  }

  async focusAtomicQuestion(sessionId, questionId) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    const question = findQuestion(practice, requiredId(questionId, 'questionId'))
    const nextBinding = focusSessionQuestion(binding, question.id, now)
    await this.repository.commit({ binding: nextBinding })
    return this.#result('question-detail', toQuestionDto(question, practice), nextBinding)
  }

  async deleteAtomicQuestion(sessionId, questionId) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    const id = requiredId(questionId, 'questionId')
    const removed = deleteQuestion(practice, { questionId: id, now })
    const nextBinding = binding.currentQuestionId === id ? clearSessionQuestion(binding, now) : binding
    await this.repository.commit({ practice: removed.practice, binding: nextBinding })
    return this.#result('question-deleted', { practiceId: practice.id, questionId: id }, nextBinding, {
      references: { practiceId: practice.id, questionId: id },
    })
  }

  async createAtomicAttempt(sessionId, { questionId, answer }) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    const targetId = questionId || binding.currentQuestionId
    assertDomain(Boolean(targetId), 'QUESTION_NOT_FOCUSED', '必须指定需要回答的题目')
    const added = submitAnswer(practice, { questionId: targetId, attemptId: this.ids.next('attempt'), answer, now })
    const nextBinding = focusSessionQuestion(binding, targetId, now)
    await this.repository.commit({ practice: added.practice, binding: nextBinding })
    return this.#result('attempt-detail', { questionId: targetId, ...added.attempt }, nextBinding, {
      references: { attemptId: added.attempt.id },
    })
  }

  async createAtomicEvaluation(sessionId, input) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    const questionId = requiredId(input.questionId, 'questionId')
    const attemptId = requiredId(input.attemptId, 'attemptId')
    const added = evaluateAnswer(practice, { ...input, questionId, attemptId, now })
    await this.repository.commit({ practice: added.practice })
    return this.#result('evaluation-detail', { questionId, attemptId, ...added.evaluation }, binding, {
      references: { attemptId },
    })
  }

  async createAtomicExplanation(sessionId, input) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    const questionId = requiredId(input.questionId, 'questionId')
    const added = saveExplanation(practice, { ...input, questionId, replace: input.replace === true, now })
    await this.repository.commit({ practice: added.practice })
    return this.#result('explanation-detail', { questionId, ...added.explanation }, binding)
  }

  async saveAtomicMaterials(sessionId, input) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    const questionId = requiredId(input.questionId || binding.currentQuestionId, 'questionId')
    const saved = saveMaterials(practice, {
      questionId,
      materials: input.materials,
      replace: input.replace === true,
      now,
    })
    await this.repository.commit({ practice: saved.practice })
    return this.#result('question-detail', toQuestionDto(saved.question, practice), binding, {
      references: { questionId },
    })
  }

  async revealAtomicHint(sessionId, questionId = null) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    const targetId = questionId || binding.currentQuestionId
    assertDomain(Boolean(targetId), 'QUESTION_NOT_FOCUSED', '必须指定需要提示的题目')
    const revealed = revealHint(practice, { questionId: targetId, now })
    await this.repository.commit({ practice: revealed.practice })
    return this.#result('question-detail', toQuestionDto(revealed.question, practice), binding, {
      references: { questionId: targetId },
    })
  }

  async completeAtomicPractice(sessionId, input = {}) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    const completed = practice.mode === 'leetcode'
      ? completeLeetcodePractice(practice, { now })
      : completePractice(practice, { ...input, now })
    await this.repository.commit({ practice: completed, unbindSessionId: binding.sessionId })
    return this.#result('practice-detail', toPracticeDetailDto(completed), binding)
  }

  async reopenAtomicPractice(sessionId, practiceId) {
    const now = this.clock.now()
    const practice = reopenPractice(await this.#practice(practiceId), now)
    let binding = createSessionBinding({ sessionId, practiceId: practice.id, now })
    if (practice.questions.length) binding = focusSessionQuestion(binding, practice.questions.at(-1).id, now)
    await this.repository.commit({ practice, binding })
    return this.#result('session-context', toSessionContextDto(binding, practice), binding)
  }

  async drawAtomicLeetcode(sessionId, options = {}) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    const drawn = await this.#drawLeetcodeQuestion(practice, binding, now, {
      selection: options.selection || null,
      filters: options.filters || null,
    })
    await this.repository.commit({ practice: drawn.practice, binding: drawn.binding })
    return this.#result('question-detail', toQuestionDto(drawn.question, practice), drawn.binding)
  }

  async searchLeetcodeProblems(input = {}) {
    const problems = listLeetcodeProblems({
      keyword: input.keyword,
      category: input.category,
      difficulty: input.difficulty,
      limit: input.limit,
    })
    const progress = await this.#leetcodeProgress()
    return this.#result('leetcode-search', {
      query: {
        keyword: input.keyword || '',
        category: input.category || '',
        difficulty: input.difficulty || '',
      },
      total: problems.length,
      categories: [...LEETCODE_CATEGORIES],
      problems: problems.map((problem) => ({
        ...problem,
        completed: progress.get(problem.slug)?.completed === true,
      })),
    })
  }

  async drawAtomicMockCodingQuestion(sessionId) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    assertModeCapability(practice, 'question.draw_hot100', 'HOT100_NOT_ALLOWED', '当前模式不能抽取 Hot 100 手撕题')
    assertDomain(practice.config.coding === true, 'MOCK_CODING_REQUIRED', '当前模拟面试未开启手撕代码')
    const used = new Set(practice.questions.map((question) => question.hot100?.slug).filter(Boolean))
    const unused = LEETCODE_TOP_100.filter((problem) => !used.has(problem.slug))
    const candidates = unused.length ? unused : LEETCODE_TOP_100
    const randomValue = Number(this.random.next())
    assertDomain(Number.isFinite(randomValue) && randomValue >= 0 && randomValue < 1, 'INVALID_RANDOM_VALUE', '随机数必须位于 [0, 1) 区间')
    const problem = candidates[Math.floor(randomValue * candidates.length)]
    const added = askQuestion(practice, {
      id: this.ids.next('question'),
      prompt: `手撕题：${problem.id}. ${problem.title}`,
      hot100: { kind: 'hot100', slug: problem.slug },
      now,
    })
    const nextBinding = focusSessionQuestion(binding, added.question.id, now)
    await this.repository.commit({ practice: added.practice, binding: nextBinding })
    return this.#result('question-detail', toQuestionDto(added.question, practice), nextBinding)
  }

  async drawNextAtomicLeetcode(sessionId, options = {}) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    assertDomain(practice.mode === 'leetcode', 'LEETCODE_PRACTICE_REQUIRED', '当前练习不是力扣模式')
    const previousSlug = practice.questions[0]?.leetcode?.slug
    const completed = completeLeetcodePractice(practice, { now })
    const nextPractice = createPractice({
      id: this.ids.next('practice'), mode: 'leetcode', config: practice.config, now,
    })
    const nextBinding = createSessionBinding({ sessionId, practiceId: nextPractice.id, now })
    const drawn = await this.#drawLeetcodeQuestion(nextPractice, nextBinding, now, {
      selection: options.selection || null,
      filters: options.filters || null,
      excludedSlugs: previousSlug ? [previousSlug] : [],
    })
    await this.repository.commit({ practices: [completed, drawn.practice], binding: drawn.binding })
    return this.#result('question-detail', toQuestionDto(drawn.question, nextPractice), drawn.binding)
  }

  async updatePractice(practiceId, input) {
    const now = this.clock.now()
    const practice = updatePractice(await this.#practice(practiceId), { ...input, now })
    await this.repository.commit({ practice })
    return this.#result('practice-detail', toPracticeDetailDto(practice), null, { references: { practiceId: practice.id } })
  }

  async getQuestion(practiceId, questionId) {
    const practice = await this.#practice(practiceId)
    const id = requiredId(questionId, 'questionId')
    return this.#result('question-detail', toQuestionDto(findQuestion(practice, id), practice), null, {
      references: { practiceId: practice.id, questionId: id },
    })
  }

  async updateQuestion(practiceId, questionId, input) {
    const now = this.clock.now()
    const practice = await this.#practice(practiceId)
    const revised = updateQuestion(practice, { questionId: requiredId(questionId, 'questionId'), prompt: input.prompt, now })
    await this.repository.commit({ practice: revised.practice })
    return this.#result('question-detail', toQuestionDto(revised.question, practice), null, {
      references: { practiceId: practice.id, questionId: revised.question.id },
    })
  }

  async deleteQuestion(practiceId, questionId) {
    const now = this.clock.now()
    const practice = await this.#practice(practiceId)
    const id = requiredId(questionId, 'questionId')
    const removed = deleteQuestion(practice, { questionId: id, now })
    const binding = await this.repository.getSessionBindingByPractice(practice.id)
    const nextBinding = binding?.currentQuestionId === id ? clearSessionQuestion(binding, now) : binding
    await this.repository.commit({ practice: removed.practice, ...(nextBinding ? { binding: nextBinding } : {}) })
    return this.#result('question-deleted', { practiceId: practice.id, questionId: id }, nextBinding, {
      references: { practiceId: practice.id, questionId: id },
    })
  }

  async listPractices(filters = {}) {
    return this.#result('practice-list', (await this.repository.listPractices(filters)).map(toPracticeSummaryDto))
  }

  async getPractice(practiceId) {
    const practice = await this.#practice(practiceId)
    return this.#result('practice-detail', toPracticeDetailDto(practice), null, { references: { practiceId: practice.id } })
  }

  async getInsights() {
    return this.#result('insights', buildInsights(await this.repository.listPractices({})))
  }

  async getLeetcodeCatalog() {
    const progress = await this.#leetcodeProgress()
    let completedCount = 0
    const groups = LEETCODE_TOP_100_GROUPS.map((group) => ({
      category: group.category,
      problems: group.problems.map((problem) => {
        const saved = progress.get(problem.slug)
        const completed = saved?.completed === true
        if (completed) completedCount += 1
        return { ...problem, completed, completedAt: completed ? saved.completedAt : null }
      }),
    }))
    return this.#result('leetcode-catalog', {
      source: LEETCODE_TOP_100_SOURCE,
      total: LEETCODE_TOP_100.length,
      completedCount,
      categories: [...LEETCODE_CATEGORIES],
      difficulties: LEETCODE_DIFFICULTY_IDS.map((id) => ({ id, label: leetcodeDifficultyLabel(id) })),
      groups,
    })
  }

  async setLeetcodeProblemCompletion(slug, completed) {
    const problem = leetcodeTop100Problem(requiredId(slug, 'slug'))
    assertDomain(Boolean(problem), 'LEETCODE_PROBLEM_NOT_FOUND', `力扣热题 100 中不存在题目：${String(slug)}`)
    assertDomain(typeof completed === 'boolean', 'LEETCODE_COMPLETION_REQUIRED', '必须明确提供是否完成')
    const now = this.clock.now()
    const progress = { slug: problem.slug, completed, completedAt: completed ? now : null, updatedAt: now }
    await this.repository.saveLeetcodeProgress(progress)
    return this.#result('leetcode-progress', { ...problem, ...progress }, null, { references: { problemSlug: problem.slug } })
  }

  async deletePractice(practiceId, sessionId = null) {
    const practice = await this.#practice(practiceId)
    await this.repository.deletePractice(practice.id)
    if (sessionId) {
      const binding = await this.repository.getSessionBinding(requiredId(sessionId, 'sessionId'))
      if (binding?.practiceId === practice.id) await this.repository.clearSessionBinding(sessionId)
    }
    return this.#result('practice-deleted', { practiceId: practice.id }, null, { references: { practiceId: practice.id } })
  }

  async exportPractices(input = {}) {
    const practices = input.practiceIds?.length
      ? await Promise.all(input.practiceIds.map((id) => this.#practice(id)))
      : await this.repository.listPractices(input.scope === 'all' ? {} : input.filters || {})
    assertDomain(practices.length > 0, 'NOTHING_TO_EXPORT', '没有可导出的练习')
    return this.#result('export', await this.exporter.export(practices, input))
  }
}
