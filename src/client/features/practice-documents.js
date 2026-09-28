import React from 'react'
import { DOCUMENT_ACCEPT, DOCUMENT_LIMITS } from '../../domain/practice-attachments.js'
import { interviewApi } from '../shared/api.js'
import { Button, ErrorNotice, h, Icon } from '../shared/ui.js'

export function documentInfoText(file) {
  return [file.name, file.pages ? `${file.pages} 页` : '', `${Math.round(file.size / 1024) || 1} KB`].filter(Boolean).join(' · ')
}

export function ResumeDocumentField({ value, file, disabled, onChange, onFileChange, onPendingChange }) {
  const inputRef = React.useRef(null)
  const busyRef = React.useRef(false)
  const [progress, setProgress] = React.useState('')
  const [error, setError] = React.useState('')
  const [warnings, setWarnings] = React.useState([])
  const upload = async (event) => {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (!selected || disabled || busyRef.current) return
    busyRef.current = true
    setError(''); setWarnings([]); setProgress(`正在解析 ${selected.name}…`); onPendingChange(1)
    try {
      const { material } = await interviewApi.extractDocument(selected)
      onChange(material.text)
      const { text: _text, warnings: notices, id: _id, ...info } = material
      onFileChange(info)
      setWarnings(notices || [])
    } catch (failure) { setError(failure.message || '简历解析失败，请重新选择文件') }
    finally { busyRef.current = false; setProgress(''); onPendingChange(-1) }
  }
  return h('section', { className: 'di-field di-field-wide di-resume-document', 'aria-label': '简历导入' },
    h('div', { className: 'di-document-head' },
      h('span', null, '简历'),
      h(Button, { disabled, busy: Boolean(progress), onClick: () => inputRef.current?.click() }, h(Icon, { name: 'upload' }), file ? '更换简历文件' : '上传简历')),
    h('input', { ref: inputRef, type: 'file', accept: DOCUMENT_ACCEPT, hidden: true, disabled, 'aria-label': '选择简历文件', onChange: upload }),
    h('div', { className: 'di-meta' }, '支持 PDF、DOCX、TXT、Markdown，每份最多 10 MB；导入后可修改下方文字。'),
    file ? h('div', { className: 'di-document-file', role: 'status' },
      h('span', null, documentInfoText(file)),
      h(Button, { disabled, onClick: () => { onFileChange(null); setWarnings([]) } }, '移除文件标记')) : null,
    progress ? h('div', { className: 'di-meta', role: 'status', 'aria-live': 'polite' }, progress) : null,
    warnings.map((warning) => h('div', { className: 'di-notice', key: warning }, warning)),
    h('textarea', { className: 'di-input di-textarea', 'aria-label': '简历', maxLength: DOCUMENT_LIMITS.text, disabled, value, placeholder: '上传简历文件，或直接粘贴简历文字', onChange: (event) => onChange(event.target.value) }),
    h(ErrorNotice, null, error))
}

export function ReferenceDocumentsField({ materials, disabled, onChange, onPendingChange }) {
  const inputRef = React.useRef(null)
  const busyRef = React.useRef(false)
  const [progress, setProgress] = React.useState('')
  const [error, setError] = React.useState('')
  const upload = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length || disabled || busyRef.current) return
    if (materials.length + files.length > DOCUMENT_LIMITS.references) { setError('最多添加 8 份参考资料，请先移除不需要的资料'); return }
    busyRef.current = true
    setError(''); onPendingChange(1)
    const next = [...materials]
    const notices = []
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        setProgress(`正在解析 ${file.name}（${index + 1}/${files.length}）…`)
        try {
          const { material } = await interviewApi.extractDocument(file)
          if (next.some((item) => item.id === material.id)) { notices.push(`“${file.name}”已添加，无需重复上传。`); continue }
          if (next.reduce((sum, item) => sum + item.text.length, 0) + material.text.length > DOCUMENT_LIMITS.referenceText) { notices.push(`“${file.name}”未添加：参考资料合计不能超过 180000 字符。`); continue }
          next.push(material)
          onChange([...next])
          notices.push(...(material.warnings || []).map((message) => `${file.name}：${message}`))
        } catch (failure) { notices.push(`${file.name}：${failure.message || '解析失败'}`) }
      }
    } finally { busyRef.current = false; setProgress(''); onPendingChange(-1); setError(notices.join('\n')) }
  }
  return h('section', { className: 'di-field-wide di-reference-documents', 'aria-label': '参考资料' },
    h('div', { className: 'di-document-head' },
      h('span', null, `参考资料（可选）${materials.length ? ` · ${materials.length}/${DOCUMENT_LIMITS.references}` : ''}`),
      h(Button, { disabled: disabled || materials.length >= DOCUMENT_LIMITS.references, busy: Boolean(progress), onClick: () => inputRef.current?.click() }, h(Icon, { name: 'upload' }), '上传参考资料')),
    h('input', { ref: inputRef, type: 'file', multiple: true, accept: DOCUMENT_ACCEPT, hidden: true, disabled, 'aria-label': '选择参考资料文件', onChange: upload }),
    h('div', { className: 'di-meta' }, '可上传岗位说明、项目介绍或面试笔记。支持 PDF、DOCX、TXT、Markdown，最多 8 份，每份最多 10 MB。'),
    h('div', { className: 'di-meta' }, '练习保存提取的文字和文件信息，AI 会结合这些资料提问。'),
    progress ? h('div', { className: 'di-meta', role: 'status', 'aria-live': 'polite' }, progress) : null,
    materials.map((material) => h('div', { className: 'di-reference-file', key: material.id },
      h('div', { className: 'di-document-file' },
        h('span', null, documentInfoText(material)),
        h(Button, { disabled, 'aria-label': `移除参考资料：${material.name}`, onClick: () => onChange(materials.filter((item) => item.id !== material.id)) }, '移除')),
      h('details', null,
        h('summary', null, `查看和编辑内容 · ${material.text.length} 字符`),
        h('textarea', { className: 'di-input di-textarea', value: material.text, disabled, maxLength: DOCUMENT_LIMITS.text, 'aria-label': `参考资料内容：${material.name}`, onChange: (event) => onChange(materials.map((item) => item.id === material.id ? { ...item, text: event.target.value } : item)) })),
      !material.text.trim() ? h(ErrorNotice, null, '资料内容不能为空，可补充文字或移除这份资料。') : null)),
    h(ErrorNotice, null, error))
}

export function PracticeDocumentSources({ config }) {
  if (!config?.resumeFile && !config?.referenceMaterials?.length) return null
  return h('section', { className: 'di-practice-sources' },
    config.resumeFile ? h('div', { className: 'di-meta' }, `简历文件：${documentInfoText(config.resumeFile)}`) : null,
    config.referenceMaterials?.length ? h('div', null,
      h('div', { className: 'di-section-label' }, `参考资料 · ${config.referenceMaterials.length} 份`),
      config.referenceMaterials.map((material) => h('details', { key: material.id, className: 'di-reference-file' },
        h('summary', null, documentInfoText(material)),
        h('pre', { className: 'di-document-text' }, material.text)))) : null)
}
