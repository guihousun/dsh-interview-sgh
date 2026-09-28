import test from 'node:test'
import assert from 'node:assert/strict'
import { AgentEventBridge } from '../../src/adapters/dsh/agent-event-bridge.js'

test('AI 请求使用 DSH v4 接受的插件自有来源，不冒充直接用户消息', () => {
  const messages = []
  const bridge = new AgentEventBridge({ get: () => ({ get: () => ({ followup: (message) => messages.push(message) }) }) })
  assert.equal(bridge.dispatch('s1', { type: 'review.generate', practiceId: 'p1', questionId: 'q1', mode: 'leetcode' }), true)
  assert.equal(messages.length, 1)
  assert.equal(messages[0].role, 'user')
  assert.deepEqual(messages[0].source, { kind: 'plugin:dsh-interview' })
  assert.match(messages[0].content[0].text, /question_id=q1/)
})
