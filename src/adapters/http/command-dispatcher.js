function practiceInput(payload) {
  return { mode: payload.mode, config: payload.config }
}

function dispatchAgent(eventBridge, sessionId, event) {
  eventBridge?.dispatch(sessionId, event)
}

async function selected(application, sessionId) {
  const result = await application.readAtomicSession(sessionId)
  const data = result.resource.data
  if (!data.selected) throw new TypeError('当前会话未选择练习')
  return { result, data, practiceId: data.practice.id, questionId: data.currentQuestionId }
}

async function consumeCard(application, sessionId, payload) {
  return application.consumeAtomicPresentation(sessionId, {
    presentationId: payload.presentationId,
    practiceId: payload.practiceId,
    questionId: payload.questionId,
    sessionRevision: payload.sessionRevision,
  })
}

export const UI_COMMANDS = Object.freeze([
  'session.start', 'session.continue', 'session.select', 'session.reopen', 'session.finish',
  'practice.update', 'question.open', 'question.focus', 'question.update', 'question.delete', 'question.next',
  'question.retry', 'question.reveal', 'leetcode.set-completion', 'library.delete', 'library.export',
])

export async function dispatchCommand({ application, eventBridge }, sessionId, command, payload = {}) {
  switch (command) {
    case 'session.start': {
      await application.createAtomicPractice(sessionId, practiceInput(payload))
      let session = await application.readAtomicSession(sessionId)
      if (payload.mode === 'leetcode') {
        const question = await application.drawAtomicLeetcode(sessionId)
        dispatchAgent(eventBridge, sessionId, {
          type: 'question.show', practiceId: question.references.practiceId, questionId: question.references.questionId,
        })
        session = await application.readAtomicSession(sessionId)
      } else {
        dispatchAgent(eventBridge, sessionId, { type: 'question.generate', practiceId: session.resource.data.practice.id })
      }
      return session
    }
    case 'session.continue': {
      const current = await selected(application, sessionId)
      dispatchAgent(eventBridge, sessionId, { type: 'practice.continue', practiceId: current.practiceId })
      return current.result
    }
    case 'session.select': {
      const result = await application.bindAtomicPractice(sessionId, payload.practiceId)
      dispatchAgent(eventBridge, sessionId, { type: 'practice.selected', practiceId: result.resource.data.practice.id })
      return result
    }
    case 'session.reopen': {
      const result = await application.reopenAtomicPractice(sessionId, payload.practiceId)
      dispatchAgent(eventBridge, sessionId, { type: 'practice.continue', practiceId: result.resource.data.practice.id })
      return result
    }
    case 'session.finish': {
      const current = await selected(application, sessionId)
      await consumeCard(application, sessionId, payload)
      if (current.data.practice.mode === 'leetcode') return application.completeAtomicPractice(sessionId)
      dispatchAgent(eventBridge, sessionId, { type: 'practice.summarize', practiceId: current.practiceId })
      return current.result
    }
    case 'practice.update':
      return application.updatePractice(payload.practiceId, practiceInput(payload))
    case 'question.open':
      return application.getQuestion(payload.practiceId, payload.questionId)
    case 'question.focus': {
      await application.bindAtomicPractice(sessionId, payload.practiceId)
      const result = await application.focusAtomicQuestion(sessionId, payload.questionId)
      dispatchAgent(eventBridge, sessionId, {
        type: 'question.show', practiceId: result.references.practiceId, questionId: result.references.questionId,
      })
      return result
    }
    case 'question.update':
      return application.updateQuestion(payload.practiceId, payload.questionId, { prompt: payload.prompt })
    case 'question.delete':
      return application.deleteQuestion(payload.practiceId, payload.questionId)
    case 'question.retry': {
      await consumeCard(application, sessionId, payload)
      const result = await application.focusAtomicQuestion(sessionId, payload.questionId)
      dispatchAgent(eventBridge, sessionId, {
        type: 'question.show', practiceId: result.references.practiceId, questionId: result.references.questionId,
      })
      return result
    }
    case 'question.reveal': {
      const current = await selected(application, sessionId)
      const questionId = payload.questionId || current.questionId
      const question = current.data.practice.questions.find((item) => item.id === questionId)
      if (!question) throw new TypeError(`找不到题目：${String(questionId)}`)
      await consumeCard(application, sessionId, payload)
      dispatchAgent(eventBridge, sessionId, {
        type: question.explanation ? 'review.show' : 'review.generate',
        practiceId: current.practiceId,
        questionId,
      })
      return application.readAtomicSession(sessionId)
    }
    case 'question.next': {
      const current = await selected(application, sessionId)
      await consumeCard(application, sessionId, payload)
      if (current.data.practice.mode === 'leetcode') {
        const question = await application.drawNextAtomicLeetcode(sessionId)
        dispatchAgent(eventBridge, sessionId, {
          type: 'question.show', practiceId: question.references.practiceId, questionId: question.references.questionId,
        })
        return application.readAtomicSession(sessionId)
      }
      dispatchAgent(eventBridge, sessionId, { type: 'question.generate', practiceId: current.practiceId })
      return application.readAtomicSession(sessionId)
    }
    case 'leetcode.set-completion':
      return application.setLeetcodeProblemCompletion(payload.slug, payload.completed)
    case 'library.delete':
      return application.deletePractice(payload.practiceId, sessionId)
    case 'library.export':
      return application.exportPractices({ practiceIds: payload.practiceIds, scope: payload.scope, include: payload.include })
    default:
      throw new TypeError(`不支持的 UI command：${String(command)}`)
  }
}
