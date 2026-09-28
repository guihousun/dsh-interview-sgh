import React from 'react'
import { interviewApi } from '../shared/api.js'
import { useInterviewQuery } from '../shared/hooks.js'
import { DifficultyTags } from '../shared/difficulty-tags.js'
import { leetcodeDifficultyTagsLabel } from '../../domain/leetcode-problems.js'
import { Button, ErrorNotice, h, Select } from '../shared/ui.js'

export function LeetcodeTrainingControls({ practice, sessionId, busy, onNext }) {
  const [category, setCategory] = React.useState(practice.config.category || '')
  const [difficulties, setDifficulties] = React.useState(practice.config.difficulties || [])
  const query = useInterviewQuery('leetcode-training-catalog', () => interviewApi.leetcodeCatalog(), [], { cache: false })
  const catalog = query.data?.resource?.data
  const eligible = (catalog?.groups || []).flatMap((group) => group.problems).filter((problem) => !category || problem.category === category)
  const count = eligible.filter((problem) => !difficulties.length || difficulties.includes(problem.difficulty)).length
  const counts = Object.fromEntries(['easy', 'medium', 'hard'].map((id) => [id, eligible.filter((problem) => problem.difficulty === id).length]))
  const disabled = Boolean(busy) || !sessionId || !catalog?.difficultyTags || count === 0
  return h('section', { className: 'di-training-controls', 'aria-label': '专题与难度训练' },
    h('div', { className: 'di-training-heading' }, h('span', null, '选择下一道的训练范围'),
      h(Select, { value: category, options: [{ value: '', label: '全部专题' }, ...(catalog?.categories || []).map((name) => ({ value: name, label: name }))], disabled: Boolean(busy), onChange: setCategory, 'aria-label': '训练专题' })),
    h(DifficultyTags, { value: difficulties, onChange: setDifficulties, counts, disabled: Boolean(busy) }),
    h('div', { className: 'di-meta', role: 'status' }, `${category || '全部专题'} · ${leetcodeDifficultyTagsLabel(difficulties)} · ${count} 道题`),
    catalog && !count ? h('div', { className: 'di-notice' }, '所选专题和难度没有题目，请调整训练范围。') : null,
    h('div', { className: 'di-training-actions' },
      h(Button, { tone: 'primary', disabled, busy: busy === 'ordered', onClick: () => onNext({ category, difficulties, selectionMode: 'ordered' }) }, '按专题顺序下一道'),
      h(Button, { disabled, busy: busy === 'random', onClick: () => onNext({ category, difficulties, selectionMode: 'random' }) }, '随机下一道')),
    h('div', { className: 'di-meta' }, '顺序出题按专题中的题库顺序，到末尾后从第一道继续。'),
    h(ErrorNotice, null, query.error))
}
