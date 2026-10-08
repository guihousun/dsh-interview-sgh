import { assertDomain } from './errors.js'
import { LEETCODE_LANGUAGES } from './leetcode-languages.js'
import { assertSolutionCodeComments } from './solution-code-comments.js'

export const GUIDED_LEARNING_VERSION = 2
export const GUIDED_LEARNING_STAGES = Object.freeze([
  { id: 'understand', label: '拆解题目与基础知识' },
  { id: 'reason', label: '理清思路' },
  { id: 'pseudocode', label: '写伪代码' },
  { id: 'implementation', label: '写真实代码' },
].map(Object.freeze))

// 旧提示阶梯缺少伪代码和实现，不能仅改名称后作为新流程复用。
export function assertGuidedLearningMaterials(materials, language = 'python') {
  const hints = materials?.hints || []
  assertDomain(hints.length === 4, 'INVALID_AI_GUIDANCE', '引导模式需要四步：拆解题目、理清思路、写伪代码、写真实代码')
  assertDomain(/```(?:text|pseudocode|pseudo)\s*\r?\n\S[\s\S]*?```/i.test(hints[2]),
    'INVALID_AI_GUIDANCE', '第 3 步需要完整伪代码，使用 text 或 pseudocode 代码块')
  assertDomain(!hints.slice(0, 3).some(hint => LEETCODE_LANGUAGES.some(item => item.pattern.test(hint))),
    'INVALID_AI_GUIDANCE', '真实代码只能放在第 4 步，不要提前展示实现')
  assertDomain(!LEETCODE_LANGUAGES.some(item => item.id !== language && item.pattern.test(hints[3])),
    'INVALID_AI_GUIDANCE', '第 4 步只能使用当前练习语言')
  assertSolutionCodeComments(hints[3], language)
}

export function hasGuidedLearningMaterials(materials, language) {
  try { assertGuidedLearningMaterials(materials, language); return true } catch { return false }
}
