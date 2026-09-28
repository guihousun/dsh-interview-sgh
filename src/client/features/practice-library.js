import React from 'react'
import { interviewApi } from '../shared/api.js'
import { useCommand, useInterviewQuery } from '../shared/hooks.js'
import { Button, Empty, ErrorNotice, h, Icon, Loading, Markdown, ScoreRail, Select } from '../shared/ui.js'
import { leetcodeLanguageLabel } from '../../domain/leetcode-languages.js'
import { leetcodeGuidanceLabel } from '../../domain/leetcode-guidance.js'
import { PRACTICE_MODE_OPTIONS, PracticeConfigForm } from './practice-config.js'
import { CodeAnswerEditor } from './code-answer.js'
import { QuestionLearningPanel } from './question-learning.js'
import { QuestionSolutionPanel } from './question-solution.js'
import { PracticeDocumentSources } from './practice-documents.js'
import { DifficultyBadge } from '../shared/difficulty-tags.js'
import { LeetcodeTrainingControls } from './leetcode-training.js'

function PracticeDetail({ practice, sessionId, onDeleted, onAdvanced, initialCodeContext = null }) {
  const command = useCommand(sessionId)
  const [confirming, setConfirming] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [editingQuestionId, setEditingQuestionId] = React.useState(null)
  const [questionDraft, setQuestionDraft] = React.useState('')
  const [deletingQuestionId, setDeletingQuestionId] = React.useState(null)
  const [downloads, setDownloads] = React.useState([])
  const [codeContext, setCodeContext] = React.useState(initialCodeContext)
  const [advancingMode, setAdvancingMode] = React.useState('')
  const detailRef = React.useRef(null)
  React.useEffect(() => {
    if (initialCodeContext?.practiceId === practice?.id) {
      setCodeContext(initialCodeContext)
      detailRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [initialCodeContext, practice?.id])
  if (!practice) return h(Empty, { title: '选择一条练习', detail: '右侧会展示题目、历次作答和讲解。' })
  const run = (name, payload) => command.run(name, payload).catch(() => null)
  const activate = async () => {
    const result = await run(practice.status === 'completed' ? 'session.reopen' : 'session.select', { practiceId: practice.id })
    if (result) interviewApi.navigateWorkspace('active')
  }
  const exportOne = async () => {
    const result = await run('library.export', { practiceIds: [practice.id] })
    if (result) setDownloads(result.resource.data || [])
  }
  const remove = async () => {
    const result = await run('library.delete', { practiceId: practice.id })
    if (result) onDeleted()
  }
  const updateConfiguration = async (payload) => {
    const result = await run('practice.update', { practiceId: practice.id, ...payload })
    if (result) setEditing(false)
  }
  const updateQuestion = async (questionId) => {
    const result = await run('question.update', { practiceId: practice.id, questionId, prompt: questionDraft })
    if (result) { setEditingQuestionId(null); setQuestionDraft('') }
  }
  const deleteQuestion = async (questionId) => {
    const result = await run('question.delete', { practiceId: practice.id, questionId })
    if (result) setDeletingQuestionId(null)
  }
  const retry = async (questionId) => {
    if (practice.status !== 'active') return
    await run('question.focus', { practiceId: practice.id, questionId })
  }
  const openCode = async (questionId) => {
    const result = await run('question.code-open', { practiceId: practice.id, questionId })
    const session = result?.resource?.data
    if (!session) return
    setCodeContext({
      practiceId: practice.id, questionId,
      presentationId: `workspace-code:${session.revision}:${Date.now()}`,
      sessionRevision: session.revision,
    })
  }
  const nextLeetcode = async (options) => {
    setAdvancingMode(options.selectionMode)
    try {
      const result = await run('leetcode.practice-next', { practiceId: practice.id, ...options })
      const next = result?.resource?.data
      if (!next?.practice || !next.currentQuestionId) return
      onAdvanced(next)
    } finally { setAdvancingMode('') }
  }
  return h('section', { className: 'di-detail', ref: detailRef },
    h('div', { className: 'di-detail-heading' },
      h('h3', { className: 'di-ledger-title' }, practice.topic),
      h('span', { className: 'di-meta' }, practice.mode === 'leetcode'
        ? `${practice.modeLabel} · ${leetcodeLanguageLabel(practice.config.language)} · ${leetcodeGuidanceLabel(practice.config.guidance)}`
        : `${practice.modeLabel} · ${practice.questionCount} 题 · ${practice.evaluatedCount} 次已评价 · 均分 ${practice.averageScore ?? '—'}`)),
    h('div', { className: 'di-actions' },
      h(Button, { tone: 'primary', busy: Boolean(command.busy?.startsWith('session.')), onClick: activate }, practice.status === 'completed' ? '重新打开' : '切换到练习'),
      h(Button, { onClick: () => setEditing((value) => !value) }, '编辑配置'),
      h(Button, { busy: command.busy === 'library.export', onClick: exportOne }, '导出 Markdown'),
      h(Button, { tone: 'danger', onClick: () => setConfirming(true) }, '删除')),
    downloads.length ? h('div', { className: 'di-notice' }, downloads.map((file) =>
      h('a', { className: 'di-link', href: interviewApi.downloadUrl(file.token), key: file.token }, `下载 ${file.name}`))) : null,
    confirming ? h('div', { className: 'di-modal-backdrop' },
      h('div', { className: 'di-confirm-modal', role: 'alertdialog', 'aria-label': '确认删除练习' },
        h('div', { className: 'di-confirm-copy' },
          h('span', { className: 'di-confirm-icon', 'aria-hidden': 'true' }, h(Icon, { name: 'alert', size: 17 })),
          h('div', null, h('h4', null, '确认删除该练习？'), h('p', null, '确认删除该练习及全部作答记录吗？此操作无法撤销。'))),
        h('div', { className: 'di-actions' },
          h(Button, { onClick: () => setConfirming(false) }, '取消'),
          h(Button, { tone: 'danger', busy: command.busy === 'library.delete', onClick: remove }, '确认删除')))) : null,
    editing ? h(PracticeConfigForm, { key: practice.id, initial: practice, busy: command.busy === 'practice.update', onSubmit: updateConfiguration, onCancel: () => setEditing(false) }) : null,
    !editing ? h(PracticeDocumentSources, { config: practice.config }) : null,
    h(ErrorNotice, null, command.error),
    practice.mode === 'leetcode' && practice.status === 'active' ? h(LeetcodeTrainingControls, {
      key: `${practice.id}:${practice.config.category || ''}:${(practice.config.difficulties || []).join(',')}`,
      practice, sessionId, busy: advancingMode, onNext: nextLeetcode,
    }) : null,
    practice.summary?.kind === 'leetcode' ? h('section', { className: 'di-section' },
      h('div', { className: 'di-section-label' }, '刷题汇总'),
      h('div', { className: 'di-meta' }, `本次共记录 ${practice.summary.questionCount} 道题，详细题目见下方。`))
      : practice.summary ? h('section', { className: 'di-section' },
      h('div', { className: 'di-section-label' }, '练习总结'),
      h(Markdown, null, practice.summary.overall),
      h('div', { className: 'di-attempt' },
        h('div', null, '表现亮点'),
        h('ul', null, practice.summary.strengths.map((item) => h('li', { key: item }, item))),
        h('div', null, '改进建议'),
        h('ul', null, practice.summary.improvements.map((item) => h('li', { key: item }, item))))) : null,
    practice.questions.length ? practice.questions.map((question) => {
      const latest = question.attempts.at(-1)
      const fixedProblem = question.leetcode || question.hot100
      return h('article', { className: 'di-detail-question', key: question.id },
        h('div', { className: 'di-detail-question-head' },
          h('span', { className: 'di-sequence' }, `Q${String(question.sequence).padStart(2, '0')}`),
          h('div', { className: 'di-detail-question-text' }, editingQuestionId === question.id
            ? h('input', { className: 'di-input', value: questionDraft, onChange: (event) => setQuestionDraft(event.target.value) })
            : h(Markdown, null, question.prompt)),
          fixedProblem
            ? h('a', { className: 'di-link di-problem-tags', href: fixedProblem.url, target: '_blank', rel: 'noreferrer' }, fixedProblem.category, h(DifficultyBadge, { difficulty: fixedProblem.difficulty, custom: fixedProblem.custom }))
            : h(ScoreRail, { score: question.latestScore, compact: true })),
        fixedProblem ? h(QuestionLearningPanel, { key: `learning:${question.id}`, sessionId, practiceId: practice.id, question }) : null,
        question.attempts.map((attempt) => h('div', { className: 'di-attempt', key: attempt.id },
          h('div', { className: 'di-attempt-head' }, h('span', null, `第 ${attempt.sequence} 次作答`), h('span', null, attempt.evaluation ? `${attempt.evaluation.score}/10` : '未评价')),
          h(Markdown, null, attempt.answer),
          attempt.evaluation ? h('div', { className: 'di-section' }, h(Markdown, null, attempt.evaluation.feedback)) : null)),
        question.capabilities?.allowReveal !== false ? h(QuestionSolutionPanel, {
          key: `solution:${question.id}`, sessionId, practiceId: practice.id, question, canGenerate: practice.status === 'active',
        }) : null,
        codeContext?.practiceId === practice.id && codeContext.questionId === question.id
          ? h(CodeAnswerEditor, {
            key: codeContext.presentationId, sessionId, question, artifact: codeContext,
            language: practice.mode === 'leetcode' ? practice.config.language : '',
          }) : null,
        h('div', { className: 'di-detail-actions' },
          practice.status === 'active' ? h(Button, { disabled: !sessionId, title: sessionId ? undefined : '请先选择一个会话', busy: command.busy === 'question.code-open', onClick: () => openCode(question.id) },
            h(Icon, { name: 'code' }), codeContext?.questionId === question.id ? '继续写代码' : '写代码') : null,
          !fixedProblem && editingQuestionId === question.id
            ? h(React.Fragment, null,
                h(Button, { tone: 'primary', disabled: !questionDraft.trim(), busy: command.busy === 'question.update', onClick: () => updateQuestion(question.id) }, '保存题目'),
                h(Button, { onClick: () => { setEditingQuestionId(null); setQuestionDraft('') } }, '取消'))
            : !fixedProblem ? h(Button, { onClick: () => { setEditingQuestionId(question.id); setQuestionDraft(question.prompt) } }, '编辑题目') : null,
          !question.leetcode && practice.status === 'active' && latest?.evaluation
            ? h(Button, { onClick: () => retry(question.id) }, '重新作答')
            : null,
          h(Button, { tone: 'danger', onClick: () => setDeletingQuestionId(question.id) }, '删除题目')),
        deletingQuestionId === question.id ? h('div', { className: 'di-confirm' },
          h('div', null, '确认删除该题及其全部作答、评价和讲解？'),
          h('div', { className: 'di-actions' },
            h(Button, { onClick: () => setDeletingQuestionId(null) }, '取消'),
            h(Button, { tone: 'danger', busy: command.busy === 'question.delete', onClick: () => deleteQuestion(question.id) }, '确认删除'))) : null)
    }) : h(Empty, { title: '这条练习还没有题目' }))
}

export function PracticeLibrary({
  sessionId,
  initialPracticeId = null,
  statusScope = 'completed',
  title = '练习档案',
  allowCreate = false,
}) {
  const [queryText, setQueryText] = React.useState('')
  const [mode, setMode] = React.useState('')
  const [selectedId, setSelectedId] = React.useState(initialPracticeId)
  const [confirmingId, setConfirmingId] = React.useState(null)
  const [downloads, setDownloads] = React.useState([])
  const [creating, setCreating] = React.useState(false)
  const [advancedSession, setAdvancedSession] = React.useState(null)
  const command = useCommand(sessionId)
  const effectiveStatus = statusScope === 'active' ? 'active' : 'completed'
  const normalizedQuery = queryText.trim()
  const modeFilter = PRACTICE_MODE_OPTIONS.some((option) => option.value === mode) ? mode : undefined
  const filters = { query: normalizedQuery || undefined, mode: modeFilter, status: effectiveStatus }
  const list = useInterviewQuery(
    `practices:${normalizedQuery}:${modeFilter || 'all'}:${effectiveStatus}`,
    () => interviewApi.practices(filters),
    [normalizedQuery, modeFilter, effectiveStatus],
    { cache: false },
  )
  const practices = list.data?.resource?.data || []
  const advancedPractice = advancedSession?.session?.practice
  const advancePending = advancedPractice?.id === selectedId && advancedPractice.status === effectiveStatus && (!modeFilter || advancedPractice.mode === modeFilter)
  const visibleSelectedId = practices.some((practice) => practice.id === selectedId) || advancePending ? selectedId : null
  const detail = useInterviewQuery(
    `practice:${visibleSelectedId || 'none'}`,
    () => visibleSelectedId ? interviewApi.practice(visibleSelectedId) : Promise.resolve(null),
    [visibleSelectedId],
    { cache: false },
  )
  const savedDetail = detail.data?.resource?.data
  const selected = savedDetail?.id === visibleSelectedId ? savedDetail : advancePending ? advancedPractice : null
  const advanced = (session) => {
    setAdvancedSession({ session, codeContext: { practiceId: session.practice.id, questionId: session.currentQuestionId, sessionRevision: session.revision, presentationId: `workspace-code:${session.revision}:${Date.now()}` } })
    setSelectedId(session.practice.id)
  }
  const run = (name, payload) => command.run(name, payload).catch(() => null)
  const createPractice = async (payload) => {
    const result = await run('session.start', payload)
    if (!result) return
    setCreating(false)
    setSelectedId(result.resource?.data?.practice?.id || result.resource?.data?.id || null)
    interviewApi.navigateWorkspace('active')
  }
  const activate = async (practice) => {
    const result = await run(practice.status === 'completed' ? 'session.reopen' : 'session.select', { practiceId: practice.id })
    if (result) interviewApi.navigateWorkspace('active')
  }
  const exportOne = async (practice) => {
    const result = await run('library.export', { practiceIds: [practice.id] })
    if (result) setDownloads(result.resource.data || [])
  }
  const remove = async (practice) => {
    if (!practice) return
    const result = await run('library.delete', { practiceId: practice.id })
    if (!result) return
    if (selectedId === practice.id) setSelectedId(null)
    setConfirmingId(null)
    interviewApi.invalidate()
  }
  const dateText = (value) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).replaceAll('/', '-')
  }
  const scoreClass = (score) => Number(score) >= 8 ? 'is-good' : Number(score) >= 6 ? 'is-mid' : 'is-empty'
  const emptyState = effectiveStatus === 'active'
    ? { title: '没有进行中的练习', detail: '新建练习后会显示在这里。' }
    : { title: '练习档案为空', detail: '结束练习后会归档到这里。' }
  const rows = practices.map((practice) => h('tr', { key: practice.id, className: visibleSelectedId === practice.id ? 'is-selected' : '' },
    h('td', null, h('button', { className: 'di-history-topic', onClick: () => setSelectedId(visibleSelectedId === practice.id ? null : practice.id) }, practice.topic)),
    h('td', null, h('span', { className: `di-mode-badge is-${practice.mode}` }, practice.modeLabel)),
    h('td', { className: 'di-history-time' }, dateText(practice.updatedAt)),
    h('td', null, h('span', { className: `di-history-score ${scoreClass(practice.averageScore)}` }, practice.averageScore ?? '—')),
    h('td', null, h('div', { className: 'di-row-actions' },
      h(Button, {
        className: 'di-icon-button',
        title: practice.status === 'completed' ? '重新打开' : '切换到该练习',
        'aria-label': practice.status === 'completed' ? `重新打开${practice.topic}` : `切换到${practice.topic}`,
        onClick: () => activate(practice),
      }, h(Icon, { name: 'swap' })),
      h(Button, { className: 'di-icon-button is-delete', title: '删除', 'aria-label': `删除${practice.topic}`, onClick: () => setConfirmingId(practice.id) }, h(Icon, { name: 'trash' })),
      h(Button, { className: 'di-icon-button', title: '导出', 'aria-label': `导出${practice.topic}`, onClick: () => exportOne(practice) }, h(Icon, { name: 'download' }))))))

  return h('section', { className: 'di-ledger di-history', 'aria-label': title },
    h('header', { className: 'di-history-head' },
      h('h2', { className: 'di-ledger-title' }, title),
      allowCreate ? h(Button, { tone: 'primary', onClick: () => setCreating((value) => !value) }, h(Icon, { name: 'plus', size: 15 }), '新建练习') : null),
    allowCreate && creating ? h(PracticeConfigForm, { busy: command.busy === 'session.start', onSubmit: createPractice, onCancel: () => setCreating(false) }) : null,
    h('div', { className: 'di-history-filters' },
      h('input', { className: 'di-input', value: queryText, onChange: (event) => setQueryText(event.target.value), placeholder: '搜索练习主题', 'aria-label': '搜索练习主题' }),
      h(Select, { className: 'di-history-mode-select', value: mode, options: [{ value: '', label: '全部模式' }, ...PRACTICE_MODE_OPTIONS], onChange: setMode, 'aria-label': '筛选模式' })),
    h(ErrorNotice, null, list.error),
    downloads.length ? h('div', { className: 'di-notice' }, downloads.map((file) =>
      h('a', { className: 'di-link', href: interviewApi.downloadUrl(file.token), key: file.token }, `下载 ${file.name}`))) : null,
    confirmingId ? h('div', { className: 'di-modal-backdrop' },
      h('div', { className: 'di-confirm-modal', role: 'alertdialog', 'aria-label': '确认删除练习' },
        h('div', { className: 'di-confirm-copy' },
          h('span', { className: 'di-confirm-icon', 'aria-hidden': 'true' }, h(Icon, { name: 'alert', size: 17 })),
          h('div', null,
            h('h4', null, '确认删除该练习？'),
            h('p', null, `确认删除“${practices.find((item) => item.id === confirmingId)?.topic || '该练习'}”及全部作答记录吗？此操作无法撤销。`))),
        h('div', { className: 'di-actions' },
          h(Button, { onClick: () => setConfirmingId(null) }, '取消'),
          h(Button, { tone: 'danger', busy: command.busy === 'library.delete', onClick: () => remove(practices.find((item) => item.id === confirmingId)) }, '确认删除')))) : null,
    list.loading && !list.data ? h(Loading) : practices.length
      ? h('div', { className: 'di-history-scroll' },
          h('table', { className: 'di-history-table' },
            h('thead', null, h('tr', null,
              h('th', null, '练习内容'), h('th', null, '类型'), h('th', null, '练习时间'), h('th', null, '得分'), h('th', { 'aria-label': '操作' }))),
            h('tbody', null, rows)))
      : h('div', { className: 'di-history-empty' },
          h('span', { className: 'di-history-empty-icon', 'aria-hidden': 'true' }, h(Icon, { name: 'archive', size: 24 })),
          h('div', { className: 'di-history-empty-title' }, emptyState.title),
          h('span', null, emptyState.detail)),
    visibleSelectedId ? h('div', { className: 'di-history-detail' },
      !selected ? h(Loading, { label: '正在读取练习详情…' })
        : h(PracticeDetail, { key: selected.id, practice: selected, sessionId, onAdvanced: advanced,
            initialCodeContext: advancedSession?.codeContext?.practiceId === selected.id ? advancedSession.codeContext : null,
            onDeleted: () => { setSelectedId(null); interviewApi.invalidate() } })) : null)
}

export function InsightsCard() {
  const query = useInterviewQuery('insights', () => interviewApi.insights(), [], { cache: false })
  if (query.loading && !query.data) return h('div', { className: 'di-card' }, h(Loading))
  if (query.error) return h('div', { className: 'di-card' }, h(ErrorNotice, null, query.error))
  const insight = query.data?.resource?.data
  return h('article', { className: 'di-card' },
    h('header', { className: 'di-card-head' }, h('div', { className: 'di-title' }, '能力复盘')),
    h('div', { className: 'di-card-body' },
      h('div', { className: 'di-score-row' }, h('span', { className: 'di-score-number' }, insight.averageScore ?? '—'), h(ScoreRail, { score: insight.averageScore })),
      h('div', { className: 'di-meta', style: { marginTop: '8px' } }, `${insight.practiceCount} 次练习 · ${insight.questionCount} 道题 · ${insight.evaluatedCount} 次评价`),
      insight.topics.length ? h('div', { className: 'di-section' }, insight.topics.map((topic) =>
        h('div', { className: 'di-attempt-head', key: topic.topic }, h('span', null, `${topic.topic} · ${topic.evaluatedCount} 题`), h('span', { className: 'di-score-row' }, h('span', null, topic.averageScore), h(ScoreRail, { score: topic.averageScore, compact: true }))))
      ) : h(Empty, { title: '完成评价后生成能力复盘' })))
}
