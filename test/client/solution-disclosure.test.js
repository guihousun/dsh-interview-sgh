import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'

test('正确答案默认不渲染，用户可以反复展开与收起', () => {
  const source = readFileSync(new URL('../../src/client/shared/solution-disclosure.js', import.meta.url), 'utf8')
  const compiled = transformSync(source, { format: 'cjs' }).code
  let open = false
  const module = { exports: {} }
  const react = { useState: () => [open, (update) => { open = typeof update === 'function' ? update(open) : update }] }
  const h = (type, props, ...children) => ({ type, props: props || {}, children })
  vm.runInNewContext(compiled, {
    exports: module.exports, module, require: (name) => name === 'react' ? react : { h, Button: 'button', Icon: 'icon' },
  })
  const toggles = []
  const render = () => module.exports.SolutionDisclosure({ children: '完整正确答案', onToggle: (value) => toggles.push(value) })
  const button = (tree) => tree.children[0].children[1]
  let tree = render()
  assert.equal(tree.children[1], null)
  assert.equal(button(tree).props['aria-expanded'], false)
  button(tree).props.onClick()
  tree = render()
  assert.equal(tree.children[1].children[0], '完整正确答案')
  assert.equal(button(tree).props['aria-expanded'], true)
  button(tree).props.onClick()
  tree = render()
  assert.equal(tree.children[1], null)
  assert.equal(button(tree).props['aria-expanded'], false)
  assert.deepEqual(toggles, [true, false])
})
