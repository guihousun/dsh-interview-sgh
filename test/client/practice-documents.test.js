import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
import { DOCUMENT_ACCEPT, DOCUMENT_LIMITS } from '../../src/domain/practice-attachments.js'

function componentFixture(file, modules = {}) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const compiled = transformSync(source, { format: 'cjs' }).code
  const module = { exports: {} }, states = []
  let cursor = 0
  const react = { useRef: (current) => ({ current }), useState(initial) {
    const index = cursor++
    if (!(index in states)) states[index] = initial
    return [states[index], (update) => { states[index] = typeof update === 'function' ? update(states[index]) : update }]
  } }
  const ui = { h: (type, props, ...children) => ({ type, props: props || {}, children }), Button: 'button', ErrorNotice: 'error', Icon: 'icon', Select: 'select' }
  vm.runInNewContext(compiled, { exports: module.exports, module, require: (name) => name === 'react' ? react : name === '../shared/ui.js' ? ui : modules[name] })
  return { render(name, props) { cursor = 0; return module.exports[name](props) } }
}

const all = (tree) => tree && typeof tree === 'object' ? [tree, ...tree.children.flat(Infinity).flatMap(all)] : []

test('简历解析失败保留原文字，成功后填入文字与文件信息，解析状态总能释放', async () => {
  let reject, resolve
  const fixture = componentFixture('../../src/client/features/practice-documents.js', {
    '../../domain/practice-attachments.js': { DOCUMENT_ACCEPT, DOCUMENT_LIMITS },
    '../shared/api.js': { interviewApi: { extractDocument: () => new Promise((yes, no) => { resolve = yes; reject = no }) } },
  })
  let resume = '已有的简历', file = null
  const pending = []
  const props = { value: resume, file, disabled: false, onChange: (text) => { resume = text }, onFileChange: (info) => { file = info }, onPendingChange: (delta) => pending.push(delta) }
  const input = () => all(fixture.render('ResumeDocumentField', { ...props, value: resume, file })).find((node) => node.type === 'input')
  const first = input().props.onChange({ target: { files: [{ name: 'bad.pdf' }], value: 'chosen' } })
  reject(new Error('PDF 无法解析'))
  await first
  assert.equal(resume, '已有的简历')
  assert.equal(file, null)
  const second = input().props.onChange({ target: { files: [{ name: 'Resume.pdf' }], value: 'chosen' } })
  resolve({ material: { id: 'file-1', name: 'Resume.pdf', type: 'pdf', size: 500, pages: 1, text: '真实提取的简历正文', warnings: [] } })
  await second
  assert.equal(resume, '真实提取的简历正文')
  assert.equal(file.name, 'Resume.pdf')
  assert.equal(file.text, undefined)
  assert.deepEqual(pending, [1, -1, 1, -1])
})

test('多份资料中单份失败不会丢失已导入资料，并保留明确错误', async () => {
  const fixture = componentFixture('../../src/client/features/practice-documents.js', {
    '../../domain/practice-attachments.js': { DOCUMENT_ACCEPT, DOCUMENT_LIMITS },
    '../shared/api.js': { interviewApi: { async extractDocument(file) { if (file.name === 'bad.pdf') throw new Error('扫描版请先 OCR'); return { material: { id: 'new-1', name: file.name, size: 300, text: '项目文档内容', warnings: [] } } } } },
  })
  let materials = [{ id: 'old-1', name: '已有.md', size: 10, text: '已保存的资料' }]
  const pending = []
  const props = { materials, disabled: false, onChange: (value) => { materials = value }, onPendingChange: (delta) => pending.push(delta) }
  const tree = fixture.render('ReferenceDocumentsField', props)
  const input = all(tree).find((node) => node.type === 'input')
  await input.props.onChange({ target: { files: [{ name: '项目.docx' }, { name: 'bad.pdf' }], value: 'chosen' } })
  assert.equal(materials.length, 2)
  assert.equal(materials[0].text, '已保存的资料')
  assert.equal(materials[1].text, '项目文档内容')
  assert.deepEqual(pending, [1, -1])
  const rendered = all(fixture.render('ReferenceDocumentsField', { ...props, materials }))
  assert.match(rendered.find((node) => node.type === 'error').children[0], /bad.pdf.*扫描版请先 OCR/)
})

test('配置提交包含已编辑资料，解析过程中或存在空资料时不能提交', () => {
  const submitted = []
  const fixture = componentFixture('../../src/client/features/practice-config.js', {
    '../../domain/practice-attachments.js': { DOCUMENT_LIMITS },
    '../../domain/leetcode-languages.js': {}, '../../domain/leetcode-guidance.js': {},
    '../shared/hooks.js': {}, '../shared/card-transition.js': {},
    './practice-documents.js': { ResumeDocumentField: 'resume-upload', ReferenceDocumentsField: 'reference-upload' },
  })
  const props = { initial: { mode: 'mock', config: { resume: '测试简历', targetRole: '后端', jobDescriptionProvided: false, interviewerStyle: '专业追问', coding: false, difficulty: 'intermediate' } }, onSubmit: (payload) => submitted.push(payload) }
  let tree = all(fixture.render('PracticeConfigForm', props))
  const resume = tree.find((node) => node.type === 'resume-upload')
  resume.props.onChange('导入后修改过的简历')
  resume.props.onFileChange({ name: 'Resume.pdf', type: 'pdf', size: 300, pages: 1 })
  resume.props.onPendingChange(1)
  tree = all(fixture.render('PracticeConfigForm', props))
  let button = tree.find((node) => node.type === 'button' && node.children[0] === '保存配置')
  assert.equal(button.props.disabled, true)
  button.props.onClick()
  assert.equal(submitted.length, 0)
  resume.props.onPendingChange(-1)
  tree.find((node) => node.type === 'reference-upload').props.onChange([{ id: 'f1', name: 'notes.md', size: 20, text: '修改过的参考文字' }])
  tree = all(fixture.render('PracticeConfigForm', props))
  button = tree.find((node) => node.type === 'button' && node.children[0] === '保存配置')
  button.props.onClick()
  assert.equal(submitted[0].config.resumeFile.name, 'Resume.pdf')
  assert.equal(submitted[0].config.resume, '导入后修改过的简历')
  assert.equal(submitted[0].config.referenceMaterials[0].text, '修改过的参考文字')
  tree.find((node) => node.type === 'reference-upload').props.onChange([{ id: 'f1', name: 'notes.md', text: ' ' }])
  tree = all(fixture.render('PracticeConfigForm', props))
  assert.equal(tree.find((node) => node.type === 'button' && node.children[0] === '保存配置').props.disabled, true)
})
