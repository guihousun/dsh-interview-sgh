import React from 'react'
import { CODE_LANGUAGES, parseCodeAnswer } from '../../domain/code-answer.js'
import { codeDraftKey, editCodeSelection, readCodeDraft, saveCodeDraft } from '../shared/code-editing.js'
import { useCommand } from '../shared/hooks.js'
import { Button, ErrorNotice, h, Icon } from '../shared/ui.js'

function draftStorage() {
  try { return window.localStorage } catch { return null }
}

function sameCode(left, right) {
  return Boolean(left && right && left.language === right.language
    && left.code.replace(/\r\n?/g, '\n') === right.code.replace(/\r\n?/g, '\n')
    && (left.notes || '').trim() === (right.notes || '').trim())
}

export function CodeAnswerEditor({ sessionId, question, artifact, language = '', disabled = false }) {
  const key = codeDraftKey(sessionId, artifact.practiceId, question.id)
  const previous = [...(question.attempts || [])].reverse().map((attempt) => ({ attempt, code: parseCodeAnswer(attempt.answer) })).find((item) => item.code)
  const latest = previous?.code
  const [draft, setDraft] = React.useState(() => {
    const saved = !disabled && readCodeDraft(draftStorage(), key)
    return { code: '', notes: '', language: language || 'python', ...(latest || {}), ...(saved || {}), ...(language ? { language } : {}) }
  })
  const draftRef = React.useRef(draft)
  const codeRef = React.useRef(null)
  const [saved, setSaved] = React.useState(null)
  const [submission, setSubmission] = React.useState(() => previous ? { attemptId: previous.attempt.id, code: previous.code, queued: null } : null)
  const submissionRef = React.useRef(submission)
  const artifactRef = React.useRef(artifact)
  const inFlight = React.useRef(false)
  const [needsReconnect, setNeedsReconnect] = React.useState(false)
  const [notice, setNotice] = React.useState('')
  const command = useCommand(sessionId)
  const locked = disabled || Boolean(command.busy)
  const submitted = sameCode(draft, submission?.code)
  const evaluated = submitted && question.attempts?.some((attempt) => attempt.id === submission.attemptId && attempt.evaluation)

  const rememberSubmission = (value) => { submissionRef.current = value; setSubmission(value) }

  const update = (patch) => {
    const next = { ...draftRef.current, ...patch }
    draftRef.current = next
    setDraft(next)
    setSaved(saveCodeDraft(draftStorage(), key, next))
    setNotice('')
  }

  const submit = async (analyze = false) => {
    if (locked || inFlight.current || !draftRef.current.code.trim()) return
    const existing = submissionRef.current
    const unchanged = sameCode(draftRef.current, existing?.code)
    if (unchanged && (!analyze || existing.queued || question.attempts?.some((attempt) => attempt.id === existing.attemptId && attempt.evaluation))) return
    inFlight.current = true
    const snapshot = { ...draftRef.current }
    try {
      const result = await command.run(analyze && unchanged ? 'question.code-review.retry' : analyze ? 'question.code-review' : 'question.code-submit',
        { ...artifactRef.current, ...snapshot, ...(analyze && unchanged ? { attemptId: existing.attemptId } : {}) })
      if (!result) return
      if (!unchanged) artifactRef.current = { ...artifactRef.current, sessionRevision: result.revision,
        presentationId: `code-saved:${result.references.attemptId}:${result.revision}` }
      const code = parseCodeAnswer(result.resource?.data?.answer) || snapshot
      rememberSubmission({ attemptId: unchanged ? existing.attemptId : result.references.attemptId, code,
        queued: analyze ? Boolean(result.analysisQueued) : null })
      setNeedsReconnect(false)
      setNotice('')
    } catch (error) {
      // 提交失败不会清空输入；过期凭证由用户明确重新连接，不偷偷切换正在做的题。
      if (error?.code === 'STALE_PRESENTATION') setNeedsReconnect(true)
    } finally { inFlight.current = false }
  }

  const reconnect = async () => {
    if (inFlight.current || disabled) return
    inFlight.current = true
    try {
      const result = await command.run('question.code-open', { practiceId: artifact.practiceId, questionId: question.id })
      const current = result?.resource?.data
      if (current?.practice?.id !== artifact.practiceId || current.currentQuestionId !== question.id) return
      artifactRef.current = { ...artifactRef.current, sessionRevision: current.revision, presentationId: `code-reconnect:${current.revision}:${Date.now()}` }
      setNeedsReconnect(false)
      setNotice('编辑器已重新连接，代码已保留，可以再次提交。')
    } catch { /* 代码与本地草稿继续保留。 */ }
    finally { inFlight.current = false }
  }

  const keyDown = (event) => {
    event.stopPropagation()
    if (event.isComposing || event.nativeEvent?.isComposing || locked) return
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      void submit(event.shiftKey)
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
        h('div', { className: 'di-meta' }, '提交保存作答；AI 可检查正确性、边界与复杂度，不执行代码')),
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
      h('div', { className: 'di-meta', role: 'status' }, notice || (disabled ? '已保存的代码作答' : submitted
        ? (submission.queued === null ? '代码已提交到练习档案，下次打开可查看。' : submission.queued ? '代码已保存，AI 分析会显示在对话中。' : '代码已保存，AI 分析暂未启动，可重试。')
        : saved === false ? '浏览器无法保存草稿，请保持页面打开。'
          : '草稿保存在本浏览器 · Ctrl/⌘+Enter 提交 · Ctrl/⌘+Shift+Enter 分析')),
      h('div', { className: 'di-actions di-code-submit-actions' },
        needsReconnect && !disabled ? h(Button, { busy: command.busy === 'question.code-open', disabled: Boolean(command.busy), onClick: reconnect }, '重新连接编辑器') : null,
        h(Button, { tone: 'primary', disabled: locked || needsReconnect || !draft.code.trim() || submitted,
          busy: command.busy === 'question.code-submit', onClick: () => submit(false) }, submitted ? '已提交' : '提交代码'),
        h(Button, { disabled: locked || needsReconnect || !draft.code.trim() || Boolean(evaluated) || (submitted && submission.queued === true),
          busy: ['question.code-review', 'question.code-review.retry'].includes(command.busy), onClick: () => submit(true) },
          h(Icon, { name: 'code' }), evaluated ? '已完成分析' : submitted && submission.queued === true ? '分析已提交' : submitted && submission.queued === false ? '重试 AI 分析' : 'AI 分析代码'))),
    h(ErrorNotice, null, command.error))
}
