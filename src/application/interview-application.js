import { DomainError, assertDomain } from '../domain/errors.js'
import { LEETCODE_TOP_100, LEETCODE_TOP_100_GROUPS, LEETCODE_TOP_100_SOURCE, leetcodeDifficultyLabel, leetcodeTop100Problem } from '../domain/leetcode-top-100.js'
import { LEETCODE_CATEGORIES, LEETCODE_DIFFICULTY_IDS, leetcodeProblemQueryLabel, listLeetcodeProblems, normalizeLeetcodeDifficulties, resolveLeetcodeProblem } from '../domain/leetcode-problems.js'
import { effectiveLeetcodeGuidance } from '../domain/leetcode-guidance.js'
import {
  askQuestion, completeLeetcodePractice, completePractice, createPractice, deleteQuestion,
  evaluateAnswer, findQuestion, reopenPractice, revealHint, saveExplanation, saveMaterials, submitAnswer,
  updatePractice, updateQuestion,
} from '../domain/practice.js'
import {
  clearSessionQuestion, consumeSessionBinding, createSessionBinding, focusSessionQuestion, transferSessionBinding,
} from '../domain/session.js'
import { buildInsights, toPracticeDetailDto, toPracticeSummaryDto, toQuestionDto, toSessionContextDto } from './dto.js'
import { referenceBrief, referenceSearchItem, topicBrief } from './leetcode-reference-view.js'
import { materialsWithReference } from '../domain/leetcode-reference.js'
import { validateApplicationPorts } from './ports.js'
import { assertModeCapability } from '../domain/mode-capabilities.js'
import { formatCodeAnswer } from '../domain/code-answer.js'
import { guidanceSource, questionLearningView, questionSolutionView } from '../domain/question-learning.js'
import { LeetcodeLearningCache } from './leetcode-learning-cache.js'
import { LEARNING_REQUEST_TIMEOUT, reusableGuidance } from '../domain/learning-cache.js'
import { leetcodeCompletionProgress } from '../domain/leetcode-completion.js'

function requiredId(value, name) {
  assertDomain(typeof value === 'string' && value.trim(), `INVALID_${name.toUpperCase()}`, `${name} 不能为空`)
  return value.trim()
}

function validatePresentation(binding, input) {
  const presentationId = requiredId(input.presentationId, 'presentationId')
  const practiceId = requiredId(input.practiceId, 'practiceId')
  const questionId = requiredId(input.questionId, 'questionId')
  const revision = Number(input.sessionRevision)
  assertDomain(Number.isInteger(revision), 'INVALID_SESSION_REVISION', '卡片缺少有效的会话修订号')
  assertDomain(
    binding.practiceId === practiceId && binding.currentQuestionId === questionId && binding.revision === revision,
    'STALE_PRESENTATION', '这张卡片已经完成，不能再次操作',
    { presentationId, currentRevision: binding.revision, expectedRevision: revision },
  )
  return presentationId
}

// 换下一题会用旧练习的配置创建新练习：0.6.0 之前的练习只存了 language，
// 这里补齐引导强度（缺省按标准模式），显式传来的新配置优先。
function leetcodeConfigFor(currentConfig = {}, requestedConfig = null, filters = null) {
  const source = requestedConfig || currentConfig
  const config = {
    ...source,
    language: source.language,
    guidance: effectiveLeetcodeGuidance(source),
  }
  const difficulties = normalizeLeetcodeDifficulties(filters?.difficulties !== undefined ? filters.difficulties : filters?.difficulty ? [filters.difficulty] : source.difficulties)
  if (difficulties.length) config.difficulties = difficulties
  else delete config.difficulties
  const category = filters?.category === undefined ? source.category : filters.category
  assertDomain(category === undefined || category === null || (typeof category === 'string' && (!category.trim() || LEETCODE_CATEGORIES.includes(category.trim()))), 'INVALID_LEETCODE_CATEGORY', '请选择题库中的专题')
  if (category?.trim()) config.category = category.trim()
  else delete config.category
  return config
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
    this.codeSubmissions = new Map()
    this.leetcodeAdvances = new Map()
    this.learningCache = new LeetcodeLearningCache(this.repository, this.clock)
    this.completionHistorySync = null
  }

  async #practice(practiceId) {
    const id = requiredId(practiceId, 'practiceId')
    const practice = await this.repository.getPractice(id)
    if (!practice) throw new DomainError('PRACTICE_NOT_FOUND', `找不到练习：${id}`)
    return this.learningCache.hydrate(practice)
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
    await this.syncLeetcodeCompletionHistory()
    return new Map((await this.repository.listLeetcodeProgress()).map((item) => [item.slug, item]))
  }

  async syncLeetcodeCompletionHistory() {
    if (!this.completionHistorySync) this.completionHistorySync = (async () => {
      const existing = new Set((await this.repository.listLeetcodeProgress()).map((item) => item.slug))
      const practices = await this.repository.listPractices({ mode: 'leetcode' })
      const history = new Map()
      for (const practice of practices) for (const item of leetcodeCompletionProgress(practice, { historical: true })) {
        if (!existing.has(item.slug) && (!history.has(item.slug) || history.get(item.slug).completedAt > item.completedAt)) history.set(item.slug, item)
      }
      const progress = [...history.values()]
      if (progress.length) await this.repository.commit({ leetcodeProgress: progress })
      return progress.length
    })().catch((error) => { this.completionHistorySync = null; throw error })
    return this.completionHistorySync
  }

  async #drawLeetcodeQuestion(practice, binding, now, { selection = null, filters = null, excludedSlugs = [], selectionMode = 'random' } = {}) {
    assertDomain(practice.mode === 'leetcode', 'INVALID_PRACTICE_MODE', '只有刷力扣模式可以从题库抽题')
    assertDomain(['random', 'ordered'].includes(selectionMode), 'INVALID_LEETCODE_SELECTION_MODE', '请选择按专题顺序或随机出题')
    if (filters?.difficulties !== undefined || filters?.difficulty || filters?.category !== undefined) practice = { ...practice, config: leetcodeConfigFor(practice.config, null, filters) }
    const picked = selection
      ? resolveLeetcodeProblem(selection)
      : await this.#randomLeetcodeProblem(practice, excludedSlugs, filters, selectionMode)
    // 点名热题 100 之外的题时，题解库里的官方元数据比“只有题名”的自定义题目更准。
    const problem = picked?.custom ? await this.#enrichCustomProblem(picked) : picked
    assertDomain(
      problem,
      'LEETCODE_PROBLEM_NOT_FOUND',
      selection
        ? `找不到指定的力扣题目：${leetcodeProblemQueryLabel(selection)}`
        : `没有符合条件的力扣题目：${[filters?.category, filters?.difficulty, ...(filters?.difficulties || practice.config.difficulties || [])].filter(Boolean).join(' · ') || '（空）'}`,
    )
    const added = askQuestion(practice, {
      id: this.ids.next('question'),
      prompt: [problem.id, problem.title].map((item) => String(item || '').trim()).filter(Boolean).join('. '),
      leetcode: problem,
      now,
    })
    added.practice = await this.learningCache.hydrate(added.practice)
    added.question = findQuestion(added.practice, added.question.id)
    // 展示题目不必请求模型重述已保存的官方题面，AI 只在缺少引导或用户请求详解时参与。
    const reference = await this.#referenceForSlug(problem.slug)
    if (!added.question.materials && reference?.statement) {
      const materials = materialsWithReference({ statement: reference.statement }, reference)
      materials.source.kind = 'local'
      added.question = { ...added.question, materials }
      added.practice = { ...added.practice, questions: added.practice.questions.map((q) => q.id === added.question.id ? added.question : q) }
    }
    return { ...added, binding: focusSessionQuestion(binding, added.question.id, now) }
  }

  async #enrichCustomProblem(problem) {
    const reference = await this.#referenceForSlug(problem.slug)
    if (!reference) return problem
    return {
      ...problem,
      id: reference.number || problem.id,
      title: reference.title || problem.title,
      slug: reference.slug,
      difficulty: reference.difficulty || problem.difficulty,
      category: reference.category || problem.category,
      url: reference.url || problem.url,
    }
  }

  async #randomLeetcodeProblem(practice, excludedSlugs, filters = null, selectionMode = 'random') {
    const progress = await this.#leetcodeProgress()
    const used = new Set([...practice.questions.map((question) => question.leetcode?.slug).filter(Boolean), ...excludedSlugs])
    const base = listLeetcodeProblems({ category: filters?.category === undefined ? practice.config.category : filters.category, difficulty: filters?.difficulty,
      difficulties: filters?.difficulties !== undefined ? filters.difficulties : filters?.difficulty ? undefined : practice.config.difficulties,
      limit: LEETCODE_TOP_100.length })
    if (base.length === 0) return null
    if (selectionMode === 'ordered') {
      const previousSlug = excludedSlugs[0] || practice.questions.at(-1)?.leetcode?.slug
      const position = base.findIndex((problem) => problem.slug === previousSlug)
      return { ...base[(position + 1) % base.length] }
    }
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
    const presentationId = validatePresentation(binding, input)
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

  // 卡片消耗与代码作答一次提交；失败不会丢掉卡片，重复请求不会产生两条作答。
  async submitAtomicCodeAnswer(sessionId, input) {
    const previous = this.codeSubmissions.get(sessionId) || Promise.resolve()
    const task = previous.catch(() => {}).then(async () => {
      const answer = formatCodeAnswer(input)
      const now = this.clock.now()
      const { binding, practice } = await this.#session(sessionId)
      validatePresentation(binding, input)
      if (practice.mode === 'leetcode') {
        assertDomain(input.language === practice.config.language, 'CODE_LANGUAGE_MISMATCH', '代码语言需要与当前练习的编程语言一致')
      }
      const added = submitAnswer(practice, {
        questionId: input.questionId, attemptId: this.ids.next('attempt'), answer, now,
      })
      const nextBinding = consumeSessionBinding(binding, now)
      await this.repository.commit({ practice: added.practice, binding: nextBinding })
      return this.#result('attempt-detail', { questionId: input.questionId, ...added.attempt }, nextBinding, {
        references: { attemptId: added.attempt.id },
      })
    })
    this.codeSubmissions.set(sessionId, task)
    try { return await task } finally {
      if (this.codeSubmissions.get(sessionId) === task) this.codeSubmissions.delete(sessionId)
    }
  }

  async createAtomicEvaluation(sessionId, input) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    const questionId = requiredId(input.questionId, 'questionId')
    const attemptId = requiredId(input.attemptId, 'attemptId')
    const added = evaluateAnswer(practice, { ...input, questionId, attemptId, now })
    await this.repository.commit({ practice: added.practice,
      leetcodeProgress: leetcodeCompletionProgress(added.practice, { at: now, questionId, attemptId, requireEvaluation: true }) })
    return this.#result('evaluation-detail', { questionId, attemptId, ...added.evaluation }, binding, {
      references: { attemptId },
    })
  }

  async createAtomicExplanation(sessionId, input) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    const questionId = requiredId(input.questionId, 'questionId')
    const pending = await this.learningCache.pending(questionId, 'solution')
    assertDomain(!(input.requestId && input.scope === 'attempt'), 'INVALID_REFERENCE_SCOPE', '题库生成请求只能保存通用题解，个人修正版请单独保存')
    const added = saveExplanation(practice, { ...input, questionId, scope: input.scope || (pending ? 'reference' : undefined),
      replace: input.replace === true, now })
    const question = findQuestion(added.practice, questionId)
    const write = added.explanation.scope === 'reference'
      ? await this.learningCache.write(practice, question, 'solution', added.explanation, input.requestId) : null
    if (write) Object.assign(added.explanation, { cacheKey: write.key, reused: false })
    await this.repository.commit({ practice: added.practice, learningCache: write ? [write] : [] })
    return this.#result('explanation-detail', { questionId, ...added.explanation }, binding)
  }

  async saveAtomicMaterials(sessionId, input) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    const questionId = requiredId(input.questionId || binding.currentQuestionId, 'questionId')
    const target = findQuestion(practice, questionId)
    const request = await this.learningCache.pending(questionId, 'guidance')
    if (request) {
      const expected = effectiveLeetcodeGuidance(practice.config) === 'guided' ? 4 : 3
      assertDomain(input.materials?.hints?.length === expected && guidanceSource({ materials: input.materials }) === 'ai',
        'INVALID_AI_GUIDANCE', `AI 引导必须包含 ${expected} 级针对本题的具体提示，不能使用通用模板`)
    }
    // 示例与数据范围属于事实：题解库里有官方题面时以官方为准，其余表达仍按模型提供的内容保存。
    const reference = await this.#referenceForSlug(target.leetcode?.slug)
    const saved = saveMaterials(practice, {
      questionId,
      materials: materialsWithReference(input.materials, reference),
      replace: input.replace === true || (target.materials?.source?.kind === 'local' && !target.materials.hints.length),
      resetHints: Boolean(request) || guidanceSource(target) === 'local',
      now,
    })
    const write = reusableGuidance(practice, saved.question) && (request || input.reusable === true || !target.attempts.length)
      ? await this.learningCache.write(practice, saved.question, 'guidance', saved.materials, input.requestId) : null
    if (write) saved.materials.source = { ...saved.materials.source, cacheKey: write.key, reused: false }
    await this.repository.commit({ practice: saved.practice, learningCache: write ? [write] : [] })
    return this.#result('question-detail', toQuestionDto(saved.question, practice), binding, {
      references: { questionId },
    })
  }

  async #referenceForSlug(slug) {
    if (!slug) return null
    return this.repository.findReference(slug)
  }

  // 题解库读取：优先看会话当前题，也可以直接按 slug / 题号 / 题名取一道题的参考。
  async readAtomicReference(sessionId, input = {}) {
    const anchor = resolveLeetcodeProblem({ slug: input.slug, number: input.number, title: input.title })
    let question = null
    let practice = null
    if (!anchor) {
      const session = await this.#session(sessionId).catch(() => null)
      if (!session) throw new DomainError('REFERENCE_NOT_SPECIFIED', '必须指定题目，或先在会话里绑定一道力扣题')
      practice = session.practice
      question = findQuestion(practice, requiredId(input.questionId || session.binding.currentQuestionId, 'questionId'))
      if (!question.leetcode) throw new DomainError('REFERENCE_LEETCODE_ONLY', '题解库只覆盖力扣题')
    }
    const slug = anchor?.slug || question.leetcode.slug
    const reference = await this.#referenceForSlug(slug)
    if (!reference) {
      throw new DomainError('REFERENCE_NOT_FOUND', `题解库里没有这道题：${slug || anchor?.title || '（未知）'}`, { slug })
    }
    const topicNotes = reference.category ? await this.repository.findTopicNotes(reference.category) : null
    const brief = referenceBrief(reference, {
      topicNotes,
      hardcode: reference.hardcode,
      question: question ? toQuestionDto(question, practice) : null,
    })
    return this.#result('reference-brief', brief, null, { references: { problemSlug: reference.slug } })
  }

  async searchAtomicReferences(input = {}) {
    const problems = await this.repository.listReferences({
      keyword: input.keyword,
      category: input.category,
      difficulty: input.difficulty,
      limit: input.limit,
    })
    const progress = await this.#leetcodeProgress()
    return this.#result('reference-search', {
      query: { keyword: input.keyword || '', category: input.category || '', difficulty: input.difficulty || '' },
      total: problems.length,
      categories: [...LEETCODE_CATEGORIES],
      problems: problems.map((problem) => ({
        ...referenceSearchItem(problem),
        completed: progress.get(problem.slug)?.completed === true,
      })),
    })
  }

  async readAtomicTopicNotes(category) {
    const name = requiredId(category, 'category')
    const topicNotes = await this.repository.findTopicNotes(name)
    if (!topicNotes) throw new DomainError('TOPIC_NOTES_NOT_FOUND', `题解库里没有「${name}」的前置知识`)
    const related = LEETCODE_TOP_100.filter((problem) => problem.category === name).slice(0, 6)
      .map((problem) => ({ slug: problem.slug, number: problem.id, title: problem.title, difficulty: problem.difficulty }))
    return this.#result('topic-notes', topicBrief(topicNotes, { category: name, related }))
  }

  async listAtomicTopics() {
    const topics = await this.repository.listTopicNotes()
    return this.#result('topic-list', {
      total: topics.length,
      topics: topics.map((topic) => ({ category: topic.category, count: topic.topics.length, sourceFile: topic.sourceFile })),
    })
  }

  async revealAtomicHint(sessionId, questionId = null) {
    const now = this.clock.now()
    const { binding, practice } = await this.#session(sessionId)
    const targetId = questionId || binding.currentQuestionId
    assertDomain(Boolean(targetId), 'QUESTION_NOT_FOCUSED', '必须指定需要提示的题目')
    const question = findQuestion(practice, targetId)
    const request = await this.learningCache.read(await this.learningCache.context(practice, question, 'guidance'))
    assertDomain(request?.status !== 'generating', 'AI_GUIDANCE_PENDING', 'AI 引导正在生成，请稍候')
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
    await this.repository.commit({ practice: completed, unbindSessionId: binding.sessionId,
      leetcodeProgress: leetcodeCompletionProgress(completed, { at: now }) })
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
      selectionMode: options.selectionMode || 'random',
    })
    await this.repository.commit({ practice: drawn.practice, binding: drawn.binding })
    return this.#result('question-detail', toQuestionDto(drawn.question, practice), drawn.binding)
  }

  async searchLeetcodeProblems(input = {}) {
    const problems = listLeetcodeProblems({
      keyword: input.keyword,
      category: input.category,
      difficulty: input.difficulty,
      difficulties: input.difficulties,
      limit: input.limit,
    })
    const progress = await this.#leetcodeProgress()
    return this.#result('leetcode-search', {
      query: {
        keyword: input.keyword || '',
        category: input.category || '',
        difficulty: input.difficulty || '',
        ...(input.difficulties === undefined ? {} : { difficulties: normalizeLeetcodeDifficulties(input.difficulties) }),
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
    const { completed, drawn } = await this.#nextLeetcodePractice(sessionId, practice, now, options)
    await this.repository.commit({ practices: [completed, drawn.practice], binding: drawn.binding,
      leetcodeProgress: leetcodeCompletionProgress(completed, { at: now }) })
    return this.#result('question-detail', toQuestionDto(drawn.question, drawn.practice), drawn.binding)
  }

  async #nextLeetcodePractice(sessionId, practice, now, options) {
    assertDomain(practice.mode === 'leetcode', 'LEETCODE_PRACTICE_REQUIRED', '当前练习不是力扣模式')
    const previousSlug = practice.questions.at(-1)?.leetcode?.slug
    const completed = completeLeetcodePractice(practice, { now })
    const nextPractice = createPractice({
      id: this.ids.next('practice'), mode: 'leetcode', config: leetcodeConfigFor(practice.config, options.config, options.filters), now,
    })
    const nextBinding = createSessionBinding({ sessionId, practiceId: nextPractice.id, now })
    const drawn = await this.#drawLeetcodeQuestion(nextPractice, nextBinding, now, {
      selection: options.selection || null,
      filters: options.filters || null,
      excludedSlugs: previousSlug ? [previousSlug] : [],
      selectionMode: options.selectionMode || 'random',
    })
    return { completed, drawn }
  }

  async advanceLeetcodePractice(sessionId, practiceId, options = {}) {
    const practiceKey = requiredId(practiceId, 'practiceId')
    const previous = this.leetcodeAdvances.get(practiceKey) || Promise.resolve()
    const task = previous.catch(() => {}).then(() => this.#advanceLeetcodePractice(sessionId, practiceKey, options))
    this.leetcodeAdvances.set(practiceKey, task)
    try { return await task }
    finally { if (this.leetcodeAdvances.get(practiceKey) === task) this.leetcodeAdvances.delete(practiceKey) }
  }

  async #advanceLeetcodePractice(sessionId, practiceId, options) {
    const id = requiredId(sessionId, 'sessionId')
    const practice = await this.#practice(practiceId)
    const previousBinding = await this.repository.getSessionBindingByPractice(practice.id)
    const { completed, drawn } = await this.#nextLeetcodePractice(id, practice, this.clock.now(), options)
    await this.repository.commit({ practices: [completed, drawn.practice], binding: drawn.binding,
      leetcodeProgress: leetcodeCompletionProgress(completed, { at: completed.completedAt }),
      ...(previousBinding && previousBinding.sessionId !== id ? { unbindSessionId: previousBinding.sessionId } : {}) })
    return this.#result('session-context', toSessionContextDto(drawn.binding, drawn.practice), drawn.binding)
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

  async getQuestionLearning(practiceId, questionId, sessionId = null) {
    const practice = await this.#practice(practiceId)
    const question = findQuestion(practice, requiredId(questionId, 'questionId'))
    const reference = await this.#referenceForSlug((question.leetcode || question.hot100)?.slug)
    const view = questionLearningView(practice, question, reference)
    const context = await this.learningCache.context(practice, question, 'guidance')
    const request = await this.learningCache.read(context)
    const binding = sessionId ? await this.repository.getSessionBinding(sessionId) : null
    view.guidance.canAutoGenerate = view.guidance.enabled && view.guidance.canGenerate
      && binding?.practiceId === practice.id && binding?.currentQuestionId === question.id
    if (request?.requestId) {
      Object.assign(view.guidance, { status: request.status, requestId: request.requestId, error: request.error || '' })
      if (request.status === 'generating') view.guidance.canReveal = false
    }
    return this.#result('question-learning', view, null, {
      references: { practiceId: practice.id, questionId: question.id },
    })
  }

  async generateQuestionGuidance(sessionId, { practiceId, questionId, force = false, automatic = false }, dispatch) {
    const practice = await this.#practice(practiceId)
    const question = findQuestion(practice, requiredId(questionId, 'questionId'))
    assertDomain(practice.status === 'active', 'PRACTICE_COMPLETED', '请先重新打开练习，再生成引导')
    assertModeCapability(practice, 'materials.create', 'MATERIALS_NOT_ALLOWED', '当前模式不提供 AI 引导')
    const binding = await this.repository.getSessionBinding(sessionId)
    const current = binding?.practiceId === practice.id && binding?.currentQuestionId === question.id
    if (automatic) assertDomain(current, 'GUIDANCE_SESSION_CHANGED', '请先切换到这道题，再生成 AI 引导')
    if (!force && guidanceSource(question) === 'ai') return this.getQuestionLearning(practice.id, question.id, sessionId)
    const context = await this.learningCache.context(practice, question, 'guidance')
    assertDomain(context, 'GUIDANCE_LEETCODE_REQUIRED', '只有力扣题支持可复用引导')
    const reservation = await this.repository.reserveLearningRequest(context, { requestId: this.ids.next('guidance'), questionId: question.id,
      now: this.clock.now(), force, timeout: LEARNING_REQUEST_TIMEOUT })
    if (!reservation.claimed) return { ...(await this.getQuestionLearning(practice.id, question.id, sessionId)),
      analysisQueued: reservation.entry?.status === 'generating', cacheHit: Boolean(reservation.entry?.payload) }
    const request = reservation.entry
    if (!current) {
      try {
        await this.bindAtomicPractice(sessionId, practice.id)
        await this.focusAtomicQuestion(sessionId, question.id)
      } catch (error) {
        await this.repository.failLearningRequest(context.key, request.requestId, '练习切换失败，请手动重试。')
        throw error
      }
    }
    let queued = false
    try {
      queued = Boolean(dispatch({ type: 'guidance.generate', practiceId: practice.id, questionId: question.id,
        requestId: request.requestId, mode: practice.mode, guidance: effectiveLeetcodeGuidance(practice.config), includeModeContext: true }))
    } catch { /* 投递失败保持原题、草稿和材料。 */ }
    if (!queued) {
      await this.repository.failLearningRequest(context.key, request.requestId, 'AI 请求未启动，请确认当前对话可用后重试。')
    }
    return { ...(await this.getQuestionLearning(practice.id, question.id, sessionId)), analysisQueued: queued }
  }

  async getQuestionSolution(practiceId, questionId) {
    const practice = await this.#practice(practiceId)
    const question = findQuestion(practice, requiredId(questionId, 'questionId'))
    const reference = await this.#referenceForSlug((question.leetcode || question.hot100)?.slug)
    const view = questionSolutionView(practice, question, reference)
    const context = await this.learningCache.context(practice, question, 'solution')
    const request = await this.learningCache.read(context)
    Object.assign(view, { status: request?.requestId ? request.status : view.available ? 'ready' : 'missing',
      requestId: request?.requestId || '', error: request?.error || '', canGenerate: practice.status === 'active' && view.allowed })
    return this.#result('question-solution', view, null, {
      references: { practiceId: practice.id, questionId: question.id },
    })
  }

  async generateQuestionSolution(sessionId, { practiceId, questionId, force = false }, dispatch) {
    const practice = await this.#practice(practiceId)
    const question = findQuestion(practice, requiredId(questionId, 'questionId'))
    assertDomain(practice.status === 'active', 'PRACTICE_COMPLETED', '请先重新打开练习，再生成答案')
    assertModeCapability(practice, 'explanation.create', 'REVEAL_NOT_ALLOWED', '当前模式不提供看答案')
    const solution = await this.getQuestionSolution(practice.id, question.id)
    if (!force && solution.resource.data.available) return { ...solution, analysisQueued: false, cacheHit: true }
    const context = await this.learningCache.context(practice, question, 'solution')
    let reservation = null
    if (context) {
      reservation = await this.repository.reserveLearningRequest(context, { requestId: this.ids.next('solution'), questionId: question.id,
        now: this.clock.now(), force, timeout: LEARNING_REQUEST_TIMEOUT })
      if (!reservation.claimed) return { ...(await this.getQuestionSolution(practice.id, question.id)),
        analysisQueued: reservation.entry?.status === 'generating', cacheHit: Boolean(reservation.entry?.payload) }
    }
    try {
      const binding = await this.repository.getSessionBinding(sessionId)
      if (binding?.practiceId !== practice.id || binding.currentQuestionId !== question.id) {
        await this.bindAtomicPractice(sessionId, practice.id)
        await this.focusAtomicQuestion(sessionId, question.id)
      }
      const queued = Boolean(dispatch({ type: 'review.generate', practiceId: practice.id, questionId: question.id,
        requestId: reservation?.entry.requestId, force, mode: practice.mode, guidance: effectiveLeetcodeGuidance(practice.config) }))
      if (!queued && context) await this.repository.failLearningRequest(context.key, reservation.entry.requestId, 'AI 请求未启动，请手动重试。')
      return { ...(await this.getQuestionSolution(practice.id, question.id)), analysisQueued: queued }
    } catch (error) {
      if (context) await this.repository.failLearningRequest(context.key, reservation.entry.requestId, 'AI 请求失败，请手动重试。')
      throw error
    }
  }

  async prepareCodeReviewReference(practiceId, questionId) {
    const solution = (await this.getQuestionSolution(practiceId, questionId)).resource.data
    if (solution.available) return { hasReferenceSolution: true }
    const practice = await this.#practice(practiceId)
    const question = findQuestion(practice, questionId)
    const context = await this.learningCache.context(practice, question, 'solution')
    if (!context) return { hasReferenceSolution: false }
    const reservation = await this.repository.reserveLearningRequest(context, { requestId: this.ids.next('solution'), questionId,
      now: this.clock.now(), timeout: LEARNING_REQUEST_TIMEOUT })
    return reservation.claimed ? { hasReferenceSolution: false, requestId: reservation.entry.requestId }
      : { hasReferenceSolution: Boolean(reservation.entry.payload), referenceSolutionPending: reservation.entry.status === 'generating' }
  }

  async failCodeReviewReference(questionId, requestId) {
    if (!requestId) return
    const request = await this.learningCache.pending(questionId, 'solution')
    if (request?.requestId === requestId) await this.repository.failLearningRequest(request.key, requestId, 'AI 代码分析请求未启动，请手动重试。')
  }

  async revealQuestionLearningHint(practiceId, questionId) {
    const practice = await this.#practice(practiceId)
    const question = findQuestion(practice, requiredId(questionId, 'questionId'))
    assertModeCapability(practice, 'materials.reveal', 'HINTS_NOT_ALLOWED', '当前模式不提供提示阶梯')
    assertDomain(guidanceSource(question) === 'ai', 'AI_GUIDANCE_REQUIRED', '请先让 AI 为这道题生成引导')
    const request = await this.learningCache.read(await this.learningCache.context(practice, question, 'guidance'))
    assertDomain(request?.status !== 'generating', 'AI_GUIDANCE_PENDING', 'AI 引导正在生成，请稍候')
    const revealed = revealHint(practice, { questionId: question.id, now: this.clock.now() })
    await this.repository.commit({ practice: revealed.practice })
    return this.getQuestionLearning(practice.id, question.id)
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
      difficultyTags: true,
      difficulties: LEETCODE_DIFFICULTY_IDS.map((id) => ({ id, label: leetcodeDifficultyLabel(id), tag: id,
        count: LEETCODE_TOP_100.filter((problem) => problem.difficulty === id).length })),
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
