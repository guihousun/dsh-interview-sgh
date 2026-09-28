import React from 'react'
import { CODE_LANGUAGES, parseCodeAnswer } from '../../domain/code-answer.js'
import { codeDraftKey, editCodeSelection, readCodeDraft, saveCodeDraft } from '../shared/code-editing.js'
import { useCommand } from '../shared/hooks.js'
import { Button, ErrorNotice, h, Icon } from '../shared/ui.js'

function draftStorage() {
  try { return window.localStorage } catch { return null }
}

export function CodeAnswerEditor({ sessionId, question, artifact, language = '', disabled = false }) {
  const key = codeDraftKey(sessionId, artifact.practiceId, question.id)
  const latest = parseCodeAnswer(question.attempts?.at(-1)?.answer)
  const [draft, setDraft] = React.useState(() => {
    const saved = !disabled && readCodeDraft(draftStorage(), key)
    return { code: '', notes: '', language: language || 'python', ...(latest || {}), ...(saved || {}), ...(language ? { language } : {}) }
  })
  const draftRef = React.useRef(draft)
  const codeRef = React.useRef(null)
  const [saved, setSaved] = React.useState(null)
  const [submission, setSubmission] = React.useState(null)
  const command = useCommand(sessionId)
  const locked = disabled || Boolean(submission) || Boolean(command.busy)

  const update = (patch) => {
    const next = { ...draftRef.current, ...patch }
    draftRef.current = next
    setDraft(next)
    setSaved(saveCodeDraft(draftStorage(), key, next))
  }

  const submit = async () => {
    if (locked || !draftRef.current.code.trim()) return
    try {
      const result = await command.run('question.code-review', { ...artifact, ...draftRef.current })
      setSubmission({ attemptId: result.references.attemptId, queued: result.analysisQueued })
    } catch { /* 保留草稿，错误由 useCommand 展示；用户可修正后重试。 */ }
  }

  const retry = async () => {
    try {
      const result = await command.run('question.code-review.retry', { ...artifact, attemptId: submission.attemptId })
      setSubmission((current) => ({ ...current, queued: result.analysisQueued }))
    } catch { /* 保留已提交代码。 */ }
  }

  const keyDown = (event) => {
    event.stopPropagation()
    if (event.isComposing || event.nativeEvent?.isComposing || locked) return
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      void submit()
      return
    }
    if (event.ctrlKey || event.metaKey || event.altKey || !['Tab', 'Enter'].includes(event.key)) return
    const field = event.currentTarget
    const edit = editCodeSelection(field.value, field.selectionStart, field.selectionEnd, event.key, {
      shift: event.shiftKey, language: draft.language,
    })
    if (!edit) return
    event.preventDefault()
    update({ code: edit.code })
    requestAnimationFrame(() => codeRef.current?.setSelectionRange(edit.start, edit.end))
  }

  return h('section', { className: 'di-code-answer', 'aria-label': '代码作答区' },
    h('header', { className: 'di-code-toolbar' },
      h('div', null,
        h('div', { className: 'di-code-title' }, h(Icon, { name: 'code' }), '代码作答'),
        h('div', { className: 'di-meta' }, 'AI 检查正确性、边界条件和复杂度，不执行代码')),
      h('label', { className: 'di-code-language' }, '语言',
        h('select', { className: 'di-input', value: draft.language, disabled: locked || Boolean(language), 'aria-label': '代码语言', onChange: (event) => update({ language: event.target.value }) },
          CODE_LANGUAGES.map((item) => h('option', { key: item.id, value: item.id }, item.label))))),
    h('div', { className: 'di-code-field' },
      h('pre', { className: 'di-code-lines', 'aria-hidden': 'true', ref: (node) => { if (node) node.scrollTop = codeRef.current?.scrollTop || 0 } },
        Array.from({ length: draft.code.split('\n').length }, (_, index) => index + 1).join('\n')),
      h('textarea', {
        ref: codeRef, className: 'di-code-input', value: draft.code, readOnly: locked,
        'aria-label': '编写代码', placeholder: '在这里写下你的解法…',
        spellCheck: false, autoCorrect: 'off', autoCapitalize: 'off', wrap: 'off',
        onChange: (event) => update({ code: event.target.value }), onKeyDown: keyDown,
        onScroll: (event) => { const gutter = event.currentTarget.previousElementSibling; if (gutter) gutter.scrollTop = event.currentTarget.scrollTop },
      })),
    h('label', { className: 'di-code-notes' }, '思路说明（可选）',
      h('textarea', { className: 'di-input', value: draft.notes, readOnly: locked, rows: 2, 'aria-label': '代码思路说明', placeholder: '描述你的思路，或告诉 AI 想重点检查哪里', onChange: (event) => update({ notes: event.target.value }), onKeyDown: (event) => event.stopPropagation() })),
    h('div', { className: 'di-code-footer' },
      h('div', { className: 'di-meta', role: 'status' }, submission
        ? (submission.queued ? '代码已保存，AI 分析会显示在对话中。' : '代码已保存，AI 分析暂未启动，请重试。')
        : saved === false ? '浏览器无法保存草稿，请保持页面打开。'
          : disabled ? '已保存的代码作答' : '草稿保存在本浏览器 · Tab 缩进 · Ctrl/⌘+Enter 分析'),
      submission && !submission.queued
        ? h(Button, { tone: 'primary', busy: Boolean(command.busy), onClick: retry }, '重试 AI 分析')
        : h(Button, { tone: 'primary', disabled: locked || !draft.code.trim(), busy: command.busy === 'question.code-review', onClick: submit },
          h(Icon, { name: 'code' }), submission ? '已提交分析' : 'AI 分析代码')),
    h(ErrorNotice, null, command.error))
}
