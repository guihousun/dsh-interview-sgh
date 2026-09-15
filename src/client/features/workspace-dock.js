import React from 'react'
import { PracticeLibrary } from './practice-library.js'
import { LeetcodeCatalog } from './leetcode.js'
import { interviewApi } from '../shared/api.js'
import { useInterviewQuery } from '../shared/hooks.js'
import { h, Icon } from '../shared/ui.js'

const WORKSPACE_TABS = Object.freeze([
  { id: 'active', label: '进行中', icon: 'clock' },
  { id: 'library', label: '练习档案', icon: 'archive' },
  { id: 'leetcode', label: '题库', icon: 'flame' },
])

function WorkspaceContent({ tab, sessionId }) {
  if (tab === 'active') return h(PracticeLibrary, {
    sessionId, statusScope: 'active', title: '进行中', allowCreate: true,
  })
  if (tab === 'library') return h(PracticeLibrary, {
    sessionId, statusScope: 'completed', title: '练习档案', allowCreate: false,
  })
  if (tab === 'leetcode') return h(LeetcodeCatalog, { sessionId })
  return null
}

export function WorkspaceSidebarEntry({ wide = true, useSessions }) {
  const sessionId = useSessions((state) => state.current)
  return h(WorkspaceDock, { sessionId, wide })
}

export function WorkspaceDock({ sessionId, wide = true }) {
  const [open, setOpen] = React.useState(false)
  const [tab, setTab] = React.useState('active')
  const [notice, setNotice] = React.useState('')
  const closeButtonRef = React.useRef(null)
  const activeQuery = useInterviewQuery(
    `workspace-active-count:${open}`,
    () => interviewApi.practices({ status: 'active' }),
    [open],
    { cache: false },
  )
  const activeCount = activeQuery.data?.resource?.data?.length || 0

  React.useEffect(() => {
    let timer = null
    const unsubscribe = interviewApi.subscribeNotifications((message) => {
      if (timer) clearTimeout(timer)
      setNotice(message)
      timer = setTimeout(() => setNotice(''), 2600)
    })
    return () => {
      if (timer) clearTimeout(timer)
      unsubscribe()
    }
  }, [])

  React.useEffect(() => interviewApi.subscribeWorkspaceNavigation((nextTab) => {
    if (WORKSPACE_TABS.some((item) => item.id === nextTab)) setTab(nextTab)
    setOpen(true)
  }), [])

  React.useEffect(() => {
    if (!open) return undefined
    closeButtonRef.current?.focus()
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])

  return h(React.Fragment, null,
    h('button', {
      type: 'button',
      className: `di-workspace-entry${wide ? '' : ' is-rail'}${open ? ' is-open' : ''}`,
      title: wide ? undefined : '面试训练',
      'aria-label': '面试训练',
      'aria-haspopup': 'dialog',
      'aria-expanded': open,
      'aria-controls': 'di-interview-workspace',
      onClick: () => setOpen(true),
    }, h(Icon, { name: 'grid', size: wide ? 16 : 18 }), wide ? h('span', { className: 'di-workspace-entry-label' }, '面试训练') : null,
    wide && activeCount > 0 ? h('span', { className: 'di-workspace-entry-count' }, activeCount) : null),
    open ? h('div', {
      className: 'di-workspace-backdrop',
      onMouseDown: (event) => {
        if (event.target === event.currentTarget) setOpen(false)
      },
    },
      h('section', {
        id: 'di-interview-workspace',
        className: 'di-workspace-panel',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': '练习工作台',
      },
      h('header', { className: 'di-workspace-head' },
        h('div', { className: 'di-workspace-brand' },
          h('span', { className: 'di-workspace-brand-icon', 'aria-hidden': 'true' }, h(Icon, { name: 'grid', size: 18 })),
          h('h2', null, '练习工作台')),
        h('button', { ref: closeButtonRef, type: 'button', onClick: () => setOpen(false), 'aria-label': '关闭练习工作台' }, h(Icon, { name: 'close', size: 20 }))),
      h('div', { className: 'di-workspace-layout' },
        h('nav', { className: 'di-workspace-tabs', 'aria-label': '工作台视图' }, WORKSPACE_TABS.map((item) => h('button', {
          type: 'button',
          key: item.id,
          className: tab === item.id ? 'is-active' : '',
          'aria-current': tab === item.id ? 'page' : undefined,
          onClick: () => setTab(item.id),
        }, h(Icon, { name: item.icon, size: 16 }), h('span', null, item.label),
        item.id === 'active' && activeCount > 0 ? h('span', { className: 'di-workspace-count' }, activeCount) : null))),
        h('main', { className: `di-workspace-content is-${tab}` }, h(WorkspaceContent, { tab, sessionId }))))
      ) : null,
    notice ? h('div', { className: 'di-local-toast', role: 'status' }, notice) : null)
}
