import React from 'react'
import { interviewApi } from '../shared/api.js'
import { useCommand, useInterviewQuery } from '../shared/hooks.js'
import { Button, Empty, ErrorNotice, h, Loading, Markdown, Select } from '../shared/ui.js'
import { leetcodeDifficultyLabel } from '../../domain/leetcode-top-100.js'
import { leetcodeLanguageLabel } from '../../domain/leetcode-languages.js'
import { LEETCODE_GUIDANCE_LEVELS } from '../../domain/leetcode-guidance.js'
import { isCardActive } from '../shared/card-activity.js'
import { useCardTransition } from '../shared/card-transition.js'
import { PracticeConfigForm } from './practice-config.js'

const DIFFICULTY = Object.freeze({
  easy: { label: '简单', tone: 'easy' },
  medium: { label: '中等', tone: 'medium' },
  hard: { label: '困难', tone: 'hard' },
})

const DIFFICULTY_OPTIONS = Object.freeze([
  { value: '', label: '全部难度' },
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
])

function catalogProblems(catalog) {
  return catalog?.groups?.flatMap((group) => group.problems) || []
}

function catalogProblem(catalog, slug) {
  return catalogProblems(catalog).find((problem) => problem.slug === slug) || null
}

function matchesKeyword(problem, keyword) {
  if (!keyword) return true
  const haystack = `${problem.id} ${problem.title} ${problem.slug} ${problem.category}`.toLowerCase()
  return keyword.toLowerCase().split(/\s+/).filter(Boolean).every((part) => haystack.includes(part))
}

function filterProblems(problems, { keyword, difficulty, category }) {
  return problems
    .filter((problem) => !difficulty || problem.difficulty === difficulty)
    .filter((problem) => !category || problem.category === category)
    .filter((problem) => matchesKeyword(problem, keyword))
}

function DifficultyBadge({ difficulty, custom = false }) {
  if (custom) return h('span', { className: 'di-lc-difficulty is-custom' }, '自定义')
  const value = DIFFICULTY[difficulty] || { label: leetcodeDifficultyLabel(difficulty), tone: 'unknown' }
  if (!value.label) return null
  return h('span', { className: `di-lc-difficulty is-${value.tone}` }, value.label)
}

function GuidanceBadge({ guidance }) {
  const definition = LEETCODE_GUIDANCE_LEVELS.find((item) => item.id === guidance)
  if (!definition) return null
  return h('span', { className: `di-guidance-badge is-${definition.id}`, title: definition.detail }, definition.label)
}

function CompletionButton({ problem, pending, onToggle }) {
  return h('button', {
    type: 'button',
    className: `di-lc-check${problem.completed ? ' is-complete' : ''}`,
    disabled: pending,
    'aria-pressed': problem.completed,
    'aria-label': problem.completed ? `将${problem.title}标记为未完成` : `将${problem.title}标记为完成`,
    onClick: () => onToggle(problem),
  }, problem.completed ? '✓' : '')
}

function LeetcodeStartButton({ problem, busy, disabled, onStart }) {
  return h('button', {
    type: 'button',
    className: 'di-lc-start',
    disabled: disabled || busy,
    'aria-label': `开始做${problem.title}`,
    onClick: () => onStart(problem),
  }, busy ? '准备中…' : '做这题')
}

function CustomProblemForm({ disabled, busy, onStart }) {
  const [number, setNumber] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const valid = Boolean(title.trim() || slug.trim())
  const submit = () => {
    if (!valid || disabled) return
    onStart({ number: number.trim(), title: title.trim(), slug: slug.trim(), custom: true })
  }
  return h('section', { className: 'di-lc-custom' },
    h('div', { className: 'di-lc-custom-head' },
      h('div', null,
        h('div', { className: 'di-lc-custom-title' }, '热题 100 里没有？直接点名一道'),
        h('div', { className: 'di-meta' }, '填写题号、题名，或者力扣的英文 slug（例如 sliding-window-maximum）。')),
    ),
    h('div', { className: 'di-lc-custom-fields' },
      h('input', { className: 'di-input', value: number, disabled, placeholder: '题号，例如 300', onChange: (event) => setNumber(event.target.value), 'aria-label': '力扣题号' }),
      h('input', { className: 'di-input', value: title, disabled, placeholder: '题名，例如 最长递增子序列', onChange: (event) => setTitle(event.target.value), 'aria-label': '力扣题名' }),
      h('input', { className: 'di-input', value: slug, disabled, placeholder: 'slug（可选）', onChange: (event) => setSlug(event.target.value), 'aria-label': '力扣题目 slug' }),
      h(Button, { tone: 'primary', disabled: disabled || !valid, busy, onClick: submit }, '开始这道题')))
}

function CatalogRow({ problem, pendingSlug, disabled = false, onToggle, onStart }) {
  return h('div', { className: `di-lc-row is-selectable${problem.completed ? ' is-complete' : ''}` },
    h(CompletionButton, { problem, pending: pendingSlug === problem.slug, onToggle }),
    h('a', { className: 'di-lc-problem-link', href: problem.url, target: '_blank', rel: 'noreferrer' },
      h('span', { className: 'di-lc-problem-id' }, problem.id),
      h('span', null, problem.title),
      h('span', { className: 'di-lc-open', 'aria-hidden': 'true' }, '↗')),
    h(DifficultyBadge, { difficulty: problem.difficulty }),
    h(LeetcodeStartButton, {
      problem,
      busy: pendingSlug === problem.slug,
      disabled: disabled || (Boolean(pendingSlug) && pendingSlug !== problem.slug),
      onStart,
    }))
}

function CatalogGroup({ group, pendingSlug, disabled = false, onToggle, onStart }) {
  const completed = group.problems.filter((problem) => problem.completed).length
  return h('section', { className: 'di-lc-group' },
    h('div', { className: 'di-lc-group-head' },
      h('h3', null, group.category),
      h('span', null, `${completed}/${group.problems.length}`)),
    h('div', { className: 'di-lc-problems' }, group.problems.map((problem) => h(CatalogRow, {
      key: problem.slug,
      problem,
      pendingSlug,
      disabled,
      onToggle,
      onStart,
    }))))
}

export function LeetcodeCatalog({ sessionId }) {
  const query = useInterviewQuery('leetcode-catalog', () => interviewApi.leetcodeCatalog(), [], { cache: false })
  const sessionQuery = useInterviewQuery(`lc-session:${sessionId}`, () => interviewApi.session(sessionId), [sessionId], { cache: false })
  const command = useCommand(sessionId)
  const [pendingSlug, setPendingSlug] = React.useState('')
  const [pendingProblem, setPendingProblem] = React.useState(null)
  const [keyword, setKeyword] = React.useState('')
  const [difficulty, setDifficulty] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [customOpen, setCustomOpen] = React.useState(false)

  if (query.loading && !query.data) return h('div', { className: 'di-lc-catalog' }, h(Loading, { label: '正在读取力扣题库…' }))
  if (query.error) return h('div', { className: 'di-lc-catalog' }, h(ErrorNotice, null, query.error))
  const catalog = query.data?.resource?.data
  if (!catalog) return null
  const session = sessionQuery.data?.resource?.data
  const activePractice = session?.selected && session.practice?.mode === 'leetcode' ? session.practice : null
  const activeLeetcode = Boolean(activePractice && activePractice.status === 'active')
  // difficulties/categories 是 0.6.0 后端才有的字段：缺失说明 dsh web 仍是旧进程，新命令会被拒绝。
  const hostOutdated = !Array.isArray(catalog.difficulties) || catalog.difficulties.length === 0
  // 0.6.0 之前建的练习只存了 language：换题会用旧配置创建新练习，必须先让用户补选引导强度。
  const needsConfig = !activeLeetcode || !activePractice.config?.guidance

  const toggle = async (problem) => {
    setPendingSlug(problem.slug)
    try {
      await command.run('leetcode.set-completion', { slug: problem.slug, completed: !problem.completed })
      await query.reload()
    } catch {
      // useCommand 已保存可展示错误。
    } finally {
      setPendingSlug('')
    }
  }
  const start = async (problem) => {
    if (needsConfig) {
      setPendingProblem(problem)
      return
    }
    setPendingSlug(problem.slug || problem.title)
    try {
      await command.run('leetcode.select', { problem })
      await Promise.all([query.reload(), sessionQuery.reload()])
    } catch {
      // useCommand 已保存可展示错误。
    } finally {
      setPendingSlug('')
    }
  }
  const startWithConfig = async (payload) => {
    if (!pendingProblem) return
    try {
      await command.run('leetcode.select', { problem: pendingProblem, config: payload.config })
      setPendingProblem(null)
      await Promise.all([query.reload(), sessionQuery.reload()])
    } catch {
      // useCommand 已保存可展示错误。
    }
  }

  if (pendingProblem) {
    return h('section', { className: 'di-lc-catalog', 'aria-label': '为指定题目创建刷力扣练习' },
      h('header', { className: 'di-lc-catalog-head' },
        h('div', { className: 'di-lc-heading' },
          h('h2', { className: 'di-lc-title' }, '开始这道题'),
          h('span', { className: 'di-lc-source' }, `${pendingProblem.id ? `${pendingProblem.id}. ` : ''}${pendingProblem.title}`))),
      h('div', { className: 'di-lc-catalog-config' },
        activeLeetcode
          ? h('div', { className: 'di-meta di-lc-config-note' }, '这条力扣练习是升级前创建的，只记录了编程语言；补选引导强度后会归档旧练习并开始这道题。')
          : null,
        h(PracticeConfigForm, {
          initial: { mode: 'leetcode', config: activePractice ? activePractice.config : {} },
          busy: command.busy === 'leetcode.select',
          onSubmit: startWithConfig,
          onCancel: () => setPendingProblem(null),
          submitLabel: '开始练习',
        })),
      h(ErrorNotice, null, command.error))
  }

  const problems = catalogProblems(catalog)
  const filtered = filterProblems(problems, { keyword, difficulty, category })
  const visibleGroups = catalog.groups
    .map((group) => ({ ...group, problems: group.problems.filter((problem) => filtered.includes(problem)) }))
    .filter((group) => group.problems.length > 0)
  const progress = catalog.total ? Math.round((catalog.completedCount / catalog.total) * 100) : 0
  const filtering = Boolean(keyword.trim() || difficulty || category)

  return h('section', { className: 'di-lc-catalog', 'aria-label': '力扣题库' },
    h('header', { className: 'di-lc-catalog-head' },
      h('div', { className: 'di-lc-heading' },
        h('h2', { className: 'di-lc-title' }, '题库'),
        h('a', { className: 'di-lc-source', href: catalog.source.url, target: '_blank', rel: 'noreferrer' }, '热题 100 · 官方题单 ↗')),
      h('div', { className: 'di-lc-catalog-summary' },
        h('span', { className: 'di-lc-progress-label' }, '完成进度'),
        h('div', { className: 'di-lc-progress-copy' },
          h('span', { className: 'di-lc-progress-value' }, catalog.completedCount),
          h('span', null, `/ ${catalog.total}`)),
        h('div', { className: 'di-lc-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': catalog.total, 'aria-valuenow': catalog.completedCount },
          h('i', { style: { width: `${progress}%` } })))),
    h('div', { className: 'di-lc-toolbar' },
      h('input', {
        className: 'di-input di-lc-search',
        value: keyword,
        placeholder: '搜题号、题名或题型，例如 33 / 二分 / two-sum',
        'aria-label': '搜索力扣题目',
        onChange: (event) => setKeyword(event.target.value),
      }),
      h(Select, {
        className: 'di-lc-filter-select', value: difficulty, options: DIFFICULTY_OPTIONS,
        onChange: setDifficulty, 'aria-label': '按难度筛选',
      }),
      h(Select, {
        className: 'di-lc-filter-select',
        value: category,
        options: [{ value: '', label: '全部题型' }, ...(catalog.categories || []).map((item) => ({ value: item, label: item }))],
        onChange: setCategory,
        'aria-label': '按题型筛选',
      }),
      h(Button, { onClick: () => setCustomOpen((value) => !value), disabled: hostOutdated }, customOpen ? '收起自定义' : '自定义题目')),
    hostOutdated
      ? h('div', { className: 'di-notice' }, '检测到插件后端仍是旧版本：搜索选题、提示阶梯和材料卡需要重启 dsh web 后生效。')
      : null,    customOpen
      ? h(CustomProblemForm, { disabled: command.busy === 'leetcode.select', busy: false, onStart: start })
      : null,
    h('div', { className: 'di-lc-toolbar-note' },
      h('span', { className: 'di-meta' }, filtering
        ? `筛选出 ${filtered.length} 道题`
        : '点「做这题」直接开始；已有进行中的力扣练习时会自动结束它并切到新题。')),
    h(ErrorNotice, null, command.error),
    !visibleGroups.length
      ? h(Empty, { title: '没有匹配的题目', detail: '换个关键字，或者用「自定义题目」点名一道热题 100 之外的题。' })
      : h('div', { className: 'di-lc-groups' }, visibleGroups.map((group) => h(CatalogGroup, {
        key: group.category,
        group,
        pendingSlug,
        disabled: hostOutdated,
        onToggle: toggle,
        onStart: start,
      }))))
}

function MaterialsBlock({ question }) {
  const materials = question.materials
  if (!materials) return null
  const revealed = question.hintTotal ? Math.min(question.hintLevel || 0, question.hintTotal) : 0
  return h('div', { className: 'di-lc-materials' },
    h('div', { className: 'di-lc-material-block' },
      h('div', { className: 'di-lc-material-label' }, '题意'),
      h(Markdown, null, materials.statement)),
    materials.examples?.length ? h('div', { className: 'di-lc-material-block' },
      h('div', { className: 'di-lc-material-label' }, '示例'),
      h('div', { className: 'di-lc-examples' }, materials.examples.map((example, index) => h('div', { className: 'di-lc-example', key: index },
        h('div', null, h('span', null, '输入'), h('code', null, example.input)),
        h('div', null, h('span', null, '输出'), h('code', null, example.output)),
        example.note ? h('div', null, h('span', null, '说明'), h('span', null, example.note)) : null)))) : null,
    materials.constraints?.length ? h('div', { className: 'di-lc-material-block' },
      h('div', { className: 'di-lc-material-label' }, '数据范围'),
      h('ul', { className: 'di-lc-chips' }, materials.constraints.map((item, index) => h('li', { key: index }, h('code', null, item))))) : null,
    materials.knowledge?.length ? h('div', { className: 'di-lc-material-block' },
      h('div', { className: 'di-lc-material-label' }, '前置知识'),
      materials.knowledge.map((item) => h('div', { className: 'di-lc-knowledge', key: item.title },
        h('div', { className: 'di-lc-knowledge-title' }, item.title),
        h(Markdown, null, item.detail)))) : null,
    materials.hints?.length ? h('div', { className: 'di-lc-material-block' },
      h('div', { className: 'di-lc-material-label' }, `提示阶梯 ${revealed}/${materials.hints.length}`),
      h('ol', { className: 'di-lc-hints' }, materials.hints.map((hint, index) => h('li', {
        key: index,
        className: index < revealed ? 'is-revealed' : 'is-locked',
      }, index < revealed ? h(Markdown, null, hint) : '未解锁，点「提示」逐步打开')))) : null,
    materials.pitfalls?.length ? h('div', { className: 'di-lc-material-block' },
      h('div', { className: 'di-lc-material-label' }, '常见误区'),
      h('ul', null, materials.pitfalls.map((item, index) => h('li', { key: index }, item)))) : null,
    materials.related?.length ? h('div', { className: 'di-lc-material-block' },
      h('div', { className: 'di-lc-material-label' }, '相似题'),
      h('ul', { className: 'di-lc-related' }, materials.related.map((item) => h('li', { key: `${item.id}-${item.title}` },
        h('a', { className: 'di-link', href: item.url, target: '_blank', rel: 'noreferrer' }, `${item.id ? `${item.id}. ` : ''}${item.title}`))))) : null)
}

function ProblemPicker({ catalog, busy, consumedBy, onPick, onClose }) {
  const [keyword, setKeyword] = React.useState('')
  const [difficulty, setDifficulty] = React.useState('')
  const problems = filterProblems(catalogProblems(catalog), { keyword, difficulty, category: '' })
  const visible = problems.slice(0, 8)
  return h('section', { className: 'di-lc-picker', 'aria-label': '换一道题' },
    h('div', { className: 'di-lc-toolbar' },
      h('input', {
        className: 'di-input di-lc-search',
        value: keyword,
        placeholder: '搜题号、题名或题型',
        'aria-label': '搜索要做的题目',
        onChange: (event) => setKeyword(event.target.value),
      }),
      h(Select, { className: 'di-lc-filter-select', value: difficulty, options: DIFFICULTY_OPTIONS, onChange: setDifficulty, 'aria-label': '按难度筛选' }),
      h(Button, { disabled: busy, onClick: onClose }, '收起')),
    visible.length
      ? h('div', { className: 'di-lc-picker-list' }, visible.map((problem) => h('button', {
        type: 'button',
        className: 'di-lc-picker-row',
        key: problem.slug,
        disabled: busy,
        onClick: () => onPick({ slug: problem.slug }),
      },
      h('span', { className: 'di-lc-problem-id' }, problem.id),
      h('span', { className: 'di-lc-picker-title' }, problem.title),
      h(DifficultyBadge, { difficulty: problem.difficulty }))))
      : h('div', { className: 'di-empty' }, h('div', { className: 'di-empty-title' }, '没有匹配的题目')),
    h('div', { className: 'di-lc-picker-foot' },
      h(Button, {
        disabled: busy,
        onClick: () => onPick(difficulty ? { difficulty } : {}),
      }, consumedBy === 'question.next' ? '已出下一题' : (difficulty ? `随机一道${leetcodeDifficultyLabel(difficulty)}题` : '随机抽一道')),
      problems.length > visible.length ? h('span', { className: 'di-meta' }, `还有 ${problems.length - visible.length} 道题，继续输入缩小范围`) : null))
}

function LeetcodeQuestionCard({
  question, catalog, language, active, expanded, command, transition,
  onRun, onNext, onExplain, onHint, onGenerateMaterials, pendingMaterials,
}) {
  const problem = question.leetcode
  const materials = question.materials
  const saved = catalogProblem(catalog, problem.slug)
  const completed = saved?.completed === true
  const hintTotal = question.hintTotal || 0
  const hintLevel = question.hintLevel || 0
  const [showMaterials, setShowMaterials] = React.useState(false)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  return h('article', { className: `di-card di-lc-problem-card${active ? ' is-active' : ' is-history'}`, 'aria-label': active ? '当前力扣题目' : '历史力扣题目' },
    h('div', { className: 'di-lc-problem-main' },
      h('div', { className: 'di-lc-problem-title' }, problem.id ? h('span', null, problem.id) : null, problem.title),
      h('div', { className: 'di-lc-problem-meta' },
        h('span', null, problem.category),
        h(DifficultyBadge, { difficulty: problem.difficulty, custom: Boolean(problem.custom) }),
        language ? h('span', null, leetcodeLanguageLabel(language)) : null,
        h(GuidanceBadge, { guidance: question.guidance }),
        problem.slug ? h('span', { className: completed ? 'is-complete' : '' }, completed ? '已完成' : '未完成') : null)),
    h('div', { className: 'di-lc-problem-actions' },
      h('a', { className: 'di-button is-primary', href: problem.url, target: '_blank', rel: 'noreferrer' }, '打开题目 ↗'),
      active ? h(React.Fragment, null,
        materials && hintTotal
          ? h(Button, {
            disabled: transition.locked || pendingMaterials || hintLevel >= hintTotal,
            busy: command.busy === 'question.hint',
            onClick: () => onHint(),
          }, hintLevel >= hintTotal ? `提示已用完 ${hintTotal}/${hintTotal}` : `提示 ${hintLevel}/${hintTotal}`)
          : h(Button, {
            disabled: transition.locked || pendingMaterials,
            busy: command.busy === 'question.materials' || pendingMaterials,
            onClick: () => onGenerateMaterials(),
          }, pendingMaterials ? '正在生成材料…' : '生成题目材料'),
        h(Button, {
          disabled: transition.locked,
          busy: command.busy === 'question.reveal',
          onClick: () => onExplain(question),
        }, question.explanation ? (expanded ? '收起讲解' : '展开讲解') : '看答案'),
        h(Button, { disabled: transition.locked, onClick: () => setPickerOpen((value) => !value) }, pickerOpen ? '收起选题' : '换一题'),
        problem.slug ? h(Button, {
          disabled: transition.locked,
          busy: command.busy === 'leetcode.set-completion',
          onClick: () => onRun('leetcode.set-completion', { slug: problem.slug, completed: !completed }),
        }, completed ? '标记未完成' : '标记完成') : null) : null),
    materials ? h('div', { className: 'di-lc-material-actions' },
      h(Button, { onClick: () => setShowMaterials((value) => !value) }, showMaterials ? '收起题目材料' : '查看题目材料'),
      h('span', { className: 'di-meta' }, '材料同时以 dsh-ui 卡片展示在对话里')) : null,
    pickerOpen && active
      ? h(ProblemPicker, {
        catalog,
        busy: transition.locked || command.busy === 'question.next',
        consumedBy: transition.consumedBy,
        onPick: (selection) => onNext(selection),
        onClose: () => setPickerOpen(false),
      })
      : null,
    active && pendingMaterials
      ? h('div', { className: 'di-notice' }, '正在生成题目材料与提示阶梯，完成后会自动出现在这里。')
      : null,
    active ? h(ErrorNotice, null, command.error) : null,
    showMaterials && materials ? h('section', { className: 'di-section di-lc-material-section', 'aria-label': '题目材料' }, h(MaterialsBlock, { question })) : null,
    expanded && question.explanation
      ? h('section', { className: 'di-section', 'aria-label': '题目讲解' },
        h('div', { className: 'di-section-label' }, '讲解'),
        h(Markdown, null, question.explanation.detail),
        question.explanation.memorizationPoints
          ? h('div', { className: 'di-attempt' },
            h('div', { className: 'di-section-label' }, '解题要点'),
            h(Markdown, null, question.explanation.memorizationPoints))
          : null)
      : null)
}

export function LeetcodeProblemCard({ sessionId, initialQuestion = null, artifact, language = '', resourceRevision = 0, onRefresh = null }) {
  const sessionQuery = useInterviewQuery(`session:${sessionId}:${artifact.presentationId}`, () => interviewApi.session(sessionId), [sessionId, artifact.presentationId, resourceRevision], { version: resourceRevision, cache: false })
  const catalogQuery = useInterviewQuery('leetcode-catalog-current', () => interviewApi.leetcodeCatalog(), [], { cache: false })
  const command = useCommand(sessionId)
  const session = sessionQuery.data?.resource?.data
  const current = initialQuestion
  const [showExplanation, setShowExplanation] = React.useState(false)
  const [pendingMaterials, setPendingMaterials] = React.useState(false)
  const [pollTick, setPollTick] = React.useState(0)
  const refreshRef = React.useRef(null)
  const artifactActive = isCardActive(session, artifact)
  const transition = useCardTransition(command.run, artifact, !artifactActive)
  refreshRef.current = () => {
    onRefresh?.()
    sessionQuery.reload()
  }

  React.useEffect(() => {
    setShowExplanation(false)
    setPendingMaterials(false)
    setPollTick(0)
  }, [current?.id])

  React.useEffect(() => {
    if (pendingMaterials && current?.materials) setPendingMaterials(false)
  }, [pendingMaterials, current?.materials])

  // 材料由模型异步生成：这里做有限次轮询，生成完成后卡片自动补上提示阶梯与材料。
  React.useEffect(() => {
    if (!pendingMaterials || current?.materials || pollTick >= 8) return undefined
    const timer = setTimeout(() => {
      refreshRef.current?.()
      setPollTick((value) => value + 1)
    }, 2500)
    return () => clearTimeout(timer)
  }, [pendingMaterials, current?.materials, pollTick])

  if (sessionQuery.loading && !current) return h('div', { className: 'di-card' }, h(Loading))
  if (!current?.leetcode) return null

  const run = async (name, payload) => {
    try {
      const result = await command.run(name, payload)
      await Promise.all([sessionQuery.reload(), catalogQuery.reload(), Promise.resolve(onRefresh?.())])
      return result
    } catch {
      // useCommand 已保存可展示错误。
      return null
    }
  }

  const explain = async () => {
    if (current.explanation) {
      setShowExplanation((value) => !value)
      return
    }
    await transition.run('question.reveal')
  }

  const next = (selection = null) => transition.run('question.next', selection || {})

  const hint = async () => {
    const result = await run('question.hint', { questionId: current.id })
    if (result?.resource?.kind === 'materials-pending') {
      setPollTick(0)
      setPendingMaterials(true)
    }
  }

  const generateMaterials = async () => {
    const result = await run('question.materials', { questionId: current.id })
    if (result?.resource?.kind === 'materials-pending') {
      setPollTick(0)
      setPendingMaterials(true)
    }
  }

  const catalog = catalogQuery.data?.resource?.data
  const active = artifactActive
  return h(LeetcodeQuestionCard, {
    question: { ...current, guidance: session?.practice?.config?.guidance || null },
    catalog,
    language: language || session?.practice?.config?.language,
    active,
    expanded: showExplanation,
    command,
    transition,
    onRun: run,
    onNext: next,
    onExplain: explain,
    onHint: hint,
    onGenerateMaterials: generateMaterials,
    pendingMaterials,
  })
}
