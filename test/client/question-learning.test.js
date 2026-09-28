import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'

const initial = () => ({ problem: { statement: '真实题面', examples: [], constraints: [] }, guidance: {
  enabled: true, canGenerate: true, canAutoGenerate: true, source: 'none', ready: false, status: 'missing',
  introduction: '本题目标', knowledge: [], revealedHints: [], hintLevel: 0, hintTotal: 4, canReveal: false,
} })

function fixture(data = initial()) {
  const source = readFileSync(new URL('../../src/client/features/question-learning.js', import.meta.url), 'utf8')
  const compiled = transformSync(source, { format: 'cjs' }).code
  const module = { exports: {} }, states = [], effects = [], refs = [], calls = [], timers = new Map()
  let cursor = 0, effectCursor = 0, refCursor = 0, context = data, reloads = 0
  const readyEffects = []
  const react = {
    Fragment: 'fragment',
    useState(initialValue) {
      const index = cursor++
      if (!(index in states)) states[index] = initialValue
      return [states[index], (update) => { states[index] = typeof update === 'function' ? update(states[index]) : update }]
    },
    useRef(current) { const index = refCursor++; return refs[index] ||= { current } },
    useEffect(callback, dependencies) {
      const index = effectCursor++, old = effects[index]
      if (!old || dependencies.some((value, i) => value !== old.dependencies[i])) {
        old?.cleanup?.()
        effects[index] = { dependencies }
        readyEffects.push(() => { effects[index].cleanup = callback() })
      }
    },
  }
  const ui = { h: (type, props, ...children) => ({ type, props: props || {}, children }), Button: 'button', Loading: 'loading', ErrorNotice: 'error', Markdown: 'markdown' }
  const modules = {
    react, '../shared/ui.js': ui,
    '../shared/api.js': { interviewApi: {} },
    '../shared/hooks.js': {
      useCommand: () => ({ run: async (command, payload) => { calls.push({ command, payload }); return {} } }),
      useInterviewQuery: () => ({ data: { resource: { data: context } }, reload: async () => { reloads += 1 } }),
    },
  }
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (name) => modules[name],
    setTimeout: (callback) => { const id = timers.size + 1; timers.set(id, callback); return id }, clearTimeout: (id) => timers.delete(id) })
  return {
    calls, timers,
    get reloads() { return reloads },
    update(value) { context = value },
    render() {
      cursor = 0; effectCursor = 0; refCursor = 0
      const tree = module.exports.QuestionLearningPanel({ sessionId: 's1', practiceId: 'p1', question: { id: 'q1' } })
      readyEffects.splice(0).forEach((effect) => effect())
      return tree
    },
  }
}

const nodes = (tree) => tree && typeof tree === 'object' ? [tree, ...tree.children.flat(Infinity).flatMap(nodes)] : []
const button = (tree, label) => nodes(tree).find((node) => node.type === 'button' && node.children.includes(label))
const settle = () => new Promise((resolve) => setImmediate(resolve))

test('当前题在引导模式自动请求一次 AI，渲染和失败刷新不重复调用', async () => {
  const f = fixture()
  f.render(); await settle(); f.render(); await settle()
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].command, 'question.guidance-generate')
  assert.equal(f.calls[0].payload.automatic, true)
  assert.equal(f.calls[0].payload.force, false)
  f.update({ ...initial(), guidance: { ...initial().guidance, status: 'failed', error: '模型余额不足' } })
  const tree = f.render(); await settle()
  assert.equal(f.calls.length, 1)
  assert.match(nodes(tree).find((node) => node.type === 'error').children[0], /余额不足/)
  await button(tree, '生成 AI 引导').props.onClick()
  assert.equal(f.calls.length, 2)
  assert.equal(f.calls[1].payload.force, false)
})

test('其他练习和标准模式不自动生成，完成档案没有生成入口', async () => {
  for (const change of [{ canAutoGenerate: false }, { enabled: false, canAutoGenerate: false }, { canGenerate: false, canAutoGenerate: false }]) {
    const f = fixture({ ...initial(), guidance: { ...initial().guidance, ...change } })
    const tree = f.render(); await settle()
    assert.equal(f.calls.length, 0)
    if (change.canGenerate === false) assert.equal(button(tree, '生成 AI 引导'), undefined)
  }
})

test('生成状态阻止重复点击并轮询，折叠后停止轮询', () => {
  const f = fixture({ ...initial(), guidance: { ...initial().guidance, status: 'generating', requestId: 'g1' } })
  let tree = f.render()
  assert.equal(f.timers.size, 1)
  assert.equal(button(tree, '生成 AI 引导').props.disabled, true)
  assert.match(nodes(tree).find((node) => node.type === 'loading').props.label, /正在阅读题面/)
  button(tree, '收起引导').props.onClick()
  tree = f.render()
  assert.equal(f.timers.size, 0)
  assert.equal(nodes(tree).some((node) => node.type === 'loading'), false)
})

test('AI 材料生成后仍未解锁，下一步与重新生成分别调用对应操作', async () => {
  const f = fixture({ ...initial(), guidance: { ...initial().guidance, source: 'ai', ready: true, status: 'ready', canReveal: true } })
  const tree = f.render(); await settle()
  assert.equal(f.calls.length, 0)
  assert.equal(nodes(tree).some((node) => node.props.className === 'di-guided-hint'), false)
  await button(tree, '解锁下一步引导').props.onClick()
  assert.equal(f.calls[0].command, 'question.learning-hint')
  await button(tree, '重新生成 AI 引导').props.onClick()
  assert.equal(f.calls[1].command, 'question.guidance-generate')
  assert.equal(f.calls[1].payload.force, true)
  assert.equal(f.reloads, 2)
})

test('复用的引导明确显示未请求 AI，打开和解锁都不调用生成操作', async () => {
  const f = fixture({ ...initial(), guidance: { ...initial().guidance, ready: true, status: 'ready', cached: true, reused: true,
    source: 'ai', canReveal: true } })
  const tree = f.render(); await settle()
  assert.equal(f.calls.length, 0)
  assert.equal(nodes(tree).some((node) => node.children.includes('复用题库中的 AI 引导 · 本次未请求 AI · 提示逐级解锁')), true)
  await button(tree, '解锁下一步引导').props.onClick()
  assert.deepEqual(f.calls.map((call) => call.command), ['question.learning-hint'])
})
