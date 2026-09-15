const DEFINITIONS = [
  {
    id: 'guided',
    label: '引导模式',
    detail: '先补前置知识，按提示阶梯逐步推导，不主动给答案',
    hintTotal: 4,
  },
  {
    id: 'standard',
    label: '标准模式',
    detail: '直接动手做题，需要时自己点提示或看答案',
    hintTotal: 3,
  },
]

export const LEETCODE_GUIDANCE_LEVELS = Object.freeze(DEFINITIONS.map((item) => Object.freeze(item)))
export const LEETCODE_GUIDANCE_IDS = Object.freeze(LEETCODE_GUIDANCE_LEVELS.map((item) => item.id))
export const DEFAULT_LEETCODE_GUIDANCE = 'standard'

export function leetcodeGuidanceDefinition(id) {
  return LEETCODE_GUIDANCE_LEVELS.find((item) => item.id === id) || null
}

export function leetcodeGuidanceLabel(id) {
  return leetcodeGuidanceDefinition(id)?.label || leetcodeGuidanceDefinition(DEFAULT_LEETCODE_GUIDANCE).label
}

export function isLeetcodeGuidance(id) {
  return leetcodeGuidanceDefinition(id) !== null
}

export function leetcodeHintBudget(id) {
  return leetcodeGuidanceDefinition(id)?.hintTotal || leetcodeGuidanceDefinition(DEFAULT_LEETCODE_GUIDANCE).hintTotal
}

export function isGuidedLeetcode(id) {
  return id === 'guided'
}

// 历史练习只保存了 language，读取时按标准模式处理，新建和修改仍然要求显式选择。
export function effectiveLeetcodeGuidance(config) {
  const value = config?.guidance
  return isLeetcodeGuidance(value) ? value : DEFAULT_LEETCODE_GUIDANCE
}
