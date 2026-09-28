import React from 'react'
import { interviewApi } from '../shared/api.js'
import { useCommand, useInterviewQuery } from '../shared/hooks.js'
import { SolutionDisclosure } from '../shared/solution-disclosure.js'
import { Button, ErrorNotice, h, Loading, Markdown } from '../shared/ui.js'

export function QuestionSolutionPanel({ sessionId, practiceId, question, canGenerate = true }) {
  const [opened, setOpened] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [pollCount, setPollCount] = React.useState(0)
  const [notice, setNotice] = React.useState('')
  const command = useCommand(sessionId)
  // 正确答案只在用户展开后读取；题目、引导和写代码均不会触发此请求。
  const query = useInterviewQuery(`solution:${practiceId}:${question.id}:${opened}`, () => opened ? interviewApi.questionSolution(practiceId, question.id) : Promise.resolve(null), [practiceId, question.id, opened], { cache: false })
  const solution = query.data?.resource?.data || (question.explanation ? { available: true, allowed: true, source: 'AI 讲解', ...question.explanation } : null)
  const generating = solution?.status === 'generating' || pending
  const reloadRef = React.useRef(query.reload)
  reloadRef.current = query.reload

  React.useEffect(() => {
    if (pending && solution?.status !== 'generating' && (solution?.available || solution?.status === 'failed')) { setPending(false); setNotice('') }
  }, [pending, solution?.available, solution?.status])
  React.useEffect(() => {
    if (!opened || !generating || pollCount >= 90) return undefined
    const timer = setTimeout(() => { void reloadRef.current(); setPollCount((value) => value + 1) }, 2000)
    return () => clearTimeout(timer)
  }, [opened, generating, pollCount])
  const generate = async (force = false) => {
    try {
      const result = await command.run('question.solution-generate', { practiceId, questionId: question.id, force })
      if (result.analysisQueued) { setPending(true); setPollCount(0); setNotice('') }
      else if (result.cacheHit) { setPending(false); setNotice('直接读取已保存答案，本次未请求 AI。') }
      else setNotice(result.resource?.data?.error || '答案生成请求暂未启动，请确认当前对话可用后重试。')
      await reloadRef.current()
    } catch { /* 错误由 useCommand 展示。 */ }
  }
  return h(SolutionDisclosure, { onToggle: setOpened },
    !solution && query.loading ? h(Loading, { label: '正在读取参考答案…' }) : null,
    solution?.available ? h(React.Fragment, null,
      h('div', { className: 'di-meta di-solution-source' }, solution.source),
      h(Markdown, null, solution.detail),
      solution.memorizationPoints ? h('section', { className: 'di-attempt' }, h('div', { className: 'di-section-label' }, question.leetcode ? '解题要点' : '参考要点'), h(Markdown, null, solution.memorizationPoints)) : null,
      solution.reused ? h('p', { className: 'di-meta', role: 'status' }, '这份讲解直接从题库读取，未请求 AI。') : null,
      solution.canGenerate && canGenerate ? h(Button, { disabled: !sessionId || generating || Boolean(command.busy),
        title: '重新请求 AI，生成适用于以后练习的通用讲解并更新题库缓存', onClick: () => generate(true) },
        solution.source.startsWith('本地题解库') ? '生成 AI 详解并保存' : '重新生成 AI 讲解') : null)
      : solution ? h('div', { className: 'di-solution-missing' },
        h('p', null, solution.reason || '这道题还没有保存参考答案。'),
        !generating && solution.allowed !== false ? h(Button, { tone: 'primary', disabled: !sessionId || !canGenerate, busy: Boolean(command.busy), onClick: () => generate(false) }, '生成参考答案并保存') : null,
        !canGenerate && solution.allowed !== false ? h('div', { className: 'di-meta' }, '请先重新打开练习，再生成答案。') : null) : null,
    generating ? h('p', { className: 'di-meta', role: 'status' }, pollCount >= 90 ? '答案仍在生成，请检查对话中的状态后重试。' : 'AI 正在生成通用讲解，完成后会保存到题库供以后复用。') : null,
    h(ErrorNotice, null, notice || solution?.error || command.error || query.error))
}
