import assert from 'node:assert/strict'
import test from 'node:test'
import { createAtomicToolDefinitions } from '../../src/adapters/dsh/atomic-tool-definitions.js'
import { ATOMIC_OPERATION_PROTOCOL } from '../../src/protocol/atomic-operation-protocol.js'
import { applicationFixture } from '../support/application-fixture.js'

function toolsFixture() {
  const fixture = applicationFixture()
  const tools = Object.fromEntries(createAtomicToolDefinitions(fixture.application).map((tool) => [tool.name, tool]))
  const exec = { agent: { session: { header: { id: 'session-1' } } } }
  return { ...fixture, tools, exec }
}

test('原子业务工具按资源分组且结果不携带 UI 产物', async () => {
  const fixture = toolsFixture()
  assert.deepEqual(Object.keys(fixture.tools).sort(), [
    'interview_attempt',
    'interview_evaluation',
    'interview_explanation',
    'interview_leetcode',
    'interview_practice',
    'interview_question',
    'interview_session',
  ])
  const created = await fixture.tools.interview_practice.execute({
    operation: 'create', mode: 'bagu', topic: 'JVM',
  }, fixture.exec)
  assert.equal(created.protocol, ATOMIC_OPERATION_PROTOCOL)
  assert.equal(created.resource.data.topic, 'JVM')
  assert.match(created.instruction, /当前激活练习模式为背八股（bagu）/)
  assert.equal(created.artifact, undefined)
})

test('AI 可以组合删除和创建原子操作完成重新出题', async () => {
  const fixture = toolsFixture()
  await fixture.tools.interview_practice.execute({ operation: 'create', mode: 'bagu', topic: 'MySQL' }, fixture.exec)
  const first = await fixture.tools.interview_question.execute({ operation: 'create', prompt: '什么是 redo log？' }, fixture.exec)
  await fixture.tools.interview_question.execute({ operation: 'delete', question_id: first.references.questionId }, fixture.exec)
  const next = await fixture.tools.interview_question.execute({ operation: 'create', prompt: '什么是 undo log？' }, fixture.exec)
  const session = await fixture.tools.interview_session.execute({ operation: 'read' }, fixture.exec)
  assert.equal(session.resource.data.currentQuestion.id, next.references.questionId)
  assert.equal(session.resource.data.currentQuestion.prompt, '什么是 undo log？')
  assert.equal('stage' in session.resource.data, false)
})

test('业务工具描述不再要求状态机恢复和 nextAction 工具链', () => {
  const fixture = toolsFixture()
  const descriptions = Object.values(fixture.tools).map((tool) => tool.description).join('\n')
  assert.doesNotMatch(descriptions, /interview_continue_practice/)
  assert.doesNotMatch(descriptions, /nextAction/)
  assert.match(descriptions, /业务工具不展示 UI/)
  assert.match(fixture.tools.interview_question.description, /组合 delete 和 create/)
  assert.match(fixture.tools.interview_question.description, /固定 Hot 100/)
  assert.ok(fixture.tools.interview_question.parameters.properties.operation.enum.includes('draw_hot100'))
  assert.doesNotMatch(fixture.tools.interview_question.description, /底层原理|项目真实性|解题思路/)
  assert.doesNotMatch(fixture.tools.interview_explanation.description, /当前模式是背八股|当前模式是模拟面试/)
  assert.match(fixture.tools.interview_explanation.description, /memorization_points/)
  assert.match(fixture.tools.interview_practice.description, /interview_show_practice_setup/)
  assert.match(fixture.tools.interview_practice.description, /不要通过文本收集配置/)
  assert.match(fixture.tools.interview_practice.description, /target_role/)
  assert.match(fixture.tools.interview_practice.description, /job_description_provided/)
})
