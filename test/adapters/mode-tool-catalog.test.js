import assert from 'node:assert/strict'
import test from 'node:test'
import { ModeToolCatalog, deniedToolNamesForMode, toolNamesForMode } from '../../src/adapters/dsh/mode-tool-catalog.js'

test('不同练习模式只披露所需工具目录', () => {
  const none = toolNamesForMode()
  const mock = toolNamesForMode('mock')
  const resumeDrill = toolNamesForMode('resume_drill')
  const leetcode = toolNamesForMode('leetcode')

  assert.equal(none.includes('interview_question'), false)
  assert.equal(none.includes('interview_show_summary'), true)
  assert.equal(mock.includes('interview_question'), true)
  assert.equal(mock.includes('interview_evaluation'), false)
  assert.equal(mock.includes('interview_explanation'), false)
  assert.equal(mock.includes('interview_show_review'), false)
  assert.equal(mock.includes('interview_show_summary'), false)
  assert.equal(resumeDrill.includes('interview_evaluation'), true)
  assert.equal(resumeDrill.includes('interview_show_review'), true)
  assert.equal(leetcode.includes('interview_leetcode'), true)
  assert.equal(leetcode.includes('interview_evaluation'), true)
  assert.equal(deniedToolNamesForMode('mock').includes('interview_evaluation'), true)
  assert.equal(deniedToolNamesForMode('mock').includes('external_tool'), false)
  assert.deepEqual(deniedToolNamesForMode('leetcode'), [])
})

test('会话绑定或切换练习后实时更新 Agent 工具目录', async () => {
  let mode = null
  const restrictions = []
  const agent = {
    id: 'session-1',
    ctx: {
      tools: {
        restrict(filter) {
          const entry = { filter, disposed: false }
          restrictions.push(entry)
          return () => { entry.disposed = true }
        },
      },
    },
  }
  const application = {
    async readAtomicSession() {
      return { resource: { data: mode ? { selected: true, practice: { mode } } : { selected: false } } }
    },
  }
  const catalog = new ModeToolCatalog({ application })
  catalog.attach(agent)
  await new Promise((resolve) => setImmediate(resolve))

  mode = 'mock'
  await catalog.refresh(agent.id)
  assert.equal(catalog.modeFor(agent.id), 'mock')
  assert.equal(restrictions.at(-1).filter.deny.includes('interview_evaluation'), true)
  assert.equal('allow' in restrictions.at(-1).filter, false)

  mode = 'resume_drill'
  await catalog.refresh(agent.id)
  assert.equal(catalog.modeFor(agent.id), 'resume_drill')
  assert.equal(restrictions.at(-1).filter.deny.includes('interview_evaluation'), false)
  assert.equal(restrictions.at(-2).disposed, true)

  mode = null
  await catalog.refresh(agent.id)
  assert.equal(catalog.modeFor(agent.id), null)
  assert.equal(restrictions.at(-1).filter.deny.includes('interview_show_summary'), false)
})
