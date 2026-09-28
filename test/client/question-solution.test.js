import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'

test('没有已保存讲解也显示答案入口，折叠时不读取参考答案', async () => {
  const source = readFileSync(new URL('../../src/client/features/question-solution.js', import.meta.url), 'utf8')
  const compiled = transformSync(source, { format: 'cjs' }).code
  const states = []
  let cursor = 0
  let loader
  let reads = 0
  const module = { exports: {} }
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = initial
      return [states[index], (update) => { states[index] = typeof update === 'function' ? update(states[index]) : update }]
    },
    useEffect() {}, useRef: (current) => ({ current }),
  }
  const modules = {
    react,
    '../shared/api.js': { interviewApi: { async questionSolution() { reads += 1; return { resource: { data: { available: true, detail: '答案' } } } } } },
    '../shared/hooks.js': { useCommand: () => ({}), useInterviewQuery(_key, load) { loader = load; return { data: null, loading: true, reload() {} } } },
    '../shared/solution-disclosure.js': { SolutionDisclosure: 'answer-disclosure' },
    '../shared/ui.js': { h: (type, props, ...children) => ({ type, props, children }), Loading: 'loading', ErrorNotice: 'error' },
  }
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (name) => modules[name] })
  const render = () => {
    cursor = 0
    return module.exports.QuestionSolutionPanel({ sessionId: 's1', practiceId: 'p1', question: { id: 'q1', explanation: null } })
  }
  let panel = render()
  assert.equal(panel.type, 'answer-disclosure')
  assert.equal(await loader(), null)
  assert.equal(reads, 0)
  panel.props.onToggle(true)
  panel = render()
  assert.equal((await loader()).resource.data.available, true)
  assert.equal(reads, 1)
  panel.props.onToggle(false)
  render()
  assert.equal(await loader(), null)
  assert.equal(reads, 1)
})

test('缓存讲解展开收起只读取数据，只有显式重新生成按钮会强制请求 AI', async () => {
  const source = readFileSync(new URL('../../src/client/features/question-solution.js', import.meta.url), 'utf8')
  const compiled = transformSync(source, { format: 'cjs' }).code
  const module = { exports: {} }, states = [], calls = []
  let cursor = 0, loader, reads = 0
  const solution = { available: true, allowed: true, source: '题库缓存 · AI 讲解（直接复用）', detail: '已保存详解',
    reused: true, status: 'ready', canGenerate: true }
  const modules = {
    react: { Fragment: 'fragment', useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial;
      return [states[i], (value) => { states[i] = typeof value === 'function' ? value(states[i]) : value }] }, useEffect() {}, useRef: (current) => ({ current }) },
    '../shared/api.js': { interviewApi: { async questionSolution() { reads++; return { resource: { data: solution } } } } },
    '../shared/hooks.js': { useCommand: () => ({ run: async (command, payload) => { calls.push({ command, payload }); return { cacheHit: true } } }),
      useInterviewQuery(_key, load) { loader = load; return { data: { resource: { data: solution } }, reload: async () => {} } } },
    '../shared/solution-disclosure.js': { SolutionDisclosure: 'answer-disclosure' },
    '../shared/ui.js': { h: (type, props, ...children) => ({ type, props: props || {}, children }), Button: 'button', Markdown: 'markdown', ErrorNotice: 'error' },
  }
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (name) => modules[name] })
  const render = () => { cursor = 0; return module.exports.QuestionSolutionPanel({ sessionId: 's1', practiceId: 'p1', question: { id: 'q1' } }) }
  const nodes = (tree) => tree && typeof tree === 'object' ? [tree, ...tree.children.flat(Infinity).flatMap(nodes)] : []
  let panel = render()
  panel.props.onToggle(true); panel = render(); await loader()
  panel.props.onToggle(false); panel = render(); await loader()
  panel.props.onToggle(true); panel = render(); await loader()
  assert.equal(reads, 2)
  assert.equal(calls.length, 0)
  assert.equal(nodes(panel).some((node) => node.children.includes('这份讲解直接从题库读取，未请求 AI。')), true)
  await nodes(panel).find((node) => node.type === 'button' && node.children.includes('重新生成 AI 讲解')).props.onClick()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].payload.force, true)
  panel = render()
  assert.equal(nodes(panel).some((node) => node.children.includes('直接读取已保存答案，本次未请求 AI。')), true)
})
