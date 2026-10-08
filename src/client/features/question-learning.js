import React from 'react'
import { interviewApi } from '../shared/api.js'
import { useCommand, useInterviewQuery } from '../shared/hooks.js'
import { Button, ErrorNotice, h, Loading, Markdown } from '../shared/ui.js'

export function QuestionLearningPanel({ sessionId, practiceId, question }) {
  const query = useInterviewQuery(`learning:${sessionId}:${practiceId}:${question.id}`, () => interviewApi.questionLearning(practiceId, question.id, sessionId), [sessionId, practiceId, question.id], { cache: false })
  const command = useCommand(sessionId)
  const [bodyOpen, setBodyOpen] = React.useState(true)
  const [guideOpen, setGuideOpen] = React.useState(true)
  const [pollCount, setPollCount] = React.useState(0)
  const autoRequested = React.useRef('')
  const reloadRef = React.useRef(query.reload)
  reloadRef.current = query.reload
  const context = query.data?.resource?.data
  const guide = context?.guidance
  const generating = guide?.status === 'generating'
  const generate = async (force = false, automatic = false) => {
    try {
      await command.run('question.guidance-generate', { practiceId, questionId: question.id, force, automatic })
      setPollCount(0)
      await reloadRef.current()
    } catch { /* 原题、材料和代码草稿继续保留，用户可以重试。 */ }
  }
  React.useEffect(() => {
    const key = `${sessionId}:${practiceId}:${question.id}`
    if (!guideOpen || !guide?.canAutoGenerate || guide.ready || guide.status !== 'missing' || autoRequested.current === key) return
    autoRequested.current = key
    void generate(false, true)
  }, [sessionId, practiceId, question.id, guideOpen, guide?.canAutoGenerate, guide?.ready, guide?.status])
  React.useEffect(() => {
    if (!guideOpen || !generating || pollCount >= 90) return undefined
    const timer = setTimeout(() => { void reloadRef.current(); setPollCount((value) => value + 1) }, 2000)
    return () => clearTimeout(timer)
  }, [guideOpen, generating, guide?.requestId, pollCount])
  const reveal = async () => {
    try {
      await command.run('question.learning-hint', { practiceId, questionId: question.id })
      await query.reload()
    } catch { /* 保留代码草稿与当前提示。 */ }
  }
  if (query.loading && !context) return h('section', { className: 'di-learning-panel' }, h(Loading, { label: '正在载入完整题目…' }))
  if (!context) return h(ErrorNotice, null, query.error || '完整题目暂未载入，请稍后重试')
  const { problem, guidance } = context
  const stages = guidance.stages?.length ? guidance.stages.map(stage => stage.label)
    : ['拆解题目与基础知识', '理清思路', '写伪代码', '写真实代码']
  const knowledgeBlock = guidance.knowledge.length ? h('div', { className: 'di-guided-knowledge' }, h('h5', null, '本题需要的基础知识'),
    guidance.knowledge.map((knowledge) => h('div', { key: knowledge.title }, h('div', { className: 'di-lc-knowledge-title' }, knowledge.title), h(Markdown, null, knowledge.detail)))) : null
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
        h('h4', null, guidance.enabled ? 'AI 引导：像在考场上解题' : 'AI 解题提示'),
        h(Button, { 'aria-expanded': guideOpen, onClick: () => setGuideOpen((value) => !value) }, guideOpen ? '收起引导' : '展开引导')),
      guideOpen ? h(React.Fragment, null,
        h('div', { className: 'di-meta', role: 'status' }, guidance.ready
          ? guidance.reused ? '复用题库中的 AI 引导 · 本次未请求 AI · 提示逐级解锁'
            : guidance.cached ? 'AI 引导已存入题库 · 再次练习直接复用' : 'AI 针对本题生成 · 提示逐级解锁'
          : '首次生成后存入题库，重做直接复用；完整答案保持遮蔽'),
        generating ? h(Loading, { label: pollCount >= 90 ? 'AI 尚未完成，请查看对话中的状态后重试。' : 'AI 正在阅读题面并推导逐级引导…' }) : null,
        guidance.enabled ? h('div', { className: 'di-guided-intro' },
          h('div', { className: 'di-guided-stages' }, stages.map((label, index) => h('span', { key: label, className: index === Math.max(0, Math.min(guidance.hintLevel - 1, 3)) ? 'is-current' : '' }, `${index + 1}. ${label}`))),
          h('p', null, guidance.introduction)) : null,
        !guidance.enabled ? knowledgeBlock : null,
        guidance.revealedHints.map((hint, index) => h('details', { className: 'di-guided-hint', key: index, open: true },
          h('summary', null, guidance.enabled ? `${index + 1}. ${stages[index]}` : `第 ${index + 1} 级提示`),
          h(Markdown, null, hint), guidance.enabled && index === 0 ? knowledgeBlock : null)),
        !guidance.ready && !generating ? h('p', { className: 'di-meta' }, guidance.canAutoGenerate
          ? '题库中还没有当前语言和模式的引导，首次生成后会保存供以后复用。'
          : guidance.canGenerate ? '点击生成，让 AI 根据这道题的示例、约束和练习语言编写引导。' : '这道题尚未生成 AI 引导，请先重新打开练习。') : null,
        h('div', { className: 'di-guided-actions' },
          guidance.ready ? h(React.Fragment, null,
            h('span', { className: 'di-meta', role: 'status' }, guidance.enabled
              ? guidance.hintLevel < guidance.hintTotal ? `已进入 ${guidance.hintLevel}/4 · 下一步：${stages[guidance.hintLevel]}${guidance.hintLevel === 3 ? '（包含带注释的完整实现）' : ''}` : '四步已完成 · 可以收起各步，再独立写一遍代码'
              : `已解锁 ${guidance.hintLevel}/${guidance.hintTotal}，不会自动展示后续提示或答案`),
            h(Button, { tone: 'primary', disabled: !sessionId || !guidance.canReveal || generating || Boolean(command.busy), busy: command.busy === 'question.learning-hint', onClick: reveal },
              guidance.hintLevel >= guidance.hintTotal ? '引导已全部解锁' : guidance.enabled ? '解锁下一步引导' : '给我一个提示')) : null,
          guidance.canGenerate ? h(Button, { tone: guidance.ready ? 'default' : 'primary', disabled: !sessionId || generating || Boolean(command.busy), busy: command.busy === 'question.guidance-generate',
            title: guidance.ready ? '会重新请求 AI 并更新题库缓存，从第 1 级重新解锁；代码草稿保留' : undefined,
            onClick: () => generate(guidance.ready) }, guidance.ready ? '重新生成 AI 引导' : '生成 AI 引导') : null),
        h(ErrorNotice, null, command.error || guidance.error)) : null) : null,
    h(ErrorNotice, null, query.error))
}
