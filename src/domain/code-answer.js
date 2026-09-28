import { assertDomain } from './errors.js'
import { LEETCODE_LANGUAGES } from './leetcode-languages.js'

export const CODE_LANGUAGES = Object.freeze([
  ...LEETCODE_LANGUAGES.map(({ id, label, fence }) => ({ id, label, fence })),
  { id: 'javascript', label: 'JavaScript', fence: 'javascript' },
  { id: 'typescript', label: 'TypeScript', fence: 'typescript' },
  { id: 'rust', label: 'Rust', fence: 'rust' },
  { id: 'csharp', label: 'C#', fence: 'csharp' },
  { id: 'sql', label: 'SQL', fence: 'sql' },
].map(Object.freeze))

export function formatCodeAnswer({ code, language, notes = '' }) {
  const definition = CODE_LANGUAGES.find((item) => item.id === language)
  assertDomain(definition, 'INVALID_CODE_LANGUAGE', '请选择支持的编程语言')
  assertDomain(typeof code === 'string' && code.trim(), 'EMPTY_CODE_ANSWER', '请先写下你的代码')
  assertDomain(code.length <= 200000, 'CODE_ANSWER_TOO_LARGE', '代码过长，请控制在 20 万字符以内')
  assertDomain(typeof notes === 'string' && notes.length <= 20000, 'INVALID_CODE_NOTES', '思路说明请控制在 2 万字符以内')
  const normalized = code.replace(/\r\n?/g, '\n')
  const longestFence = (normalized.match(/`+/g) || []).reduce((longest, value) => Math.max(longest, value.length), 2)
  const fence = '`'.repeat(longestFence + 1)
  return `代码作答（${definition.label}）\n\n${fence}${definition.fence}\n${normalized}\n${fence}${notes.trim() ? `\n\n思路说明：\n${notes.trim()}` : ''}`
}

export function parseCodeAnswer(answer) {
  if (typeof answer !== 'string') return null
  const match = /^代码作答（([^）]+)）\n\n(`{3,})([a-z]+)\n([\s\S]*?)\n\2(?:\n\n思路说明：\n([\s\S]*))?$/.exec(answer)
  if (!match) return null
  const language = CODE_LANGUAGES.find((item) => item.fence === match[3] && item.label === match[1])
  return language ? { language: language.id, code: match[4], notes: match[5] || '' } : null
}
