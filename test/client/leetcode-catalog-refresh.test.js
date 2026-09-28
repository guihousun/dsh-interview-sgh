import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'

test('题库显示期间自动读取本地进度，关闭后停止刷新，不投递 AI 命令', async () => {
  const compiled = transformSync(readFileSync(new URL('../../src/client/features/leetcode.js', import.meta.url), 'utf8'), { format: 'cjs' }).code
  const module = { exports: {} }, timers = new Map()
  let cleanup, reloads = 0, commands = 0, timerId = 0
  const modules = {
    react: { useState: (initial) => [initial, () => {}], useRef: (current) => ({ current }), useEffect: (callback) => { cleanup = callback() } },
    '../shared/hooks.js': { useInterviewQuery: () => ({ loading: true, reload: async () => { reloads++ } }), useCommand: () => ({ run() { commands++ } }) },
    '../shared/ui.js': { h: (type, props, ...children) => ({ type, props, children }), Loading: 'loading' },
  }
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (name) => modules[name] || {},
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id }, clearTimeout: (id) => timers.delete(id) })
  module.exports.LeetcodeCatalog({ sessionId: 's1' })
  assert.equal(timers.size, 1)
  for (let i = 0; i < 2; i++) {
    const [id, timer] = [...timers][0]
    assert.equal(timer.delay, 5000)
    timers.delete(id)
    await timer.callback()
    assert.equal(timers.size, 1)
  }
  assert.equal(reloads, 2)
  assert.equal(commands, 0)
  cleanup()
  assert.equal(timers.size, 0)
})
