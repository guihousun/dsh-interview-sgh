import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'

test('展开含代码的答案为新版 Markdown 提供稳定的代码工具栏标签', () => {
  const source = readFileSync(new URL('../../src/client/shared/ui.js', import.meta.url), 'utf8')
  const module = { exports: {} }
  const renderer = (props) => {
    assert.equal(typeof props.labels.code.copyLabel, 'string')
    assert.equal(typeof props.labels.code.copiedLabel, 'string')
    assert.equal(typeof props.labels.footnotes, 'string')
    return props
  }
  const react = { createElement: (type, props) => typeof type === 'function' ? type(props) : { type, props } }
  vm.runInNewContext(transformSync(source, { format: 'cjs' }).code, {
    module, exports: module.exports,
    require: (name) => name === 'react' ? react : name.includes('primitives') ? { MarkdownText: renderer } : {},
  })
  const code = '```python\nreturn 1\n```'
  const first = module.exports.Markdown({ children: code })
  const second = module.exports.Markdown({ children: '下一段讲解' })
  assert.equal(first.text, code)
  assert.equal(first.labels, second.labels)
})
