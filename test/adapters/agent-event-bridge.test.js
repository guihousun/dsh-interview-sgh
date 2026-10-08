import test from 'node:test'
import assert from 'node:assert/strict'
import { AgentEventBridge, instructionFor } from '../../src/adapters/dsh/agent-event-bridge.js'

test('AI 请求使用 DSH v4 接受的插件自有来源，不冒充直接用户消息', () => {
  const messages = []
  const bridge = new AgentEventBridge({ get: () => ({ get: () => ({ followup: (message) => messages.push(message) }) }) })
  assert.equal(bridge.dispatch('s1', { type: 'review.generate', practiceId: 'p1', questionId: 'q1', mode: 'leetcode' }), true)
  assert.equal(messages.length, 1)
  assert.equal(messages[0].role, 'user')
  assert.deepEqual(messages[0].source, { kind: 'plugin:dsh-interview' })
  assert.match(messages[0].content[0].text, /question_id=q1/)
})

test('AI 引导按考场四步生成材料，真实代码放最后，不提交或评分', () => {
  const messages = []
  const bridge = new AgentEventBridge({ get: () => ({ get: () => ({ followup: (message) => messages.push(message) }) }) })
  assert.equal(bridge.dispatch('s1', { type: 'guidance.generate', practiceId: 'p1', questionId: 'q1', mode: 'leetcode', guidance: 'guided', includeModeContext: true }), true)
  const prompt = messages[0].content[0].text
  assert.match(prompt, /practice_id=p1，question_id=q1/)
  assert.match(prompt, /interview_notes read/)
  assert.match(prompt, /guided 必须恰好写 4 步 hints/)
  for (const stage of ['拆解题目与基础知识', '理清思路', '写伪代码', '写真实代码']) assert.match(prompt, new RegExp(stage))
  assert.match(prompt, /状态不变量/)
  assert.match(prompt, /用户主动进入本步后才能显示/)
  assert.match(prompt, /基本注释/)
  assert.match(prompt, /不运行代码、不提交作答、不评分/)
  assert.match(prompt, /interview_materials replace/)
  assert.match(prompt, /不调用 interview_materials reveal、interview_explanation/)
})

test('引导和讲解请求传回请求 ID 并生成通用内容，已有答案的代码分析不重复生成讲解', () => {
  const base = { practiceId: 'p1', questionId: 'q1', mode: 'leetcode', requestId: 'r1' }
  const guidance = instructionFor({ ...base, type: 'guidance.generate' })
  assert.match(guidance, /request_id=r1/)
  assert.match(guidance, /传 reusable=true/)
  assert.match(guidance, /不引用个人历史作答/)
  const solution = instructionFor({ ...base, type: 'review.generate' })
  assert.match(solution, /request_id=r1/)
  assert.match(solution, /传 scope=reference/)
  const cached = instructionFor({ ...base, type: 'code.review', hasReferenceSolution: true, attemptId: 'a1', language: 'python' })
  assert.match(cached, /不要重复生成整题讲解/)
  assert.match(cached, /不调用 interview_explanation/)
  const missing = instructionFor({ ...base, type: 'code.review', hasReferenceSolution: false, attemptId: 'a1', language: 'python' })
  assert.match(missing, /scope=reference 进入题库缓存/)
})
