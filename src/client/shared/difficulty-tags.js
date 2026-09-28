import React from 'react'
import { LEETCODE_DIFFICULTY_IDS, normalizeLeetcodeDifficulties } from '../../domain/leetcode-problems.js'
import { leetcodeDifficultyLabel } from '../../domain/leetcode-top-100.js'
import { h } from './ui.js'

export function DifficultyBadge({ difficulty, custom = false }) {
  if (!LEETCODE_DIFFICULTY_IDS.includes(difficulty)) return custom ? h('span', { className: 'di-lc-difficulty is-custom' }, '自定义') : null
  return h('span', { className: `di-lc-difficulty is-${difficulty}`, title: leetcodeDifficultyLabel(difficulty) }, difficulty)
}

export function DifficultyTags({ value = [], onChange, counts = {}, disabled = false, label = '选择训练难度标签' }) {
  const selected = normalizeLeetcodeDifficulties(value)
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((tag) => tag !== id) : LEETCODE_DIFFICULTY_IDS.filter((tag) => tag === id || selected.includes(tag)))
  return h('div', { className: 'di-difficulty-tags', role: 'group', 'aria-label': label },
    h('button', { type: 'button', className: `di-difficulty-tag${selected.length ? '' : ' is-selected'}`, disabled, 'aria-pressed': !selected.length, onClick: () => onChange([]) }, '全部难度'),
    LEETCODE_DIFFICULTY_IDS.map((id) => h('button', { type: 'button', key: id, className: `di-difficulty-tag is-${id}${selected.includes(id) ? ' is-selected' : ''}`,
      title: leetcodeDifficultyLabel(id), disabled, 'aria-label': `${id}（${leetcodeDifficultyLabel(id)}）`, 'aria-pressed': selected.includes(id), onClick: () => toggle(id) },
      h('span', null, id), Number.isFinite(counts[id]) ? h('span', { className: 'di-difficulty-count' }, counts[id]) : null)))
}
