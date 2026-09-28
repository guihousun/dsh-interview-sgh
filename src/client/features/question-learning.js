import React from 'react'
import { interviewApi } from '../shared/api.js'
import { useCommand, useInterviewQuery } from '../shared/hooks.js'
import { Button, ErrorNotice, h, Loading, Markdown } from '../shared/ui.js'

export function QuestionLearningPanel({ sessionId, practiceId, question }) {
  const query = useInterviewQuery(`learning:${practiceId}:${question.id}`, () => interviewApi.questionLearning(practiceId, question.id), [practiceId, question.id], { cache: false })
  const command = useCommand(sessionId)
  const [bodyOpen, setBodyOpen] = React.useState(true)
  const [guideOpen, setGuideOpen] = React.useState(true)
  const context = query.data?.resource?.data
  const reveal = async () => {
    try {
      await command.run('question.learning-hint', { practiceId, questionId: question.id })
      await query.reload()
    } catch { /* 保留代码草稿与当前提示。 */ }
  }
  if (query.loading && !context) return h('section', { className: 'di-learning-panel' }, h(Loading, { label: '正在载入完整题目…' }))
  if (!context) return h(ErrorNotice, null, query.error || '完整题目暂未载入，请稍后重试')
  const { problem, guidance } = context
  return h('section', { className: 'di-learning-panel', 'aria-label': '题目与引导' },
    h('div', { className: 'di-learning-heading' },
      h('h4', null, '完整题目'),
      h(Button, { 'aria-expanded': bodyOpen, onClick: () => setBodyOpen((value) => !value) }, bodyOpen ? '收起题目' : '展开完整题目')),
    bodyOpen ? h('div', { className: 'di-problem-body' },
      problem.statement ? h('section', { 'aria-label': '题意' }, h(Markdown, null, problem.statement))
        : h('div', { className: 'di-notice' }, '本题尚未保存完整题面，可先查看官方题目。'),
      problem.examples.length ? h('section', { 'aria-label': '题目示例' },
        h('h5', null, '示例'),
        problem.examples.map((example, index) => h('div', { className: 'di-lc-example', key: index },
          h('div', { className: 'di-learning-example-title' }, `示例 ${index + 1}`),
          h('div', null, h('span', null, '输入'), h('code', null, example.input)),
          h('div', null, h('span', null, '输出'), h('code', null, example.output)),
          example.note ? h('div', null, h('span', null, '说明'), h('span', null, example.note)) : null))) : null,
      problem.constraints.length ? h('section', { 'aria-label': '题目约束' },
        h('h5', null, '约束条件'),
        h('ul', { className: 'di-learning-constraints' }, problem.constraints.map((constraint, index) => h('li', { key: index }, h('code', null, constraint))))) : null,
      problem.advanced ? h('section', null, h('h5', null, '进阶'), h(Markdown, null, problem.advanced)) : null,
      problem.source || problem.url ? h('div', { className: 'di-meta di-learning-source' },
        problem.source,
        problem.url ? h('a', { className: 'di-link', href: problem.url, target: '_blank', rel: 'noreferrer' }, '查看官方题目 ↗') : null) : null) : null,
    guidance.enabled || guidance.hintTotal ? h('section', { className: 'di-guided-panel', 'aria-label': guidance.enabled ? '引导模式' : '解题提示' },
      h('div', { className: 'di-learning-heading' },
        h('h4', null, guidance.enabled ? '引导模式：一步一步来' : '解题提示'),
        h(Button, { 'aria-expanded': guideOpen, onClick: () => setGuideOpen((value) => !value) }, guideOpen ? '收起引导' : '展开引导')),
      guideOpen ? h(React.Fragment, null,
        guidance.enabled ? h('div', { className: 'di-guided-intro' },
          h('div', { className: 'di-guided-stages' }, ['读懂题意', '手推示例', '推导思路', '自己编码'].map((label, index) => h('span', { key: label, className: index === Math.min(guidance.hintLevel, 3) ? 'is-current' : '' }, `${index + 1}. ${label}`))),
          h('p', null, guidance.introduction)) : null,
        guidance.knowledge.length ? h('div', { className: 'di-guided-knowledge' }, h('h5', null, '先补前置知识'),
          guidance.knowledge.map((knowledge) => h('div', { key: knowledge.title }, h('div', { className: 'di-lc-knowledge-title' }, knowledge.title), h(Markdown, null, knowledge.detail)))) : null,
        guidance.revealedHints.map((hint, index) => h('div', { className: 'di-guided-hint', key: index }, h('h5', null, `第 ${index + 1} 级引导`), h(Markdown, null, hint))),
        h('div', { className: 'di-guided-actions' },
          h('span', { className: 'di-meta', role: 'status' }, `已解锁 ${guidance.hintLevel}/${guidance.hintTotal}，不会自动展示后续提示或答案`),
          h(Button, { tone: 'primary', disabled: !sessionId || !guidance.canReveal, busy: command.busy === 'question.learning-hint', onClick: reveal },
            guidance.hintLevel >= guidance.hintTotal ? '引导已全部解锁' : guidance.enabled ? '解锁下一步引导' : '给我一个提示')),
        h(ErrorNotice, null, command.error)) : null) : null,
    h(ErrorNotice, null, query.error))
}
