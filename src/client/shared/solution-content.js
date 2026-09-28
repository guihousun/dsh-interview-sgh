import { CODE_LANGUAGES } from '../../domain/code-answer.js'

const ANSWER_LANGUAGES = new Set([
  ...CODE_LANGUAGES.map((item) => item.fence),
  'py', 'python3', 'c++', 'cxx', 'golang', 'js', 'ts', 'jsx', 'tsx', 'cs', 'c#',
  'kotlin', 'swift', 'php', 'ruby', 'scala', 'bash', 'shell', 'pseudocode',
])

// 只拆分展示内容，不改写已保存题解。示例数据和图解保留在解析中。
export function splitSolutionContent(detail) {
  const text = String(detail || '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  const answers = [], analysis = []
  let start = 0
  for (let index = 0; index < lines.length; index += 1) {
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[index])
    if (!opening || (opening[1][0] === '`' && opening[2].includes('`'))) continue
    const fence = opening[1]
    const closing = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`)
    let end = index + 1
    while (end < lines.length && !closing.test(lines[end])) end += 1
    const language = opening[2].trim().split(/\s+/)[0].toLowerCase()
    if (!language || ANSWER_LANGUAGES.has(language)) {
      analysis.push(lines.slice(start, index).join('\n'))
      answers.push(lines.slice(index, Math.min(end + 1, lines.length)).join('\n'))
      start = end + 1
    }
    // 块内的短围栏属于代码，不能被当成另一个 Markdown 块。
    index = end
  }
  if (!answers.length) return { answer: text.trim(), analysis: '' }
  analysis.push(lines.slice(start).join('\n'))
  return { answer: answers.join('\n\n'), analysis: analysis.filter((part) => part.trim())
    .map((part) => part.replace(/^\n+|\n+$/g, '')).join('\n\n').trim() }
}
