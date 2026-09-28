import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
import * as codeAnswers from '../../src/domain/code-answer.js'
import * as editing from '../../src/client/shared/code-editing.js'

const CODE = 'class Solution:\n    def solve(self, nums):\n        return nums'
const nodes = (tree) => tree && typeof tree === 'object' ? [tree, ...tree.children.flat(Infinity).flatMap(nodes)] : []
const button = (tree, label) => nodes(tree).find((node) => node.type === 'button' && node.children.includes(label))
const field = (tree, name = '编写代码') => nodes(tree).find((node) => node.props['aria-label'] === name)

function fixture({ attempts = [], storage = new Map(), run = null } = {}) {
  const module = { exports: {} }, states = [], refs = [], calls = []
  let cursor = 0, refCursor = 0, sequence = 0
  const question = { id: 'q1', attempts }
  const react = { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
    return [states[i], (value) => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
  useRef(current) { return refs[refCursor++] ||= { current } } }
  const dispatch = async (command, payload) => {
    calls.push({ command, payload })
    if (run) return run(command, payload)
    if (command === 'question.code-review.retry') return { analysisQueued: true }
    return { references: { attemptId: `a${++sequence}` }, revision: payload.sessionRevision + 1,
      analysisQueued: command === 'question.code-review', resource: { data: { answer: codeAnswers.formatCodeAnswer(payload) } } }
  }
  const modules = { react, '../../domain/code-answer.js': codeAnswers, '../shared/code-editing.js': editing,
    '../shared/hooks.js': { useCommand: () => ({ run: dispatch }) },
    '../shared/ui.js': { h: (type, props, ...children) => ({ type, props: props || {}, children }), Button: 'button', Icon: 'icon', ErrorNotice: 'error' } }
  const source = transformSync(readFileSync(new URL('../../src/client/features/code-answer.js', import.meta.url), 'utf8'), { format: 'cjs' }).code
  vm.runInNewContext(source, { module, exports: module.exports, require: (name) => modules[name],
    window: { localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) } },
    requestAnimationFrame: (callback) => callback() })
  return { calls, storage, render(extra = {}) { cursor = 0; refCursor = 0;
    return module.exports.CodeAnswerEditor({ sessionId: 's1', language: 'python', question,
      artifact: { practiceId: 'p1', questionId: 'q1', presentationId: 'card', sessionRevision: 3 }, ...extra }) } }
}

test('独立提交不请求 AI，保存后仍可编辑；分析复用提交，修改后用新凭证保存下一版本', async () => {
  const f = fixture()
  let tree = f.render()
  field(tree).props.onChange({ target: { value: CODE } }); tree = f.render()
  await button(tree, '提交代码').props.onClick(); tree = f.render()
  assert.deepEqual(f.calls.map((call) => call.command), ['question.code-submit'])
  assert.equal(field(tree).props.value, CODE)
  assert.equal(field(tree).props.readOnly, false)
  assert.equal(button(tree, '已提交').props.disabled, true)
  assert.equal(nodes(tree).some((node) => node.children.includes('代码已提交到练习档案，下次打开可查看。')), true)
  await button(tree, 'AI 分析代码').props.onClick(); tree = f.render()
  assert.equal(f.calls[1].command, 'question.code-review.retry')
  assert.equal(f.calls[1].payload.attemptId, 'a1')
  const changed = CODE + '\n# 新的思路'
  field(tree).props.onChange({ target: { value: changed } }); tree = f.render()
  await button(tree, '提交代码').props.onClick()
  assert.equal(f.calls[2].command, 'question.code-submit')
  assert.equal(f.calls[2].payload.sessionRevision, 4)
  assert.equal(f.calls[2].payload.code, changed)
})

test('关闭再打开恢复浏览器草稿，无草稿时恢复最近代码，后续文字回答不覆盖代码', () => {
  const f = fixture()
  field(f.render()).props.onChange({ target: { value: CODE } })
  const reopened = fixture({ storage: f.storage })
  assert.equal(field(reopened.render()).props.value, CODE)
  const saved = fixture({ attempts: [{ id: 'a1', answer: codeAnswers.formatCodeAnswer({ code: CODE, language: 'python', notes: '原始思路' }) },
    { id: 'a2', answer: '补充说明' }] })
  const tree = saved.render()
  assert.equal(field(tree).props.value, CODE)
  assert.equal(field(tree, '代码思路说明').props.value, '原始思路')
  assert.equal(button(tree, '已提交').props.disabled, true)
})

test('过期凭证不清空代码，显式重新连接后可用新凭证提交，不偷偷请求 AI', async () => {
  let failed = false
  const f = fixture({ run: async (command, payload) => {
    if (command === 'question.code-open') return { resource: { data: { practice: { id: 'p1' }, currentQuestionId: 'q1', revision: 9 } } }
    if (!failed) { failed = true; throw Object.assign(new Error('卡片已经完成'), { code: 'STALE_PRESENTATION' }) }
    return { references: { attemptId: 'a1' }, revision: 10, resource: { data: { answer: codeAnswers.formatCodeAnswer(payload) } } }
  } })
  let tree = f.render(); field(tree).props.onChange({ target: { value: CODE } }); tree = f.render()
  await button(tree, '提交代码').props.onClick(); tree = f.render()
  assert.equal(field(tree).props.value, CODE)
  assert.equal(button(tree, '提交代码').props.disabled, true)
  await button(tree, '重新连接编辑器').props.onClick(); tree = f.render()
  assert.equal(field(tree).props.value, CODE)
  await button(tree, '提交代码').props.onClick()
  assert.equal(f.calls[2].payload.sessionRevision, 9)
  assert.deepEqual(f.calls.map((call) => call.command), ['question.code-submit', 'question.code-open', 'question.code-submit'])
})

test('重复点击提交只发送一次，Ctrl+Enter 保存、Ctrl+Shift+Enter 分析，失败不丢草稿', async () => {
  let release
  const f = fixture({ run: () => new Promise((resolve) => { release = resolve }) })
  let tree = f.render(); field(tree).props.onChange({ target: { value: CODE } }); tree = f.render()
  const one = button(tree, '提交代码').props.onClick(), two = button(tree, '提交代码').props.onClick()
  assert.equal(f.calls.length, 1)
  release({ references: { attemptId: 'a1' }, revision: 4 })
  await Promise.all([one, two])
  const keys = fixture()
  let keyboard = keys.render(); field(keyboard).props.onChange({ target: { value: CODE } }); keyboard = keys.render()
  const event = { key: 'Enter', ctrlKey: true, shiftKey: false, stopPropagation() {}, preventDefault() {} }
  field(keyboard).props.onKeyDown(event)
  await new Promise(setImmediate)
  keyboard = keys.render()
  field(keyboard).props.onKeyDown({ ...event, shiftKey: true })
  await new Promise(setImmediate)
  assert.deepEqual(keys.calls.map((call) => call.command), ['question.code-submit', 'question.code-review.retry'])
})
