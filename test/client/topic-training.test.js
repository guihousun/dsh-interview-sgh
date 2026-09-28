import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
import * as difficulties from '../../src/domain/leetcode-problems.js'
import { leetcodeDifficultyLabel } from '../../src/domain/leetcode-top-100.js'
import { applicationFixture } from '../support/application-fixture.js'

function componentFixture(file, modules = {}) {
  const module = { exports: {} }, states = []
  let cursor = 0
  const h = (type, props, ...children) => ({ type, props: props || {}, children })
  const react = { useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value }] } }
  const source = transformSync(readFileSync(new URL(file, import.meta.url), 'utf8'), { format: 'cjs' }).code
  vm.runInNewContext(source, { module, exports: module.exports, require: (name) => name === 'react' ? react : name.endsWith('/ui.js') ? { h, Button: 'button', Select: 'select', ErrorNotice: 'error' } : modules[name] })
  return { render(name, props) { cursor = 0; return module.exports[name](props) } }
}
const all = (tree) => tree && typeof tree === 'object' ? [tree, ...tree.children.flat(Infinity).flatMap(all)] : []

test('easy、medium、hard 标签可多选、取消和恢复全部，题目徽标显示英文标签', () => {
  const fixture = componentFixture('../../src/client/shared/difficulty-tags.js', {
    '../../domain/leetcode-problems.js': difficulties, '../../domain/leetcode-top-100.js': { leetcodeDifficultyLabel },
  })
  let value = []
  const render = () => all(fixture.render('DifficultyTags', { value, onChange: (selected) => { value = Array.from(selected) } }))
  const tag = (name) => render().find((node) => node.props['aria-label']?.startsWith(name))
  tag('easy').props.onClick(); tag('medium').props.onClick()
  assert.deepEqual(value, ['easy', 'medium'])
  assert.equal(tag('easy').props['aria-pressed'], true)
  tag('easy').props.onClick()
  assert.deepEqual(value, ['medium'])
  render().find((node) => node.type === 'button' && node.children[0] === '全部难度').props.onClick()
  assert.deepEqual(value, [])
  assert.equal(fixture.render('DifficultyBadge', { difficulty: 'hard' }).children[0], 'hard')
})

test('工作台顺序与随机按钮传递相同范围，空组合无法推进', async () => {
  const catalog = (await applicationFixture().application.getLeetcodeCatalog()).resource.data
  const fixture = componentFixture('../../src/client/features/leetcode-training.js', {
    '../shared/hooks.js': { useInterviewQuery: () => ({ data: { resource: { data: catalog } } }) },
    '../shared/api.js': {}, '../shared/difficulty-tags.js': { DifficultyTags: 'tags' },
    '../../domain/leetcode-problems.js': difficulties,
  })
  const requests = []
  const props = { sessionId: 's1', practice: { config: { category: '哈希', difficulties: ['easy', 'medium'] } }, busy: '', onNext: (request) => requests.push(JSON.parse(JSON.stringify(request))) }
  let tree = all(fixture.render('LeetcodeTrainingControls', props))
  tree.find((node) => node.type === 'button' && node.children[0] === '按专题顺序下一道').props.onClick()
  tree.find((node) => node.type === 'button' && node.children[0] === '随机下一道').props.onClick()
  assert.deepEqual(requests.map((request) => request.selectionMode), ['ordered', 'random'])
  assert.deepEqual(requests[0].difficulties, requests[1].difficulties)
  assert.equal(requests[0].category, '哈希')
  tree.find((node) => node.type === 'tags').props.onChange(['hard'])
  tree = all(fixture.render('LeetcodeTrainingControls', props))
  assert.ok(tree.filter((node) => node.type === 'button').every((node) => node.props.disabled))
})

test('下一题先显示后端确认的题面与编辑上下文，列表旧数据不会关闭代码区', () => {
  const old = { id: 'p1', topic: '两数之和', mode: 'leetcode', status: 'active', config: {}, questions: [] }
  const next = { id: 'p2', topic: '字母异位词分组', mode: 'leetcode', status: 'active', config: {}, questions: [] }
  let listed = [old], detail = old
  const fixture = componentFixture('../../src/client/features/practice-library.js', {
    '../shared/hooks.js': { useCommand: () => ({}), useInterviewQuery: (key) => ({ data: { resource: { data: key.startsWith('practices:') ? listed : detail } }, loading: false }) },
    '../shared/api.js': {}, './practice-config.js': { PRACTICE_MODE_OPTIONS: [{ value: 'leetcode', label: '刷力扣' }] },
    '../../domain/leetcode-languages.js': {}, '../../domain/leetcode-guidance.js': {},
    './code-answer.js': {}, './question-learning.js': {}, './question-solution.js': {}, './practice-documents.js': {}, '../shared/difficulty-tags.js': {}, './leetcode-training.js': {},
  })
  const props = { sessionId: 's1', initialPracticeId: 'p1', statusScope: 'active' }
  const renderDetail = () => all(fixture.render('PracticeLibrary', props)).find((node) => node.type?.name === 'PracticeDetail')
  renderDetail().props.onAdvanced({ practice: next, currentQuestionId: 'q2', revision: 2 })
  const pending = renderDetail()
  assert.equal(pending.props.practice.id, 'p2')
  assert.equal(pending.props.initialCodeContext.questionId, 'q2')
  listed = [next]; detail = next
  const loaded = renderDetail()
  assert.equal(loaded.props.practice.id, 'p2')
  assert.equal(loaded.props.initialCodeContext, pending.props.initialCodeContext)
})
