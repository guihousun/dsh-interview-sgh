import React from 'react'

export function useCardLifecycle(disabled = false) {
  const consumedRef = React.useRef(false)
  const [consumedBy, setConsumedBy] = React.useState('')
  const locked = disabled || Boolean(consumedBy)

  const enter = React.useCallback(async (action, task) => {
    if (disabled || consumedRef.current) return null
    consumedRef.current = true
    setConsumedBy(action)
    return task()
  }, [disabled])

  return { locked, consumedBy, enter }
}

export function useCardTransition(runCommand, artifact, disabled = false) {
  const lifecycle = useCardLifecycle(disabled)
  const run = React.useCallback((command, payload = {}) => lifecycle.enter(command, () => runCommand(command, {
    ...payload,
    practiceId: artifact.practiceId,
    questionId: artifact.questionId,
    presentationId: artifact.presentationId,
    sessionRevision: artifact.sessionRevision,
  })), [runCommand, lifecycle.enter, artifact.practiceId, artifact.questionId, artifact.presentationId, artifact.sessionRevision])

  return { ...lifecycle, run }
}
