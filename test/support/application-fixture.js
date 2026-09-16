import { InterviewApplication } from '../../src/application/interview-application.js'

function clone(value) {
  return value === undefined ? undefined : structuredClone(value)
}

export class InMemoryInterviewRepository {
  constructor() {
    this.practices = new Map()
    this.bindings = new Map()
    this.leetcodeProgress = new Map()
    this.references = new Map()
    this.topicNotes = new Map()
  }

  async findReference(slug) { return clone(this.references.get(slug) || null) }

  async listReferences({ category, difficulty, keyword, limit = 20 } = {}) {
    return [...this.references.values()]
      .filter((item) => !category || item.category === category)
      .filter((item) => !difficulty || item.difficulty === difficulty)
      .filter((item) => !keyword || item.slug.includes(keyword) || item.title.includes(keyword) || item.number === keyword
        || (item.category || '').includes(keyword) || (item.tags || []).some((tag) => tag.includes(keyword)))
      .sort((left, right) => Number(left.number) - Number(right.number))
      .slice(0, limit)
      .map(clone)
  }

  async findTopicNotes(category) { return clone(this.topicNotes.get(category) || null) }

  async listTopicNotes() { return [...this.topicNotes.values()].map(clone) }

  async saveReferenceLibrary({ references = [], topics = [] } = {}) {
    for (const reference of references) this.references.set(reference.slug, clone(reference))
    for (const topic of topics) this.topicNotes.set(topic.category, clone(topic))
    return { references: references.length, topics: topics.length }
  }

  async referenceStats() {
    const withNotes = [...this.references.values()].filter((item) => item.idea || item.mnemonic).length
    return { total: this.references.size, withNotes, topics: this.topicNotes.size }
  }

  async getPractice(id) { return clone(this.practices.get(id) || null) }

  async listPractices(filters = {}) {
    return [...this.practices.values()]
      .filter((practice) => !filters.mode || practice.mode === filters.mode)
      .filter((practice) => !filters.status || practice.status === filters.status)
      .filter((practice) => !filters.query || JSON.stringify({ topic: practice.topic, source: practice.source, config: practice.config }).toLowerCase().includes(String(filters.query).toLowerCase()))
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map(clone)
  }

  async getSessionBinding(sessionId) { return clone(this.bindings.get(sessionId) || null) }

  async getSessionBindingByPractice(practiceId) {
    return clone([...this.bindings.values()].find((binding) => binding.practiceId === practiceId) || null)
  }

  async commit({ practice, practices = [], binding, unbindSessionId }) {
    for (const item of [...practices, ...(practice ? [practice] : [])]) this.practices.set(item.id, clone(item))
    if (unbindSessionId) this.bindings.delete(unbindSessionId)
    if (binding) {
      for (const [sessionId, selected] of this.bindings) {
        if (selected.practiceId === binding.practiceId) this.bindings.delete(sessionId)
      }
      this.bindings.set(binding.sessionId, clone(binding))
    }
  }

  async deletePractice(id) {
    this.practices.delete(id)
    for (const [sessionId, binding] of this.bindings) if (binding.practiceId === id) this.bindings.delete(sessionId)
  }

  async clearSessionBinding(sessionId) { this.bindings.delete(sessionId) }

  async listLeetcodeProgress() { return [...this.leetcodeProgress.values()].map(clone) }

  async saveLeetcodeProgress(progress) { this.leetcodeProgress.set(progress.slug, clone(progress)) }
}

export function applicationFixture() {
  const repository = new InMemoryInterviewRepository()
  const published = []
  const exported = []
  let now = 100
  let sequence = 0
  const application = new InterviewApplication({
    repository,
    events: { async publish(events) { published.push(...clone(events)) } },
    exporter: { async export(practices) { exported.push(...clone(practices)); return practices.map((practice) => ({ practiceId: practice.id, name: `${practice.topic}.md`, token: `download-${practice.id}` })) } },
    clock: { now() { return ++now } },
    ids: { next(prefix) { return `${prefix}-${++sequence}` } },
    random: { next() { return 0 } },
  })
  return { application, repository, published, exported }
}
