import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCodeAnswer, parseCodeAnswer } from '../../src/domain/code-answer.js'

test('代码作答保留缩进和代码内的 Markdown 围栏，回读时不会混入说明', () => {
  const code = 'def solve():\n    text = "```python"\n    return text\n'
  const answer = formatCodeAnswer({ code, language: 'python', notes: '我想检查边界条件。\n```text\n说明\n```' })
  assert.deepEqual(parseCodeAnswer(answer), { code, language: 'python', notes: '我想检查边界条件。\n```text\n说明\n```' })
  assert.match(answer, /````python/)
  assert.equal(parseCodeAnswer('我在对话中回答了这个问题。'), null)
})

test('代码输入验证拒绝空白、过长和伪造语言，并统一 Windows 换行', () => {
  assert.throws(() => formatCodeAnswer({ code: '  \n ', language: 'python' }), { code: 'EMPTY_CODE_ANSWER' })
  assert.throws(() => formatCodeAnswer({ code: 'x', language: 'python\nmalicious' }), { code: 'INVALID_CODE_LANGUAGE' })
  assert.throws(() => formatCodeAnswer({ code: 'x'.repeat(200001), language: 'python' }), { code: 'CODE_ANSWER_TOO_LARGE' })
  assert.equal(parseCodeAnswer(formatCodeAnswer({ code: 'a\r\n    b', language: 'python' })).code, 'a\n    b')
})
