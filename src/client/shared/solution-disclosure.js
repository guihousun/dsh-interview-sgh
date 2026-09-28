import React from 'react'
import { Button, h, Icon, Markdown } from './ui.js'
import { splitSolutionContent } from './solution-content.js'

export function SolutionContent({ detail, memorizationPoints, pointsLabel = '解题要点' }) {
  const [analysisOpen, setAnalysisOpen] = React.useState(false)
  const content = splitSolutionContent(detail)
  const hasAnalysis = Boolean(content.analysis || memorizationPoints)
  return h('div', { className: 'di-solution-content' },
    content.answer ? h('section', { className: 'di-solution-answer', 'aria-label': '答案' },
      h('h4', null, '答案'), h(Markdown, null, content.answer)) : null,
    hasAnalysis ? h('section', { className: 'di-solution-analysis', 'aria-label': '解析' },
      h('div', { className: 'di-solution-analysis-head' }, h('h4', null, '解析'),
        h(Button, { type: 'button', 'aria-expanded': analysisOpen, onClick: () => setAnalysisOpen((value) => !value) },
          h(Icon, { name: 'chevronDown' }), analysisOpen ? '收起解析' : '展开解析')),
      analysisOpen ? h('div', { className: 'di-solution-analysis-body' },
        content.analysis ? h(Markdown, null, content.analysis) : null,
        memorizationPoints ? h('section', { className: 'di-attempt' }, h('div', { className: 'di-section-label' }, pointsLabel),
          h(Markdown, null, memorizationPoints)) : null) : null) : null)
}

export function SolutionDisclosure({ children, onToggle }) {
  const [open, setOpen] = React.useState(false)
  return h('section', { className: `di-solution-disclosure${open ? ' is-open' : ''}`, 'aria-label': '正确答案' },
    h('div', { className: 'di-solution-toggle' },
      h('span', { className: 'di-meta' }, open ? '正确答案' : '正确答案已遮蔽，先独立思考'),
      h(Button, { onClick: () => { const next = !open; setOpen(next); onToggle?.(next) }, 'aria-expanded': open },
        h(Icon, { name: 'eye' }), open ? '收起正确答案' : '展开正确答案')),
    open ? h('div', { className: 'di-solution-body' }, children) : null)
}
