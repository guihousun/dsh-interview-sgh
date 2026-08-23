export function isArtifactQuestionCurrent(session, artifact) {
  return Boolean(
    session?.selected
    && session.practice?.id === artifact?.practiceId
    && session.currentQuestionId === artifact?.questionId
    && session.revision === artifact?.sessionRevision
  )
}

export function getArtifactQuestionActions(session, artifact) {
  const current = isArtifactQuestionCurrent(session, artifact)
  return {
    canReveal: current && session.stage === 'answerable',
    canContinue: current && session.stage === 'reviewed',
    canRetry: current && session.stage === 'reviewed',
    canFinish: current && session.stage === 'reviewed',
  }
}
