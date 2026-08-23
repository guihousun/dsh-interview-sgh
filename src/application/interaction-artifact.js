export const ARTIFACT_KINDS = Object.freeze({
  QUESTION: 'question',
  REVIEW: 'review',
  LIBRARY: 'library',
  INSIGHTS: 'insights',
  LEETCODE_CATALOG: 'leetcode-catalog',
  DELETED: 'deleted',
  EXPORTED: 'exported',
  FINISHED: 'finished',
})

const REFERENCE_REQUIREMENTS = Object.freeze({
  [ARTIFACT_KINDS.QUESTION]: ['practiceId', 'questionId'],
  [ARTIFACT_KINDS.REVIEW]: ['practiceId', 'questionId'],
  [ARTIFACT_KINDS.FINISHED]: ['practiceId'],
})

export function createInteractionArtifact(kind, references = {}) {
  if (!Object.values(ARTIFACT_KINDS).includes(kind)) {
    throw new TypeError(`不支持的交互产物：${String(kind)}`)
  }
  for (const name of REFERENCE_REQUIREMENTS[kind] || []) {
    const value = references[name]
    if (typeof value !== 'string' || !value.trim()) {
      throw new TypeError(`${kind} 交互产物缺少 ${name} 引用`)
    }
  }
  return Object.freeze({ kind, ...references })
}
