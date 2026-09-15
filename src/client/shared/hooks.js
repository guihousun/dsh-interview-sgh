import React from 'react'
import { interviewApi } from './api.js'
import { createSingleFlight } from './single-flight.js'

export function useInterviewQuery(key, loader, dependencies = [], options = {}) {
  const cache = options.cache !== false
  const version = options.version || 0
  const [state, setState] = React.useState({ loading: true, data: null, error: '' })
  const requestSequenceRef = React.useRef(0)
  const load = React.useCallback((force = false) => {
    const requestSequence = ++requestSequenceRef.current
    setState((current) => ({ ...current, loading: current.data === null, error: '' }))
    const request = force || !cache ? Promise.resolve().then(loader) : interviewApi.cached(key, loader, version)
    return request
      .then((data) => {
        if (requestSequence === requestSequenceRef.current) setState({ loading: false, data, error: '' })
        return data
      })
      .catch((error) => {
        if (requestSequence === requestSequenceRef.current) {
          setState((current) => ({ ...current, loading: false, error: error.message || '加载失败' }))
        }
      })
  }, [key, cache, version, ...dependencies])

  React.useEffect(() => {
    load()
    const unsubscribe = interviewApi.subscribe(() => load())
    return () => {
      requestSequenceRef.current += 1
      unsubscribe()
    }
  }, [load])

  return { ...state, reload: () => load(true) }
}

// 客户端 bundle 与运行中的 Host 可能短暂处于不同版本：页面刷新后立刻加载了新前端，而 dsh web 进程还是旧代码。
// 这时新命令会被旧路由拒绝（INVALID_COMMAND），把它翻译成可执行的提示，而不是抛一句“不支持的 UI command”。
export function commandErrorMessage(error) {
  const message = error?.message || '操作失败'
  if (error?.code !== 'INVALID_COMMAND') return message
  return `${message}（插件后端还是旧版本，重启 dsh web 后重试）`
}

export function useCommand(sessionId) {
  const [state, setState] = React.useState({ busy: '', error: '' })
  const sessionIdRef = React.useRef(sessionId)
  const runnerRef = React.useRef(null)
  sessionIdRef.current = sessionId
  if (!runnerRef.current) {
    runnerRef.current = createSingleFlight(async (command, payload = {}) => {
      setState({ busy: command, error: '' })
      try {
        return await interviewApi.command(sessionIdRef.current, command, payload)
      } catch (error) {
        setState({ busy: '', error: commandErrorMessage(error) })
        throw error
      } finally {
        setState((current) => ({ ...current, busy: '' }))
      }
    })
  }
  const run = React.useCallback((command, payload = {}) => runnerRef.current(command, payload), [])
  return { ...state, run, clearError: () => setState((current) => ({ ...current, error: '' })) }
}
