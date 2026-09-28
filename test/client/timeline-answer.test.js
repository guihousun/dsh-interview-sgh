import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'

function fixture() {
  const module = { exports: {} }, states = [], calls = []
  let cursor = 0
  const react = { Fragment: 'fragment', useState(initial) {
    const index = cursor++
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
    return [states[index], (update) => { states[index] = typeof update === 'function' ? update(states[index]) : update }]
  } }
  const modules = {
    react, '../shared/api.js': { interviewApi: {} },
    '../shared/hooks.js': { useCommand: () => ({ run: async (command, payload) => {
      calls.push({ command, payload })
      return { resource: { data: { practice: { id: 'p1' }, currentQuestionId: 'q1', revision: 7 } } }
    } }) },
    '../shared/ui.js': { h: (type, props, ...children) => ({ type, props: props || {}, children }), Button: 'button', ErrorNotice: 'error', Icon: 'icon', Markdown: 'markdown' },
    './code-answer.js': { CodeAnswerEditor: 'code-editor' },
    './question-learning.js': { QuestionLearningPanel: 'learning' },
    './question-solution.js': { QuestionSolutionPanel: 'solution' },
    '../shared/difficulty-tags.js': { DifficultyBadge: 'difficulty' },
  }
  const source = readFileSync(new URL('../../src/client/features/timeline.js', import.meta.url), 'utf8')
  vm.runInNewContext(transformSync(source, { format: 'cjs' }).code, { module, exports: module.exports, require: (name) => modules[name] })
  return { calls, render(name, props) { cursor = 0; return module.exports[name](props) } }
}

const all = (tree) => tree && typeof tree === 'object' ? [tree, ...tree.children.flat(Infinity).flatMap(all)] : []
const props = () => ({ sessionId: 's1', practice: { id: 'p1', mode: 'leetcode', status: 'active', config: { language: 'python' } },
  question: { id: 'q1', prompt: '移动零', leetcode: { category: '双指针', difficulty: 'easy' }, attempts: [] } })

test('同一面板同时展示题目、作答和折叠答案，模拟面试保持答案限制', () => {
  const f = fixture()
  let tree = f.render('TimelineContent', props())
  assert.equal(all(tree).filter((node) => node.props.role === 'tab' || node.props.role === 'tablist').length, 0)
  assert.ok(all(tree).some((node) => node.type === 'learning'))
  assert.ok(all(tree).some((node) => node.props['aria-label'] === '作答与记录'))
  assert.ok(all(tree).some((node) => node.type === 'solution'))
  tree = f.render('TimelineContent', { ...props(), question: { ...props().question, capabilities: { allowReveal: false } } })
  assert.equal(all(tree).some((node) => node.type === 'solution'), false)
})

test('当前题立即可编辑，使用服务器会话修订号且打开时不调用 AI', () => {
  const f = fixture()
  const tree = f.render('TimelineAnswerEntry', { ...props(), session: { practice: { id: 'p1' }, currentQuestionId: 'q1', revision: 3 } })
  const editor = all(tree).find((node) => node.type === 'code-editor')
  assert.equal(editor.props.artifact.sessionRevision, 3)
  assert.equal(editor.props.artifact.questionId, 'q1')
  assert.equal(editor.props.language, 'python')
  assert.equal(f.calls.length, 0)
})

test('历史题点击后才切回并进入编辑，完成档案不开放作答', async () => {
  const f = fixture()
  let tree = f.render('TimelineAnswerEntry', props())
  assert.equal(all(tree).some((node) => node.type === 'code-editor'), false)
  await all(tree).find((node) => node.type === 'button').props.onClick()
  tree = f.render('TimelineAnswerEntry', props())
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].command, 'question.code-open')
  assert.equal(f.calls[0].payload.questionId, 'q1')
  assert.equal(all(tree).find((node) => node.type === 'code-editor').props.artifact.sessionRevision, 7)
  tree = f.render('TimelineAnswerEntry', { ...props(), practice: { ...props().practice, status: 'completed' } })
  assert.equal(all(tree).some((node) => node.type === 'code-editor' || node.type === 'button'), false)
})
