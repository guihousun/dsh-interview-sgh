import { assertDomain } from '../domain/errors.js'
import { learningCacheContext, LEARNING_REQUEST_TIMEOUT, reusableExplanation, reusableGuidance } from '../domain/learning-cache.js'

export class LeetcodeLearningCache {
  constructor(repository, clock) {
    this.repository = repository
    this.clock = clock
    this.historySeed = null
  }

  async context(practice, question, kind) {
    const reference = question.leetcode?.slug ? await this.repository.findReference(question.leetcode.slug) : null
    return learningCacheContext(practice, question, kind, reference)
  }

  async seedHistory() {
    if (!this.historySeed) this.historySeed = this.#seedHistory().catch((error) => { this.historySeed = null; throw error })
    return this.historySeed
  }

  async #seedHistory() {
    const practices = await this.repository.listPractices({ mode: 'leetcode' })
    let count = 0
    for (const practice of practices) for (const question of practice.questions) {
      for (const kind of ['guidance', 'solution']) {
        const eligible = kind === 'guidance'
          ? !question.attempts.length && reusableGuidance(practice, question)
          : reusableExplanation(practice, question)
        if (!eligible) continue
        const context = await this.context(practice, question, kind)
        if (!context) continue
        const payload = kind === 'guidance' ? question.materials : question.explanation
        // 已经带版本标记的旧缓存不重新贴上新版本标签。
        const previousKey = kind === 'guidance' ? payload.source?.cacheKey : payload.cacheKey
        if (previousKey && previousKey !== context.key) continue
        // 老档案本身没有版本标记；一旦回收过，参考资料改变后不能重新标成当前版本。
        const origin = await this.repository.findLearningOrigin(question.id, kind)
        if (origin && origin.key !== context.key) continue
        count += await this.repository.seedLearningCache({ ...context, payload, originQuestionId: question.id,
          createdAt: kind === 'solution' ? payload.createdAt : question.createdAt, updatedAt: this.clock.now() }) ? 1 : 0
      }
    }
    return count
  }

  async read(context) {
    if (!context) return null
    await this.seedHistory()
    let entry = await this.repository.getLearningCache(context.key)
    if (entry?.status === 'generating' && this.clock.now() - entry.startedAt >= LEARNING_REQUEST_TIMEOUT) {
      await this.repository.failLearningRequest(context.key, entry.requestId, 'AI 请求尚未完成，请检查对话中的状态后手动重试。')
      entry = await this.repository.getLearningCache(context.key)
    }
    return entry
  }

  async hydrate(practice) {
    if (practice.mode !== 'leetcode') return practice
    const questions = []
    for (const original of practice.questions) {
      let question = original
      const context = await this.context(practice, question, 'guidance')
      const entry = await this.read(context)
      const origin = question.materials?.source?.cacheKey ? null : await this.repository.findLearningOrigin(question.id, 'guidance')
      const currentKey = question.materials?.source?.cacheKey || origin?.key
      if (entry?.payload && (!reusableGuidance(practice, question) || currentKey)) {
        question = { ...question, hintLevel: currentKey === context.key ? question.hintLevel : 0,
          materials: { ...entry.payload, source: { ...entry.payload.source, cacheKey: context.key,
            reused: entry.originQuestionId !== question.id } } }
      } else if (currentKey && currentKey !== context.key) {
        // 题目材料可以保留用于读题，旧版本引导不再作为有效引导展示。
        question = { ...question, hintLevel: 0, materials: { ...question.materials, hints: [], knowledge: [] } }
      }
      const solutionContext = await this.context(practice, question, 'solution')
      const solution = await this.read(solutionContext)
      const solutionOrigin = question.explanation?.cacheKey ? null : await this.repository.findLearningOrigin(question.id, 'solution')
      const solutionKey = question.explanation?.cacheKey || (question.explanation?.scope !== 'attempt' && solutionOrigin?.key)
      if (solution?.payload && (!question.explanation || solutionKey)) {
        question = { ...question, explanation: { ...solution.payload, scope: 'reference', cacheKey: solutionContext.key,
          reused: solution.originQuestionId !== question.id } }
      } else if (solutionKey && solutionKey !== solutionContext.key) {
        question = { ...question, explanation: null }
      }
      questions.push(question)
    }
    return { ...practice, questions }
  }

  async pending(questionId, kind) {
    return this.repository.findLearningRequest(questionId, kind)
  }

  async write(practice, question, kind, payload, requestId = null) {
    const context = await this.context(practice, question, kind)
    if (!context) return null
    const pending = await this.pending(question.id, kind)
    if (requestId) assertDomain(pending?.requestId === requestId && pending.key === context.key,
      'LEARNING_REQUEST_STALE', '生成请求已失效，请使用当前请求重新保存')
    else if (pending?.key !== context.key && pending?.status === 'generating') {
      assertDomain(false, 'LEARNING_REQUEST_STALE', '题目参考资料已经改变，请重新生成')
    }
    return { ...context, payload, originQuestionId: question.id, createdAt: this.clock.now(), updatedAt: this.clock.now(),
      requestId: requestId || pending?.requestId || null }
  }
}
