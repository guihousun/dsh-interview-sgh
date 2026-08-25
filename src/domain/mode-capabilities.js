import { assertDomain } from './errors.js'

const CAPABILITY_GROUPS = Object.freeze({
  practice: Object.freeze([
    'practice.create', 'practice.read', 'practice.list', 'practice.update',
    'practice.complete', 'practice.reopen', 'practice.delete', 'practice.export', 'practice.insights',
    'question.create', 'question.read', 'question.list', 'question.update', 'question.delete', 'question.focus',
    'attempt.create', 'attempt.list',
  ]),
  coaching: Object.freeze(['evaluation.create', 'explanation.create', 'explanation.replace', 'review.show', 'summary.show']),
  mockCoding: Object.freeze(['question.draw_hot100']),
  leetcode: Object.freeze(['leetcode.catalog', 'leetcode.draw', 'leetcode.draw_next', 'leetcode.set_completion']),
})

const MODE_CAPABILITIES = Object.freeze({
  bagu: new Set([...CAPABILITY_GROUPS.practice, ...CAPABILITY_GROUPS.coaching]),
  mock: new Set([...CAPABILITY_GROUPS.practice, ...CAPABILITY_GROUPS.mockCoding]),
  resume_drill: new Set([...CAPABILITY_GROUPS.practice, ...CAPABILITY_GROUPS.coaching]),
  scenario: new Set([...CAPABILITY_GROUPS.practice, ...CAPABILITY_GROUPS.coaching]),
  leetcode: new Set([
    'practice.read', 'practice.list', 'practice.complete', 'practice.reopen', 'practice.delete', 'practice.export',
    'question.read', 'question.list', 'question.focus', 'attempt.create', 'attempt.list',
    ...CAPABILITY_GROUPS.coaching,
    ...CAPABILITY_GROUPS.leetcode,
  ]),
})

export function modeCapabilities(mode) {
  const capabilities = MODE_CAPABILITIES[mode]
  assertDomain(capabilities, 'INVALID_MODE', `不支持的面试模式：${String(mode)}`)
  return capabilities
}

export function hasModeCapability(mode, capability) {
  return modeCapabilities(mode).has(capability)
}

export function assertModeCapability(practice, capability, code, message) {
  assertDomain(hasModeCapability(practice.mode, capability), code, message)
}

export { CAPABILITY_GROUPS, MODE_CAPABILITIES }
