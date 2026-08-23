import React from 'react'
import { LEETCODE_LANGUAGES } from '../../domain/leetcode-languages.js'
import { useCommand } from '../shared/hooks.js'
import { useCardLifecycle } from '../shared/card-transition.js'
import { Button, ErrorNotice, h, Select } from '../shared/ui.js'

export const PRACTICE_MODE_OPTIONS = Object.freeze([
  { value: 'bagu', label: '背八股' },
  { value: 'mock', label: '模拟面试' },
  { value: 'scenario', label: '场景题' },
  { value: 'leetcode', label: '刷力扣' },
])

const CODING_OPTIONS = Object.freeze([
  { value: 'true', label: '是' },
  { value: 'false', label: '否' },
])

const DIFFICULTY_OPTIONS = Object.freeze([
  { value: 'junior', label: '初级' },
  { value: 'intermediate', label: '中级' },
  { value: 'senior', label: '高级' },
])

export function PracticeConfigForm({
  initial = null,
  busy = false,
  disabled = false,
  onSubmit,
  onCancel = null,
  submitLabel = '',
}) {
  const [mode, setMode] = React.useState(initial?.mode || '')
  const [topic, setTopic] = React.useState(initial?.config?.topic || '')
  const [resume, setResume] = React.useState(initial?.config?.resume || '')
  const [interviewerStyle, setInterviewerStyle] = React.useState(initial?.config?.interviewerStyle || '')
  const [coding, setCoding] = React.useState(typeof initial?.config?.coding === 'boolean' ? String(initial.config.coding) : '')
  const [difficulty, setDifficulty] = React.useState(initial?.config?.difficulty || '')
  const [language, setLanguage] = React.useState(initial?.config?.language || '')
  const topicMode = mode === 'bagu' || mode === 'scenario'
  const valid = topicMode
    ? Boolean(topic.trim())
    : mode === 'leetcode' ? Boolean(language) : mode === 'mock' && Boolean(resume.trim() && interviewerStyle.trim() && coding && difficulty)
  const submit = () => {
    if (!valid || disabled) return
    onSubmit(mode === 'mock'
      ? { mode, config: { resume: resume.trim(), interviewerStyle: interviewerStyle.trim(), coding: coding === 'true', difficulty } }
      : mode === 'leetcode' ? { mode, config: { language } } : { mode, config: { topic: topic.trim() } })
  }

  return h('div', { className: 'di-practice-form' },
    h('label', { className: 'di-field' }, h('span', null, '模式'),
      h(Select, { value: mode, options: PRACTICE_MODE_OPTIONS, disabled, onChange: setMode, 'aria-label': '选择练习模式' })),
    topicMode ? h('label', { className: 'di-field' }, h('span', null, '主题'),
      h('input', { className: 'di-input', disabled, value: topic, onChange: (event) => setTopic(event.target.value) })) : null,
    mode === 'leetcode' ? h('label', { className: 'di-field' }, h('span', null, '编程语言'),
      h(Select, { value: language, options: LEETCODE_LANGUAGES.map((item) => ({ value: item.id, label: item.label })), disabled, onChange: setLanguage, 'aria-label': '选择编程语言' })) : null,
    mode === 'mock' ? h(React.Fragment, null,
      h('label', { className: 'di-field di-field-wide' }, h('span', null, '简历'),
        h('textarea', { className: 'di-input di-textarea', disabled, value: resume, onChange: (event) => setResume(event.target.value) })),
      h('label', { className: 'di-field' }, h('span', null, '面试官风格'),
        h('input', { className: 'di-input', disabled, value: interviewerStyle, onChange: (event) => setInterviewerStyle(event.target.value) })),
      h('label', { className: 'di-field' }, h('span', null, '是否手撕代码'),
        h(Select, { value: coding, options: CODING_OPTIONS, disabled, onChange: setCoding, 'aria-label': '选择是否手撕代码' })),
      h('label', { className: 'di-field' }, h('span', null, '面试难度'),
        h(Select, { value: difficulty, options: DIFFICULTY_OPTIONS, disabled, onChange: setDifficulty, 'aria-label': '选择面试难度' }))) : null,
    h('div', { className: 'di-actions di-field-wide' },
      onCancel ? h(Button, { disabled, onClick: onCancel }, '取消') : null,
      h(Button, { tone: 'primary', disabled: disabled || !valid, busy, onClick: submit }, submitLabel || (initial ? '保存配置' : '开始练习'))))
}

export function PracticeSetupCard({ sessionId }) {
  const command = useCommand(sessionId)
  const lifecycle = useCardLifecycle(false)
  const start = (payload) => lifecycle.enter('session.start', () => command.run('session.start', payload))

  return h('article', { className: 'di-card di-setup-card', 'aria-label': '新建练习配置' },
    h('header', { className: 'di-card-head' }, h('div', { className: 'di-title' }, '新建练习')),
    h(PracticeConfigForm, {
      busy: command.busy === 'session.start',
      disabled: lifecycle.locked,
      onSubmit: start,
      submitLabel: lifecycle.consumedBy ? '已提交' : '开始练习',
    }),
    h(ErrorNotice, null, command.error))
}
