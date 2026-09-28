import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
import { splitSolutionContent } from '../../src/client/shared/solution-content.js'
import { questionSolutionView } from '../../src/domain/question-learning.js'

const CODE = 'class Solution:\n    def merge(self, intervals):\n        # 按起点排序，方便逐个合并区间。\n        intervals.sort(key=lambda interval: interval[0])\n        return intervals'

test('本地题解默认展示原始答案代码，思路、步骤和复杂度独立为解析', () => {
  const solution = questionSolutionView({ mode: 'leetcode', config: { language: 'python' } }, {}, {
    code: CODE, idea: '先排序，再扫描区间。', steps: '比较当前起点与最后一个右端点。', complexity: '时间 O(n log n)，空间 O(n)。',
  })
  const content = splitSolutionContent(solution.detail)
  assert.equal(content.answer, `\`\`\`python\n${CODE}\n\`\`\``)
  assert.equal(content.analysis, '先排序，再扫描区间。\n\n比较当前起点与最后一个右端点。\n\n时间 O(n log n)，空间 O(n)。')
  assert.doesNotMatch(content.analysis, /class Solution|intervals.sort/)
})

test('AI 的多种实现与注释完整保留，示例数据和图解属于解析', () => {
  const first = '```cpp\n// 使用哈希表记录已经出现的数。\nreturn answer;\n```'
  const second = '~~~python\n# 同一算法的 Python 实现。\nreturn result\n~~~'
  const example = '```json\n[1, 2, 3]\n```'
  const diagram = '```mermaid\nflowchart LR\nA --> B\n```'
  const content = splitSolutionContent(`## 方法一\n先维护哈希表。\n${example}\n${first}\n## 方法二\n改用排序。\n${second}\n${diagram}\n空间 O(n)。`)
  assert.equal(content.answer, `${first}\n\n${second}`)
  assert.match(content.analysis, /方法一[\s\S]*方法二[\s\S]*空间 O\(n\)/)
  assert.ok(content.analysis.includes(example))
  assert.ok(content.analysis.includes(diagram))
  assert.doesNotMatch(content.answer, /mermaid|\[1, 2, 3\]/)
})

test('正确识别长围栏、围栏内字符串和未闭合代码，不截断或改写答案', () => {
  const fenced = '````python\n# 三个反引号属于代码字符串。\ntext = """\n```\n"""\nreturn text\n`````'
  const content = splitSolutionContent(`思路\r\n${fenced.replace(/\n/g, '\r\n')}\r\n复杂度`)
  assert.equal(content.answer, fenced)
  assert.equal(content.analysis, '思路\n\n复杂度')
  assert.deepEqual(splitSolutionContent('思路\n```python\n# 待补全\nreturn 1'), {
    answer: '```python\n# 待补全\nreturn 1', analysis: '思路',
  })
})

test('没有代码的文字参考答案保持可见，不会被清空或全部藏进解析', () => {
  const text = 'JMM 规定线程间的可见性。\n\n```text\n示例说明\n```'
  assert.deepEqual(splitSolutionContent(text), { answer: text, analysis: '' })
  assert.deepEqual(splitSolutionContent(''), { answer: '', analysis: '' })
})

function contentFixture() {
  const module = { exports: {} }
  let open = false
  const modules = {
    react: { useState: () => [open, (update) => { open = typeof update === 'function' ? update(open) : update }] },
    './solution-content.js': { splitSolutionContent },
    './ui.js': { h: (type, props, ...children) => ({ type, props: props || {}, children }), Button: 'button', Icon: 'icon', Markdown: 'markdown' },
  }
  const source = readFileSync(new URL('../../src/client/shared/solution-disclosure.js', import.meta.url), 'utf8')
  vm.runInNewContext(transformSync(source, { format: 'cjs' }).code, { module, exports: module.exports, require: (name) => modules[name] })
  return (props) => module.exports.SolutionContent(props)
}
const all = (tree) => tree && typeof tree === 'object' ? [tree, ...tree.children.flat(Infinity).flatMap(all)] : []

test('打开正确答案只显示答案，解析与解题要点默认收起，可反复展开和关闭', () => {
  const render = contentFixture()
  const props = { detail: `先排序。\n\n\`\`\`python\n${CODE}\n\`\`\`\n\n时间 O(n log n)。`, memorizationPoints: '排序后只检查最后一个区间。' }
  let tree = render(props)
  const markdown = () => all(tree).filter((node) => node.type === 'markdown').map((node) => node.children[0])
  const toggle = () => all(tree).find((node) => node.type === 'button')
  assert.equal(markdown().length, 1)
  assert.ok(markdown()[0].includes(CODE))
  assert.equal(toggle().props['aria-expanded'], false)
  assert.ok(toggle().children.includes('展开解析'))
  toggle().props.onClick(); tree = render(props)
  assert.equal(toggle().props['aria-expanded'], true)
  assert.ok(markdown().includes('先排序。\n\n时间 O(n log n)。'))
  assert.ok(markdown().includes(props.memorizationPoints))
  toggle().props.onClick(); tree = render(props)
  assert.equal(markdown().length, 1)
  assert.equal(toggle().props['aria-expanded'], false)
  // 关闭整个答案再打开会重新挂载，解析仍默认收起。
  tree = contentFixture()(props)
  assert.equal(toggle().props['aria-expanded'], false)
})

test('点评卡与题目面板共用答案和解析展示，保留原始题解和要点', () => {
  const module = { exports: {} }
  const h = (type, props, ...children) => ({ type, props: props || {}, children })
  const modules = {
    react: {}, '../shared/api.js': {}, '../shared/hooks.js': { useCommand: () => ({}) },
    '../shared/card-transition.js': { useCardTransition: () => ({}) },
    '../shared/solution-disclosure.js': { SolutionDisclosure: 'disclosure', SolutionContent: 'solution-content' },
    '../shared/ui.js': { h, Markdown: 'markdown' },
  }
  const source = readFileSync(new URL('../../src/client/features/live-interview.js', import.meta.url), 'utf8')
  vm.runInNewContext(transformSync(source, { format: 'cjs' }).code, { module, exports: module.exports, require: (name) => modules[name] || {} })
  const explanation = { detail: '思路\n```python\n# 返回答案\nreturn 1\n```', memorizationPoints: '关键点' }
  const tree = module.exports.ReviewResultCard({ question: { id: 'q1', leetcode: {}, explanation }, artifact: {} })
  const content = all(tree).find((node) => node.type === 'solution-content')
  assert.equal(content.props.detail, explanation.detail)
  assert.equal(content.props.memorizationPoints, explanation.memorizationPoints)
  assert.equal(content.props.pointsLabel, '解题要点')
})
