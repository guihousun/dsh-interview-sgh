export function isCardActive(session, artifact) {
  return Boolean(
    session?.selected
    && session.practice?.id === artifact?.practiceId
    && session.currentQuestionId === artifact?.questionId
    && session.revision === artifact?.sessionRevision
  )
}
