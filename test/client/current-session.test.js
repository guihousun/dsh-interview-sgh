import test from 'node:test'
import assert from 'node:assert/strict'
import { currentInterviewSession } from '../../src/client/shared/current-session.js'

test('工作台跟随旧版 current 与新版 mainView 所有权，排除后台任务和其他会话', () => {
  assert.equal(currentInterviewSession({ current: 'legacy-session' }), 'legacy-session')
  assert.equal(currentInterviewSession({ byId: {
    background: { id: 'background', retainedBy: { taskBoard: 1 } },
    current: { id: 'current', retainedBy: { mainView: 1 } },
  } }), 'current')
  assert.equal(currentInterviewSession({ byId: { background: { id: 'background', retainedBy: { taskBoard: 1 } } } }), undefined)
  assert.equal(currentInterviewSession({ byId: {
    a: { id: 'a', retainedBy: { mainView: 1 } }, b: { id: 'b', retainedBy: { mainView: 1 } },
  } }), undefined)
})
