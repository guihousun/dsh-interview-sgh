import React from 'react'

export function useCardTransition(runCommand, artifact, disabled = false) {
  const consumedRef = React.useRef(false)
  const [consumedBy, setConsumedBy] = React.useState('')
  const locked = disabled || Boolean(consumedBy)

  const run = React.useCallback(async (command, payload = {}) => {
    if (disabled || consumedRef.current) return null
    consumedRef.current = true
    setConsumedBy(command)
    return runCommand(command, {
      ...payload,
      practiceId: artifact.practiceId,
      questionId: artifact.questionId,
      presentationId: artifact.presentationId,
      sessionRevision: artifact.sessionRevision,
    })
  }, [runCommand, artifact.practiceId, artifact.questionId, artifact.presentationId, artifact.sessionRevision, disabled])

  return { locked, consumedBy, run }
}
