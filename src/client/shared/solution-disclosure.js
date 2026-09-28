import React from 'react'
import { Button, h, Icon } from './ui.js'

export function SolutionDisclosure({ children, onToggle }) {
  const [open, setOpen] = React.useState(false)
  return h('section', { className: `di-solution-disclosure${open ? ' is-open' : ''}`, 'aria-label': '正确答案' },
    h('div', { className: 'di-solution-toggle' },
      h('span', { className: 'di-meta' }, open ? '正确答案' : '正确答案已遮蔽，先独立思考'),
      h(Button, { onClick: () => { const next = !open; setOpen(next); onToggle?.(next) }, 'aria-expanded': open },
        h(Icon, { name: 'eye' }), open ? '收起正确答案' : '展开正确答案')),
    open ? h('div', { className: 'di-solution-body' }, children) : null)
}
