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
