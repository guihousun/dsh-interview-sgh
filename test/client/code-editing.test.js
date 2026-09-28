import test from 'node:test'
import assert from 'node:assert/strict'
import { codeDraftKey, editCodeSelection, readCodeDraft, saveCodeDraft } from '../../src/client/shared/code-editing.js'

test('选中多行代码时缩进和取消缩进保持内容、选区及未选中的行', () => {
  const original = 'first\nsecond\nthird'
  const indented = editCodeSelection(original, 0, 13, 'Tab')
  assert.equal(indented.code, '    first\n    second\nthird')
  assert.equal(indented.end, 21)
  const restored = editCodeSelection(indented.code, 0, indented.end, 'Tab', { shift: true })
  assert.equal(restored.code, original)
  assert.equal(restored.end, 13)
  assert.equal(editCodeSelection('    x', 2, 2, 'Tab', { shift: true }).start, 0)
})

test('回车延续缩进并处理 Python 代码块，不会对其他语言冒号擅自增加缩进', () => {
  assert.deepEqual(editCodeSelection('    if ok:', 10, 10, 'Enter'), { code: '    if ok:\n        ', start: 19, end: 19 })
  assert.equal(editCodeSelection('case value:', 11, 11, 'Enter', { language: 'java' }).code, 'case value:\n')
  assert.equal(editCodeSelection('x', 1, 1, 'ArrowLeft'), null)
})

test('草稿按会话、练习与题目隔离，存储被拒绝时不抛异常或吞掉输入', () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) }
  const key = codeDraftKey('s1', 'p1', 'q1')
  const draft = { language: 'python', code: '    return 1', notes: '测试' }
  assert.equal(saveCodeDraft(storage, key, draft), true)
  assert.deepEqual(readCodeDraft(storage, key), draft)
  assert.equal(readCodeDraft(storage, codeDraftKey('s2', 'p1', 'q1')), null)
  assert.notEqual(codeDraftKey('s:p', 'q', 'r'), codeDraftKey('s', 'p:q', 'r'))
  const denied = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } }
  assert.equal(saveCodeDraft(denied, key, draft), false)
  assert.equal(readCodeDraft(denied, key), null)
})
