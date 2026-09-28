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
  const reloadRef = React.useRef(query.reload)
  reloadRef.current = query.reload

  React.useEffect(() => {
    if (pending && solution?.available) { setPending(false); setNotice('') }
  }, [pending, solution?.available])
  React.useEffect(() => {
    if (!opened || !pending || pollCount >= 20) return undefined
    const timer = setTimeout(() => { void reloadRef.current(); setPollCount((value) => value + 1) }, 2000)
    return () => clearTimeout(timer)
  }, [opened, pending, pollCount])
  const generate = async () => {
    try {
      const result = await command.run('question.solution-generate', { practiceId, questionId: question.id })
      if (result.analysisQueued) { setPending(true); setPollCount(0); setNotice('') }
      else setNotice('答案生成请求暂未启动，请确认当前对话可用后重试。')
    } catch { /* 错误由 useCommand 展示。 */ }
  }
  return h(SolutionDisclosure, { onToggle: setOpened },
    !solution && query.loading ? h(Loading, { label: '正在读取参考答案…' }) : null,
    solution?.available ? h(React.Fragment, null,
      h('div', { className: 'di-meta di-solution-source' }, solution.source),
      h(Markdown, null, solution.detail),
      solution.memorizationPoints ? h('section', { className: 'di-attempt' }, h('div', { className: 'di-section-label' }, question.leetcode ? '解题要点' : '参考要点'), h(Markdown, null, solution.memorizationPoints)) : null)
      : solution ? h('div', { className: 'di-solution-missing' },
        h('p', null, solution.reason || '这道题还没有保存参考答案。'),
        pending ? h('p', { className: 'di-meta', role: 'status' }, pollCount >= 20 ? '答案仍在生成，可稍后重新展开查看。' : 'AI 正在生成答案，完成后会显示在这里。')
          : solution.allowed !== false ? h(Button, { tone: 'primary', disabled: !sessionId || !canGenerate, busy: Boolean(command.busy), onClick: generate }, '生成参考答案') : null,
        !canGenerate && solution.allowed !== false ? h('div', { className: 'di-meta' }, '请先重新打开练习，再生成答案。') : null) : null,
    h(ErrorNotice, null, notice || command.error || query.error))
}
