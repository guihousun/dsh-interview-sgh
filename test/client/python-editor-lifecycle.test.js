import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
import * as stateModule from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import * as configuration from '../../src/client/shared/python-editor-config.js'

function fixture() {
  const states = [], refs = [], effects = [], views = [], observers = [], module = { exports: {} }
  let stateCursor = 0, refCursor = 0, effectCursor = 0, dark = false
  const react = {
    useState(initial) { const i = stateCursor++; if (!(i in states)) states[i] = initial;
      return [states[i], (next) => { states[i] = typeof next === 'function' ? next(states[i]) : next }] },
    useRef(initial) { return refs[refCursor++] ||= { current: initial } },
    useEffect(run, deps) { const i = effectCursor++, previous = effects[i];
      if (!previous || deps.some((value, j) => value !== previous.deps[j])) effects[i] = { run, deps, previous, pending: true } },
  }
  class View {
    static editable = EditorView.editable
    constructor({ state }) { this.state = state; this.destroyed = false; views.push(this) }
    dispatch(spec) {
      const transaction = this.state.update(spec)
      this.state = transaction.state
      for (const update of this.state.facet(EditorView.updateListener)) update({ state: this.state,
        transactions: [transaction], docChanged: transaction.docChanged, selectionSet: Boolean(transaction.selection), view: this })
    }
    destroy() { this.destroyed = true }
  }
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this) }
    observe() { this.active = true }
    disconnect() { this.active = false }
  }
  const modules = { react, '@codemirror/state': stateModule, '@codemirror/view': { EditorView: View },
    './python-editor-config.js': configuration, './ui.js': { h: (type, props, ...children) => ({ type, props: props || {}, children }) } }
  const source = readFileSync(new URL('../../src/client/shared/python-editor.js', import.meta.url), 'utf8')
  vm.runInNewContext(transformSync(source, { format: 'cjs' }).code, { module, exports: module.exports,
    require: (name) => modules[name], MutationObserver: Observer, document: { body: { hasAttribute: () => dark } } })
  return { views, observers,
    render(props) { stateCursor = refCursor = effectCursor = 0;
      const tree = module.exports.PythonEditor(props)
      tree.children[0].props.ref.current = {}
      for (const effect of effects) if (effect.pending) {
        effect.previous?.cleanup?.(); effect.cleanup = effect.run(); effect.pending = false
      }
      return tree
    },
    theme(value) { dark = value; for (const observer of observers) if (observer.active) observer.callback() },
    unmount() { for (const effect of effects) effect.cleanup?.() },
  }
}

test('React 草稿更新保留编辑器实例、光标与最新回调，关闭编辑器清理实例和主题监听', () => {
  const f = fixture(), originalChanges = [], latestChanges = []
  const original = { value: 'x = 1', onChange: (code) => originalChanges.push(code) }
  f.render(original)
  const view = f.views[0]
  view.dispatch({ changes: { from: 4, to: 5, insert: '2' }, selection: { anchor: 5 }, userEvent: 'input.type' })
  f.render({ value: 'x = 2', onChange: (code) => latestChanges.push(code) })
  assert.equal(f.views.length, 1)
  assert.equal(view.state.selection.main.head, 5)
  view.dispatch({ changes: { from: 4, to: 5, insert: '3' }, userEvent: 'input.type' })
  assert.deepEqual(originalChanges, ['x = 2'])
  assert.deepEqual(latestChanges, ['x = 3'])
  f.render({ value: 'x = 3', readOnly: true, onChange: (code) => latestChanges.push(code) })
  assert.equal(view.state.readOnly, true)
  assert.equal(view.state.selection.main.head, 5)
  f.theme(true)
  assert.equal(view.state.facet(EditorView.darkTheme), true)
  assert.equal(view.state.doc.toString(), 'x = 3')
  f.unmount()
  assert.equal(view.destroyed, true)
  assert.equal(f.observers[0].active, false)
})
