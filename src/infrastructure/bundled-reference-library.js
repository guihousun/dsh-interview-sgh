import library from '../data/hot100-reference-library.json' with { type: 'json' }

// 发布包携带独立题库快照；不依赖作者电脑的路径、SQLite 或联网抓题。
export function initializeBundledReferenceLibrary(repository) {
  return repository.seedReferenceLibrary?.({ references: library.references, topics: library.topics }) || null
}

export const bundledReferenceLibraryInfo = Object.freeze({
  snapshotId: library.snapshotId,
  references: library.references.length,
  topics: library.topics.length,
})
