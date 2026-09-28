// 纯文本编辑行为：这里只处理光标与缩进，不解析或执行用户代码。
export function editCodeSelection(code, start, end, key, { shift = false, language = 'python' } = {}) {
  if (key === 'Enter') {
    const prefix = code.slice(code.lastIndexOf('\n', start - 1) + 1, start)
    const indentation = prefix.match(/^[ \t]*/)?.[0] || ''
    const extra = /[{[(]\s*$/.test(prefix) || (language === 'python' && /:\s*$/.test(prefix)) ? '    ' : ''
    const insert = `\n${indentation}${extra}`
    return { code: code.slice(0, start) + insert + code.slice(end), start: start + insert.length, end: start + insert.length }
  }
  if (key !== 'Tab') return null
  if (!shift && start === end) {
    return { code: code.slice(0, start) + '    ' + code.slice(end), start: start + 4, end: start + 4 }
  }
  const lineStart = code.lastIndexOf('\n', start - 1) + 1
  const lastSelected = end > start && code[end - 1] === '\n' ? end - 1 : end
  const nextBreak = code.indexOf('\n', lastSelected)
  const lineEnd = nextBreak === -1 ? code.length : nextBreak
  const lines = code.slice(lineStart, lineEnd).split('\n')
  const removed = lines.map((line) => shift ? (/^\t/.test(line) ? 1 : line.match(/^ {0,4}/)[0].length) : 0)
  const changed = lines.map((line, index) => shift ? line.slice(removed[index]) : '    ' + line).join('\n')
  const delta = changed.length - (lineEnd - lineStart)
  const firstDelta = shift ? -Math.min(removed[0], start - lineStart) : 4
  return {
    code: code.slice(0, lineStart) + changed + code.slice(lineEnd),
    start: start + firstDelta,
    end: start === end ? start + firstDelta : end + delta,
  }
}

export function codeDraftKey(sessionId, practiceId, questionId) {
  return `dsh-interview:code-draft:v1:${JSON.stringify([sessionId, practiceId, questionId])}`
}

export function readCodeDraft(storage, key) {
  try {
    const value = JSON.parse(storage?.getItem(key) || 'null')
    return value && typeof value.code === 'string' && typeof value.language === 'string'
      ? { code: value.code, language: value.language, notes: typeof value.notes === 'string' ? value.notes : '' }
      : null
  } catch { return null }
}

export function saveCodeDraft(storage, key, draft) {
  try {
    if (!storage) return false
    storage.setItem(key, JSON.stringify(draft))
    return true
  } catch { return false }
}
