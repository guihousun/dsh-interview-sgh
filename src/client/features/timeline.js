import React from 'react'
import { interviewApi } from '../shared/api.js'
import { useCommand, useInterviewQuery } from '../shared/hooks.js'
import { Button, ErrorNotice, h, Icon, Markdown } from '../shared/ui.js'
import { QuestionLearningPanel } from './question-learning.js'
import { QuestionSolutionPanel } from './question-solution.js'
import { DifficultyBadge } from '../shared/difficulty-tags.js'
import { CodeAnswerEditor } from './code-answer.js'

function timelineArtifact(practiceId, questionId, revision) {
  return { practiceId, questionId, sessionRevision: revision, presentationId: `timeline-code:${revision}:${Date.now()}` }
}

export function TimelineAnswerEntry({ sessionId, session, practice, question }) {
  const command = useCommand(sessionId)
  const [artifact, setArtifact] = React.useState(() => practice.status === 'active' && session?.practice?.id === practice.id && session.currentQuestionId === question.id
    ? timelineArtifact(practice.id, question.id, session.revision) : null)
  const openCode = async () => {
    try {
      const result = await command.run('question.code-open', { practiceId: practice.id, questionId: question.id })
      const session = result.resource?.data
      if (session?.practice?.id !== practice.id || session.currentQuestionId !== question.id) return
      setArtifact(timelineArtifact(practice.id, question.id, session.revision))
    } catch { /* 保留历史记录，错误由 useCommand 展示。 */ }
  }
  return h('section', { className: 'di-time-answer-entry', 'aria-label': '本题作答' },
    practice.status === 'active' ? h(React.Fragment, null,
      !artifact || question.attempts.length ? h(Button, { tone: 'primary', disabled: !sessionId || Boolean(command.busy), busy: command.busy === 'question.code-open', onClick: openCode },
        h(Icon, { name: 'code' }), artifact ? '重新写代码' : question.attempts.length ? '再次作答' : '写代码作答') : null,
      !artifact || practice.mode !== 'leetcode' ? h('p', { className: 'di-meta' }, '在这里写代码并提交 AI 分析；文字回答也可直接发送到对话。') : null)
      : h('p', { className: 'di-meta' }, '练习已结束，重新打开后可以继续作答。'),
    artifact && practice.status === 'active' ? h(CodeAnswerEditor, {
      key: artifact.presentationId, sessionId, question, artifact,
      language: practice.mode === 'leetcode' ? practice.config.language : '',
    }) : null,
    h(ErrorNotice, null, command.error))
}

export function TimelineContent({ question, sessionId, session, practice }) {
  const prompt = (question.leetcode || question.hot100)
    ? h('div', { className: 'di-time-lc-question' },
        h('a', { className: 'di-link', href: (question.leetcode || question.hot100).url, target: '_blank', rel: 'noreferrer' }, question.prompt, ' ↗'),
        h('div', { className: 'di-meta di-problem-tags' }, (question.leetcode || question.hot100).category, h(DifficultyBadge, { difficulty: (question.leetcode || question.hot100).difficulty })),
        h(QuestionLearningPanel, { key: `learning:${question.id}`, sessionId, practiceId: practice.id, question }))
    : h(Markdown, null, question.prompt)

  return h('div', { className: 'di-time-unified' },
    h('section', { 'aria-label': '题目' }, prompt),
    h('section', { 'aria-label': '作答与记录' },
      h('h4', null, '作答'),
      h(TimelineAnswerEntry, { key: question.id, sessionId, session, practice, question }),
      !question.attempts.length ? null : h('div', { className: 'di-time-records' }, question.attempts.map((attempt) =>
      h('section', { className: 'di-time-record', key: attempt.id },
        h('div', { className: 'di-time-record-label' },
          h('span', null, `第 ${attempt.sequence} 次回答`),
          h('span', null, attempt.evaluation ? `${attempt.evaluation.score}/10` : '待点评')),
        h('div', { className: 'di-time-record-answer' },
          h('div', { className: 'di-time-content-label' }, '回答'),
          h(Markdown, null, attempt.answer)),
        attempt.evaluation ? h('div', { className: 'di-time-record-review' },
          h('div', { className: 'di-time-content-label' }, '点评'),
          h(Markdown, null, attempt.evaluation.feedback)) : null)))),
    question.capabilities?.allowReveal !== false ? h(QuestionSolutionPanel, { key: `solution:${question.id}`, sessionId, practiceId: practice.id, question, canGenerate: practice.status === 'active' }) : null)
}

export function TimelinePanel({ sessionId, revisionSignal }) {
  const [selection, setSelection] = React.useState(null)
  const sessionQuery = useInterviewQuery(`timeline-session:${sessionId}:${revisionSignal}`, () => interviewApi.session(sessionId), [sessionId, revisionSignal], { cache: false })
  const session = sessionQuery.data?.resource?.data
  const practiceId = session?.practice?.id || null
  const detailQuery = useInterviewQuery(`timeline-practice:${practiceId || 'none'}:${revisionSignal}`, () => practiceId ? interviewApi.practice(practiceId) : Promise.resolve(null), [practiceId, revisionSignal], { cache: false })
  const practice = detailQuery.data?.resource?.data
  if (!session?.selected || !practice?.questions?.length) return null

  const selectedQuestion = practice.questions.find((question) => question.id === selection?.questionId)

  return h('nav', {
    className: 'di-timeline',
    'aria-label': '题目时间轴',
    onKeyDown: (event) => {
      if (event.key === 'Escape') setSelection(null)
    },
  },
  h('div', { className: 'di-time-list' }, practice.questions.map((question) => {
    const active = selection?.questionId === question.id
    return h('div', {
      className: `di-time-item${session.currentQuestionId === question.id ? ' is-current' : ''}${active ? ' has-view' : ''}`,
      key: question.id,
    }, h('button', {
      className: 'di-time-node',
      type: 'button',
      'aria-label': `第 ${question.sequence} 题：${question.prompt}`,
      onClick: () => setSelection({ questionId: question.id }),
    },
    h('span', { className: 'di-time-dot', 'aria-hidden': 'true' }),
    h('span', null, `Q${String(question.sequence).padStart(2, '0')}`)))
  })),
  selectedQuestion ? h('section', { className: 'di-time-flyout', 'aria-label': '题目、作答与答案' },
      h('header', { className: 'di-time-flyout-head' },
        h('h3', { className: 'di-time-title' }, `Q${String(selectedQuestion.sequence).padStart(2, '0')} · ${selectedQuestion.prompt}`),
        h('button', { type: 'button', onClick: () => setSelection(null), 'aria-label': '关闭' }, '×')),
      h('div', { className: 'di-time-flyout-body' }, h(TimelineContent, { question: selectedQuestion, sessionId, session, practice }))) : null)
}
