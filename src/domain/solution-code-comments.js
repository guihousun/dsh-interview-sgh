import { assertDomain } from './errors.js'

// 只检查解释中的参考实现，不处理、不改写用户作答。跳过字符串中的 #、//、/*。
export function solutionCommentNotes(code, language) {
  const notes = []
  let index = 0
  while (index < code.length) {
    const ch = code[index]
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = language === 'python' && code.slice(index, index + 3) === ch.repeat(3) ? ch.repeat(3) : ch
      index += quote.length
      while (index < code.length) {
        if (code[index] === '\\') { index += 2; continue }
        if (code.slice(index, index + quote.length) === quote) { index += quote.length; break }
        index += 1
      }
      continue
    }
    const line = language === 'python' ? ch === '#' : code.slice(index, index + 2) === '//'
    const block = language !== 'python' && code.slice(index, index + 2) === '/*'
    if (line || block) {
      const start = index + (language === 'python' ? 1 : 2)
      const end = code.indexOf(block ? '*/' : '\n', start)
      const note = code.slice(start, end < 0 ? code.length : end).trim()
      if (!/^(?:!|coding\s*[:=]|type:|noqa\b|pragma:)/i.test(note) && (note.match(/[\p{L}\p{N}]/gu) || []).length >= 4) notes.push(note)
      index = end < 0 ? code.length : end + (block ? 2 : 1)
    } else index += 1
  }
  return notes
}

export function assertSolutionCodeComments(detail, language) {
  const aliases = { cpp: ['cpp', 'c++'], java: ['java'], python: ['python'], c: ['c'], go: ['go', 'golang'] }
  const fences = /(?:^|\n)(`{3,}|~{3,})[ \t]*([^\s\r\n]*)[ \t]*\r?\n([\s\S]*?)\r?\n\1(?=\s|$)/g
  let blockIndex = 0
  for (const match of detail.matchAll(fences)) {
    if (!(aliases[language] || []).includes(match[2].toLowerCase())) continue
    blockIndex += 1
    const lines = match[3].split('\n').filter((line) => line.trim()).length
    const minimum = lines > 30 ? 3 : lines > 12 ? 2 : 1
    assertDomain(solutionCommentNotes(match[3], language).length >= minimum,
      'LEETCODE_SOLUTION_COMMENTS_REQUIRED', '答案代码需要基本注释：解释关键变量、判断依据、状态更新和易错边界，较长代码至少分段说明',
      { language, blockIndex, minimumComments: minimum })
  }
  assertDomain(blockIndex > 0, 'LEETCODE_SOLUTION_COMMENTS_REQUIRED', '请使用带基本注释的完整答案代码块', { language })
}
