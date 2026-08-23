import test from 'node:test'
import assert from 'node:assert/strict'
import { ARTIFACT_KINDS, createInteractionArtifact } from '../../src/application/interaction-artifact.js'
import { createPresentationResult } from '../../src/application/presentation-result.js'

test('展示产物只校验展示所需资源引用', () => {
  assert.deepEqual(createInteractionArtifact(ARTIFACT_KINDS.QUESTION, {
    practiceId: 'practice-1', questionId: 'question-1',
  }), { kind: 'question', practiceId: 'practice-1', questionId: 'question-1' })
  assert.throws(() => createInteractionArtifact(ARTIFACT_KINDS.REVIEW, { practiceId: 'practice-1' }), /questionId/)
})

test('展示结果不携带业务动作或工作流阶段', () => {
  const result = createPresentationResult({
    kind: ARTIFACT_KINDS.QUESTION,
    references: { practiceId: 'practice-1', questionId: 'question-1' },
    text: '题目已展示，请开始作答。',
  })
  assert.equal(result.action, 'presentation.question')
  assert.equal('phase' in result, false)
  assert.equal('agentTasks' in result, false)
})
