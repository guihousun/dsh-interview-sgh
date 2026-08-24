import React from 'react'
import { LEETCODE_LANGUAGES, leetcodeLanguageLabel } from '../../domain/leetcode-languages.js'
import { useCommand } from '../shared/hooks.js'
import { useCardLifecycle } from '../shared/card-transition.js'
import { Button, ErrorNotice, h, Icon, Select } from '../shared/ui.js'

export const PRACTICE_MODE_OPTIONS = Object.freeze([
  { value: 'bagu', label: '背八股' },
  { value: 'mock', label: '模拟面试' },
  { value: 'scenario', label: '场景题' },
  { value: 'leetcode', label: '刷力扣' },
])

function modeLabel(mode) {
  return PRACTICE_MODE_OPTIONS.find((option) => option.value === mode)?.label || ''
}

const CODING_OPTIONS = Object.freeze([
  { value: 'true', label: '是' },
  { value: 'false', label: '否' },
])

const JD_OPTIONS = Object.freeze([
  { value: 'true', label: '提供 JD' },
  { value: 'false', label: '不提供 JD' },
])

const DIFFICULTY_OPTIONS = Object.freeze([
  { value: 'junior', label: '初级' },
  { value: 'intermediate', label: '中级' },
  { value: 'senior', label: '高级' },
])

function completedConfigText(payload) {
  if (!payload) return ''
  if (payload.mode === 'mock') {
    const difficulty = DIFFICULTY_OPTIONS.find((option) => option.value === payload.config.difficulty)?.label || ''
    const jd = payload.config.jobDescriptionProvided ? '含 JD' : '未提供 JD'
    return `${modeLabel(payload.mode)} · ${payload.config.targetRole} · ${difficulty}难度 · ${jd}`
  }
  if (payload.mode === 'leetcode') return `${modeLabel(payload.mode)} · ${leetcodeLanguageLabel(payload.config.language)}`
  return `${modeLabel(payload.mode)} · ${payload.config.topic}`
}

export function PracticeConfigForm({
  initial = null,
  busy = false,
  disabled = false,
  onSubmit,
  onCancel = null,
  submitLabel = '',
}) {
  const [mode, setMode] = React.useState(initial?.mode || '')
  const [step, setStep] = React.useState(initial ? 'config' : 'mode')
  const [topic, setTopic] = React.useState(initial?.config?.topic || '')
  const [resume, setResume] = React.useState(initial?.config?.resume || '')
  const [targetRole, setTargetRole] = React.useState(initial?.config?.targetRole || '')
  const [jobDescriptionProvided, setJobDescriptionProvided] = React.useState(typeof initial?.config?.jobDescriptionProvided === 'boolean' ? String(initial.config.jobDescriptionProvided) : '')
  const [jobDescription, setJobDescription] = React.useState(initial?.config?.jobDescription || '')
  const [interviewerStyle, setInterviewerStyle] = React.useState(initial?.config?.interviewerStyle || '')
  const [coding, setCoding] = React.useState(typeof initial?.config?.coding === 'boolean' ? String(initial.config.coding) : '')
  const [difficulty, setDifficulty] = React.useState(initial?.config?.difficulty || '')
  const [language, setLanguage] = React.useState(initial?.config?.language || '')
  const topicMode = mode === 'bagu' || mode === 'scenario'
  const valid = topicMode
    ? Boolean(topic.trim())
    : mode === 'leetcode'
      ? Boolean(language)
      : mode === 'mock' && Boolean(
        resume.trim() && targetRole.trim() && jobDescriptionProvided !== ''
        && (jobDescriptionProvided !== 'true' || jobDescription.trim())
        && interviewerStyle.trim() && coding !== '' && difficulty,
      )
  const submit = () => {
    if (step !== 'config' || !valid || disabled) return
    onSubmit(mode === 'mock'
      ? {
          mode,
          config: {
            resume: resume.trim(),
            targetRole: targetRole.trim(),
            jobDescriptionProvided: jobDescriptionProvided === 'true',
            jobDescription: jobDescriptionProvided === 'true' ? jobDescription.trim() : '',
            interviewerStyle: interviewerStyle.trim(),
            coding: coding === 'true',
            difficulty,
          },
        }
      : mode === 'leetcode' ? { mode, config: { language } } : { mode, config: { topic: topic.trim() } })
  }
  const chooseMode = (value) => {
    if (disabled) return
    setMode(value)
    setStep('config')
  }

  return h('div', { className: 'di-practice-form' },
    h('ol', { className: 'di-config-progress', 'aria-label': '新建练习进度' },
      h('li', { className: step === 'mode' ? 'is-current' : 'is-complete' }, h('span', null, '1'), '选择模式'),
      h('li', { className: step === 'config' ? 'is-current' : '' }, h('span', null, '2'), '填写配置')),
    step === 'mode'
      ? h('section', { className: 'di-config-stage di-field-wide', 'aria-label': '选择练习模式' },
          h('div', { className: 'di-mode-options' }, PRACTICE_MODE_OPTIONS.map((option) => h('button', {
            type: 'button',
            className: `di-mode-option is-${option.value}`,
            disabled,
            key: option.value,
            onClick: () => chooseMode(option.value),
          }, option.label))))
      : h('section', { className: 'di-config-stage di-config-fields di-field-wide', 'aria-label': `${modeLabel(mode)}配置` },
          h('div', { className: 'di-config-mode' }, h('span', null, '练习模式'), h('span', { className: `di-mode-badge is-${mode}` }, modeLabel(mode))),
          topicMode ? h('label', { className: 'di-field' }, h('span', null, '主题'),
            h('input', { className: 'di-input', disabled, value: topic, onChange: (event) => setTopic(event.target.value) })) : null,
          mode === 'leetcode' ? h('label', { className: 'di-field' }, h('span', null, '编程语言'),
            h(Select, { value: language, options: LEETCODE_LANGUAGES.map((item) => ({ value: item.id, label: item.label })), disabled, onChange: setLanguage, 'aria-label': '选择编程语言' })) : null,
          mode === 'mock' ? h(React.Fragment, null,
            h('label', { className: 'di-field di-field-wide' }, h('span', null, '简历'),
              h('textarea', { className: 'di-input di-textarea', disabled, value: resume, onChange: (event) => setResume(event.target.value) })),
            h('label', { className: 'di-field' }, h('span', null, '目标岗位'),
              h('input', { className: 'di-input', disabled, value: targetRole, onChange: (event) => setTargetRole(event.target.value) })),
            h('label', { className: 'di-field' }, h('span', null, '岗位描述'),
              h(Select, { value: jobDescriptionProvided, options: JD_OPTIONS, disabled, onChange: setJobDescriptionProvided, 'aria-label': '选择是否提供岗位描述' })),
            jobDescriptionProvided === 'true' ? h('label', { className: 'di-field di-field-wide' }, h('span', null, 'JD'),
              h('textarea', { className: 'di-input di-textarea', disabled, value: jobDescription, onChange: (event) => setJobDescription(event.target.value) })) : null,
            h('label', { className: 'di-field' }, h('span', null, '面试官风格'),
              h('input', { className: 'di-input', disabled, value: interviewerStyle, onChange: (event) => setInterviewerStyle(event.target.value) })),
            h('label', { className: 'di-field' }, h('span', null, '是否手撕代码'),
              h(Select, { value: coding, options: CODING_OPTIONS, disabled, onChange: setCoding, 'aria-label': '选择是否手撕代码' })),
            h('label', { className: 'di-field' }, h('span', null, '面试难度'),
              h(Select, { value: difficulty, options: DIFFICULTY_OPTIONS, disabled, onChange: setDifficulty, 'aria-label': '选择面试难度' }))) : null),
    h('div', { className: 'di-actions di-field-wide' },
      onCancel ? h(Button, { disabled, onClick: onCancel }, '取消') : null,
      step === 'config' ? h(Button, { disabled, onClick: () => setStep('mode') }, '上一步') : null,
      step === 'config' ? h(Button, { tone: 'primary', disabled: disabled || !valid, busy, onClick: submit }, submitLabel || (initial ? '保存配置' : '开始练习')) : null))
}

export function PracticeSetupCard({ sessionId }) {
  const command = useCommand(sessionId)
  const lifecycle = useCardLifecycle(false)
  const [completedConfig, setCompletedConfig] = React.useState(null)
  const start = (payload) => lifecycle.enter('session.start', () => {
    setCompletedConfig(payload)
    return command.run('session.start', payload)
  })

  if (lifecycle.consumedBy) {
    return h('article', { className: 'di-card di-setup-card is-complete', 'aria-label': '练习配置已就绪' },
      h('div', { className: 'di-setup-complete', role: 'status', 'aria-live': 'polite' },
        h('span', { className: 'di-setup-complete-icon', 'aria-hidden': 'true' }, h(Icon, { name: 'check', size: 18 })),
        h('div', { className: 'di-setup-complete-copy' },
          h('div', { className: 'di-title' }, '练习配置已就绪'),
          h('div', { className: 'di-meta' }, completedConfigText(completedConfig)))),
      h(ErrorNotice, null, command.error))
  }

  return h('article', { className: 'di-card di-setup-card', 'aria-label': '新建练习配置' },
    h('header', { className: 'di-card-head' }, h('div', { className: 'di-title' }, '新建练习')),
    h(PracticeConfigForm, {
      busy: command.busy === 'session.start',
      disabled: lifecycle.locked,
      onSubmit: start,
      submitLabel: '开始练习',
    }),
    h(ErrorNotice, null, command.error))
}
