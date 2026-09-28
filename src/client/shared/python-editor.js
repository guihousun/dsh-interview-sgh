import React from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { createPythonEditorState, pythonEditorTheme, syncPythonEditorValue } from './python-editor-config.js'
import { h } from './ui.js'

export function PythonEditor({ value, onChange, onSubmit, readOnly = false }) {
  const parentRef = React.useRef(null)
  const viewRef = React.useRef(null)
  const callbacks = React.useRef({ onChange, onSubmit })
  callbacks.current = { onChange, onSubmit }
  const readOnlyConfig = React.useRef(new Compartment())
  const themeConfig = React.useRef(new Compartment())
  const [cursor, setCursor] = React.useState({ line: 1, column: 1 })

  React.useEffect(() => {
    if (!parentRef.current) return undefined
    const view = new EditorView({ parent: parentRef.current, state: createPythonEditorState({
      value, readOnly, dark: document.body.hasAttribute('data-ds-dark-theme'),
      readOnlyConfig: readOnlyConfig.current, themeConfig: themeConfig.current,
      onChange: (code) => callbacks.current.onChange?.(code), onSubmit: (analyze) => callbacks.current.onSubmit?.(analyze), onCursor: setCursor,
    }) })
    viewRef.current = view
    const observer = new MutationObserver(() => view.dispatch({ effects: themeConfig.current.reconfigure(
      pythonEditorTheme(document.body.hasAttribute('data-ds-dark-theme'))) }))
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    // 保持实例与撤销历史，保存草稿引起的 React 更新不会重建编辑器。
    return () => { observer.disconnect(); viewRef.current = null; view.destroy() }
  }, [])

  React.useEffect(() => {
    if (viewRef.current) syncPythonEditorValue(viewRef.current, value)
  }, [value])
  React.useEffect(() => {
    viewRef.current?.dispatch({ effects: readOnlyConfig.current.reconfigure([
      EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly),
    ]) })
  }, [readOnly])

  return h('div', { className: 'di-python-editor', 'aria-label': 'Python 编辑器' },
    h('div', { className: 'di-python-editor-surface', ref: parentRef }),
    h('div', { className: 'di-python-editor-status' },
      h('span', null, 'Python · 4 个空格'), h('span', null, `行 ${cursor.line}，列 ${cursor.column}${readOnly ? ' · 只读' : ''}`)))
}
