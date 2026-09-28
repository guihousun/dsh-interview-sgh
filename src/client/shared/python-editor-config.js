import { Annotation, EditorState, Prec, Transaction } from '@codemirror/state'
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from '@codemirror/commands'
import { acceptCompletion, autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { bracketMatching, foldGutter, foldKeymap, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { python } from '@codemirror/lang-python'
import { tags } from '@lezer/highlight'

export const externalPythonValue = Annotation.define()

export const pythonHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, class: 'di-py-keyword' },
  { tag: tags.controlKeyword, class: 'di-py-control' },
  { tag: [tags.variableName, tags.propertyName], class: 'di-py-variable' },
  { tag: tags.function(tags.variableName), class: 'di-py-function' },
  { tag: [tags.className, tags.typeName, tags.standard(tags.variableName)], class: 'di-py-type' },
  { tag: [tags.string, tags.special(tags.string)], class: 'di-py-string' },
  { tag: tags.comment, class: 'di-py-comment' },
  { tag: tags.number, class: 'di-py-number' },
  { tag: [tags.bool, tags.null], class: 'di-py-keyword' },
])

export function pythonEditorTheme(dark) {
  return EditorView.theme({
    '&': { height: '100%', color: 'var(--di-py-text)', backgroundColor: 'var(--di-py-bg)', colorScheme: dark ? 'dark' : 'light' },
    '&.cm-focused': { outline: 'none', boxShadow: 'inset 0 0 0 2px var(--di-focus)' },
    '.cm-scroller': { overflow: 'auto', scrollbarColor: 'var(--di-line-4) var(--di-py-bg)', scrollbarWidth: 'thin',
      fontFamily: 'Consolas,"Cascadia Code","SFMono-Regular",monospace', fontSize: '14px', lineHeight: '24px' },
    '.cm-content': { padding: '12px 0', caretColor: 'var(--di-py-text)' },
    '.cm-line': { padding: '0 16px 0 12px' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--di-py-text)' },
    '.cm-gutters': { backgroundColor: 'var(--di-py-bg)', color: 'var(--di-py-gutter)', border: 'none', minWidth: '50px' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 12px' },
    '.cm-foldGutter .cm-gutterElement': { padding: '0 4px', cursor: 'pointer' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--di-py-active)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'var(--di-py-selection)' },
    '.cm-matchingBracket': { color: 'inherit', backgroundColor: 'var(--di-py-bracket)', outline: '1px solid var(--di-line-4)' },
    '.cm-foldPlaceholder': { color: 'var(--di-muted)', backgroundColor: 'var(--di-surface-3)', border: '1px solid var(--di-line-3)' },
    '.cm-placeholder': { color: 'var(--di-faint)' },
    '.cm-tooltip': { color: 'var(--di-py-text)', backgroundColor: 'var(--di-py-bg)', border: '1px solid var(--di-line-4)' },
    '.cm-tooltip-autocomplete ul li[aria-selected]': { color: 'var(--di-py-text)', backgroundColor: 'var(--di-py-selection)' },
  }, { dark })
}

function indentPython(view) {
  if (view.state.readOnly) return false
  if (acceptCompletion(view)) return true
  if (view.state.selection.ranges.some((range) => !range.empty)) return indentMore(view)
  view.dispatch(view.state.update(view.state.replaceSelection('    '), { scrollIntoView: true, userEvent: 'input.indent' }))
  return true
}

export function pythonSubmitKeymap(onSubmit) {
  const run = (analyze) => (view) => {
    if (!view.state.readOnly && !view.composing) void onSubmit?.(analyze)
    return true
  }
  return [{ key: 'Mod-Enter', run: run(false) }, { key: 'Mod-Shift-Enter', run: run(true) }]
}

export function createPythonEditorState({ value = '', readOnly = false, dark = false, readOnlyConfig, themeConfig, onChange, onCursor, onSubmit } = {}) {
  const access = [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]
  const theme = pythonEditorTheme(dark)
  return EditorState.create({ doc: value, extensions: [
    python(), indentUnit.of('    '), EditorState.tabSize.of(4),
    lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), drawSelection(), history(),
    indentOnInput(), bracketMatching(), closeBrackets(), foldGutter(),
    autocompletion({ selectOnOpen: false }), syntaxHighlighting(pythonHighlightStyle),
    placeholder('在这里写下你的 Python 解法…'),
    readOnlyConfig ? readOnlyConfig.of(access) : access,
    themeConfig ? themeConfig.of(theme) : theme,
    EditorView.contentAttributes.of({ 'aria-label': '编写代码', 'aria-multiline': 'true', role: 'textbox', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
    Prec.highest(keymap.of(pythonSubmitKeymap(onSubmit))),
    keymap.of([{ key: 'Tab', run: indentPython, shift: indentLess }, ...completionKeymap, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...foldKeymap]),
    Prec.highest(EditorView.domEventHandlers({ keydown(event) { event.stopPropagation(); return false } })),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !update.transactions.some((transaction) => transaction.annotation(externalPythonValue))) onChange?.(update.state.doc.toString())
      if (update.docChanged || update.selectionSet) {
        const position = update.state.selection.main.head
        const line = update.state.doc.lineAt(position)
        onCursor?.({ line: line.number, column: position - line.from + 1 })
      }
    }),
  ] })
}

export function syncPythonEditorValue(view, value) {
  const normalized = String(value).replace(/\r\n?/g, '\n')
  if (view.state.doc.toString() === normalized) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: normalized },
    annotations: [externalPythonValue.of(true), Transaction.addToHistory.of(false)] })
}
