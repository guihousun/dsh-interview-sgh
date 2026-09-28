import test from 'node:test'
import assert from 'node:assert/strict'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { insertNewlineAndIndent, undo, redo } from '@codemirror/commands'
import { syntaxTree, indentUnit, foldable, matchBrackets } from '@codemirror/language'
import { CompletionContext } from '@codemirror/autocomplete'
import { globalCompletion, localCompletionSource } from '@codemirror/lang-python'
import { highlightTree } from '@lezer/highlight'
import { createPythonEditorState, pythonHighlightStyle, pythonSubmitKeymap, syncPythonEditorValue } from '../../src/client/shared/python-editor-config.js'

function editor(value = '', options = {}) {
  const view = { state: createPythonEditorState({ value, ...options }), dispatch(spec) {
    const transaction = spec.state ? spec : this.state.update(spec)
    this.state = transaction.state
    for (const notify of this.state.facet(EditorView.updateListener)) notify({ state: this.state,
      transactions: [transaction], docChanged: transaction.docChanged, selectionSet: Boolean(transaction.selection), view: this })
  } }
  view.dispatch = view.dispatch.bind(view)
  return view
}

test('Python 语法树为关键字、函数、类、数字、字符串和中文注释提供独立高亮', () => {
  const code = 'class Solution:\n    def solve(self, nums):\n        # 保存之前计算的结果\n        result = "你好"\n        return 42'
  const state = createPythonEditorState({ value: code })
  const spans = []
  highlightTree(syntaxTree(state), pythonHighlightStyle, (from, to, style) => spans.push({ text: code.slice(from, to), style }))
  for (const [text, style] of [['class', 'di-py-keyword'], ['Solution', 'di-py-type'], ['solve', 'di-py-function'],
    ['return', 'di-py-control'], ['42', 'di-py-number'], ['"你好"', 'di-py-string'], ['# 保存之前计算的结果', 'di-py-comment']]) {
    assert.ok(spans.some((span) => span.text === text && span.style.includes(style)), `${text} 应有 ${style} 高亮`)
  }
  assert.equal(state.doc.toString(), code)
})

test('Python 代码块回车自动使用四空格，Tab 插入空格并支持选中多行缩进与取消缩进', () => {
  const view = editor('def solve():')
  view.dispatch({ selection: { anchor: view.state.doc.length } })
  assert.equal(insertNewlineAndIndent(view), true)
  assert.equal(view.state.doc.toString(), 'def solve():\n    ')
  assert.equal(view.state.facet(indentUnit), '    ')
  const tab = view.state.facet(keymap).flat().find((binding) => binding.key === 'Tab')
  tab.run(view)
  assert.equal(view.state.doc.toString(), 'def solve():\n        ')
  const selected = editor('one\ntwo')
  selected.dispatch({ selection: { anchor: 0, head: 7 } })
  tab.run(selected)
  assert.equal(selected.state.doc.toString(), '    one\n    two')
  tab.shift(selected)
  assert.equal(selected.state.doc.toString(), 'one\ntwo')
})

test('括号补全与匹配使用 Python 语言规则，函数体可折叠，基础补全识别本地名称和内置函数', () => {
  const code = 'def solve(nums):\n    result = len(nums)\n    return result'
  const view = editor(code)
  assert.deepEqual(view.state.languageDataAt('closeBrackets', 0)[0].brackets, ['(', '[', '{', "'", '"', "'''", '"""'])
  const open = code.indexOf('(')
  const pair = matchBrackets(view.state, open, 1)
  assert.equal(pair.matched, true)
  assert.equal(code.slice(pair.end.from, pair.end.to), ')')
  assert.ok(foldable(view.state, 0, code.indexOf('\n')))
  const context = new CompletionContext(view.state, code.length, true)
  assert.ok(localCompletionSource(context).options.some((item) => item.label === 'result'))
  assert.ok(globalCompletion(context).options.some((item) => item.label === 'len'))
})

test('提交与分析快捷键调用不同入口，只读和输入法组字时不会误提交', () => {
  const calls = []
  const bindings = pythonSubmitKeymap((analyze) => calls.push(analyze))
  assert.deepEqual(bindings.map((binding) => binding.key), ['Mod-Enter', 'Mod-Shift-Enter'])
  const view = editor('return 1')
  bindings[0].run(view); bindings[1].run(view)
  bindings[0].run(editor('return 1', { readOnly: true }))
  view.composing = true; bindings[1].run(view)
  assert.deepEqual(calls, [false, true])
})

test('草稿受控更新不反复改写内容或触发保存回环，正常编辑保留撤销与重做', () => {
  const changes = []
  const view = editor('value = 1', { onChange: (value) => changes.push(value) })
  view.dispatch({ changes: { from: 8, to: 9, insert: '2' }, userEvent: 'input.type' })
  assert.equal(view.state.doc.toString(), 'value = 2')
  const before = view.state
  syncPythonEditorValue(view, 'value = 2')
  assert.equal(view.state, before)
  assert.deepEqual(changes, ['value = 2'])
  assert.equal(undo(view), true)
  assert.equal(view.state.doc.toString(), 'value = 1')
  assert.equal(redo(view), true)
  assert.equal(view.state.doc.toString(), 'value = 2')
  syncPythonEditorValue(view, 'new = 3\r\n# 外部恢复')
  assert.equal(view.state.doc.toString(), 'new = 3\n# 外部恢复')
  assert.equal(changes.length, 3)
})

test('提交时可原地切换只读状态，编辑器文本和光标不丢失', () => {
  const readOnlyConfig = new Compartment()
  const view = editor('original = 1', { readOnlyConfig })
  view.dispatch({ selection: { anchor: 4 } })
  view.dispatch({ effects: readOnlyConfig.reconfigure([EditorState.readOnly.of(true), EditorView.editable.of(false)]) })
  assert.equal(view.state.readOnly, true)
  assert.equal(view.state.facet(EditorView.editable), false)
  assert.equal(view.state.selection.main.head, 4)
  assert.equal(view.state.doc.toString(), 'original = 1')
  view.dispatch({ effects: readOnlyConfig.reconfigure([EditorState.readOnly.of(false), EditorView.editable.of(true)]) })
  assert.equal(view.state.readOnly, false)
  assert.equal(view.state.selection.main.head, 4)
})
