import { assertModeCapability } from '../../domain/mode-capabilities.js'

function practiceInput(payload) {
  return { mode: payload.mode, config: payload.config }
}

// 自由选题：题号、题名、slug 是「就做这道题」，题型和难度是「按条件抽一道」。
function selectionOf(payload) {
  if (!payload) return null
  if (!payload.slug && !payload.number && !payload.title) return null
  return { slug: payload.slug, number: payload.number, title: payload.title }
}

function filtersOf(payload) {
  if (!payload) return null
  if (!payload.category && !payload.difficulty) return null
  return { category: payload.category, difficulty: payload.difficulty }
}

function leetcodeRequestOf(payload) {
  const source = payload?.problem || payload?.selection || payload
  return { selection: selectionOf(source), filters: filtersOf(source) }
}

function guidanceOf(practice) {
  return practice?.config?.guidance || null
}

function dispatchAgent(eventBridge, sessionId, event) {
  eventBridge?.dispatch(sessionId, event)
}

function refreshAgentTools(eventBridge, sessionId) {
  void eventBridge?.refresh?.(sessionId)
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
  'question.retry', 'question.reveal', 'question.hint', 'question.materials',
  'leetcode.select', 'leetcode.set-completion', 'library.delete', 'library.export',
])

export async function dispatchCommand({ application, eventBridge }, sessionId, command, payload = {}) {
  switch (command) {
    case 'session.start': {
      await application.createAtomicPractice(sessionId, practiceInput(payload))
      let session = await application.readAtomicSession(sessionId)
      if (payload.mode === 'leetcode') {
        const request = leetcodeRequestOf(payload)
        const question = await application.drawAtomicLeetcode(sessionId, request)
        dispatchAgent(eventBridge, sessionId, {
          type: 'leetcode.present', practiceId: question.references.practiceId, questionId: question.references.questionId,
          mode: payload.mode, guidance: guidanceOf(session.resource.data.practice), includeModeContext: true,
        })
        session = await application.readAtomicSession(sessionId)
      } else {
        dispatchAgent(eventBridge, sessionId, {
          type: 'question.generate', practiceId: session.resource.data.practice.id, mode: session.resource.data.practice.mode,
          includeModeContext: true,
        })
      }
      return session
    }
    case 'leetcode.select': {
      const request = leetcodeRequestOf(payload)
      const current = (await application.readAtomicSession(sessionId)).resource.data
      const activeLeetcode = current.selected && current.practice.mode === 'leetcode' && current.practice.status === 'active'
      if (!activeLeetcode) {
        await application.createAtomicPractice(sessionId, { mode: 'leetcode', config: payload.config })
      }
      const question = activeLeetcode
        ? await application.drawNextAtomicLeetcode(sessionId, request)
        : await application.drawAtomicLeetcode(sessionId, request)
      const session = await application.readAtomicSession(sessionId)
      dispatchAgent(eventBridge, sessionId, {
        type: 'leetcode.present', practiceId: question.references.practiceId, questionId: question.references.questionId,
        mode: 'leetcode', guidance: guidanceOf(session.resource.data.practice), includeModeContext: true,
      })
      refreshAgentTools(eventBridge, sessionId)
      return session
    }
    case 'session.continue': {
      const current = await selected(application, sessionId)
      dispatchAgent(eventBridge, sessionId, {
        type: 'practice.continue', practiceId: current.practiceId, mode: current.data.practice.mode,
      })
      return current.result
    }
    case 'session.select': {
      const result = await application.bindAtomicPractice(sessionId, payload.practiceId)
      dispatchAgent(eventBridge, sessionId, {
        type: 'practice.selected', practiceId: result.resource.data.practice.id,
        mode: result.resource.data.practice.mode, guidance: guidanceOf(result.resource.data.practice), includeModeContext: true,
      })
      return result
    }
    case 'session.reopen': {
      const result = await application.reopenAtomicPractice(sessionId, payload.practiceId)
      dispatchAgent(eventBridge, sessionId, {
        type: 'practice.continue', practiceId: result.resource.data.practice.id, mode: result.resource.data.practice.mode,
        guidance: guidanceOf(result.resource.data.practice), includeModeContext: true,
      })
      return result
    }
    case 'session.finish': {
      const current = await selected(application, sessionId)
      await consumeCard(application, sessionId, payload)
      if (current.data.practice.mode === 'leetcode' || current.data.practice.mode === 'mock') {
        const result = await application.completeAtomicPractice(sessionId)
        refreshAgentTools(eventBridge, sessionId)
        return result
      }
      dispatchAgent(eventBridge, sessionId, {
        type: 'practice.summarize', practiceId: current.practiceId, mode: current.data.practice.mode,
      })
      return current.result
    }
    case 'practice.update': {
      const result = await application.updatePractice(payload.practiceId, practiceInput(payload))
      refreshAgentTools(eventBridge, sessionId)
      return result
    }
    case 'question.open':
      return application.getQuestion(payload.practiceId, payload.questionId)
    case 'question.focus': {
      await application.bindAtomicPractice(sessionId, payload.practiceId)
      const result = await application.focusAtomicQuestion(sessionId, payload.questionId)
      const session = await application.readAtomicSession(sessionId)
      dispatchAgent(eventBridge, sessionId, {
        type: 'question.show', practiceId: result.references.practiceId, questionId: result.references.questionId,
        mode: session.resource.data.practice.mode, guidance: guidanceOf(session.resource.data.practice), includeModeContext: true,
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
      assertModeCapability(current.data.practice, 'explanation.create', 'REVEAL_NOT_ALLOWED', '当前模式不提供看答案')
      await consumeCard(application, sessionId, payload)
      dispatchAgent(eventBridge, sessionId, {
        type: question.explanation ? 'review.show' : 'review.generate',
        practiceId: current.practiceId,
        questionId,
        mode: current.data.practice.mode,
        guidance: guidanceOf(current.data.practice),
      })
      return application.readAtomicSession(sessionId)
    }
    case 'question.next': {
      const current = await selected(application, sessionId)
      await consumeCard(application, sessionId, payload)
      if (current.data.practice.mode === 'leetcode') {
        const question = await application.drawNextAtomicLeetcode(sessionId, leetcodeRequestOf(payload))
        dispatchAgent(eventBridge, sessionId, {
          type: 'leetcode.present', practiceId: question.references.practiceId, questionId: question.references.questionId,
          mode: 'leetcode', guidance: guidanceOf(current.data.practice),
        })
        return application.readAtomicSession(sessionId)
      }
      dispatchAgent(eventBridge, sessionId, {
        type: 'question.generate', practiceId: current.practiceId, mode: current.data.practice.mode,
      })
      return application.readAtomicSession(sessionId)
    }
    case 'question.hint': {
      const current = await selected(application, sessionId)
      const questionId = payload.questionId || current.questionId
      const question = current.data.practice.questions.find((item) => item.id === questionId)
      if (!question) throw new TypeError(`找不到题目：${String(questionId)}`)
      assertModeCapability(current.data.practice, 'materials.reveal', 'HINTS_NOT_ALLOWED', '当前模式不提供提示阶梯')
      if (!question.materials) {
        dispatchAgent(eventBridge, sessionId, {
          type: 'materials.generate', practiceId: current.practiceId, questionId,
          mode: current.data.practice.mode, guidance: guidanceOf(current.data.practice),
        })
        return { ...current.result, resource: { kind: 'materials-pending', data: { questionId } } }
      }
      return application.revealAtomicHint(sessionId, questionId)
    }
    case 'question.materials': {
      const current = await selected(application, sessionId)
      const questionId = payload.questionId || current.questionId
      const question = current.data.practice.questions.find((item) => item.id === questionId)
      if (!question) throw new TypeError(`找不到题目：${String(questionId)}`)
      assertModeCapability(current.data.practice, 'materials.create', 'MATERIALS_NOT_ALLOWED', '当前模式不提供题目材料')
      dispatchAgent(eventBridge, sessionId, {
        type: 'materials.generate', practiceId: current.practiceId, questionId,
        mode: current.data.practice.mode, guidance: guidanceOf(current.data.practice),
      })
      return { ...current.result, resource: { kind: 'materials-pending', data: { questionId } } }
    }
    case 'leetcode.set-completion':
      return application.setLeetcodeProblemCompletion(payload.slug, payload.completed)
    case 'library.delete': {
      const result = await application.deletePractice(payload.practiceId, sessionId)
      refreshAgentTools(eventBridge, sessionId)
      return result
    }
    case 'library.export':
      return application.exportPractices({ practiceIds: payload.practiceIds, scope: payload.scope, include: payload.include })
    default:
      throw new TypeError(`不支持的 UI command：${String(command)}`)
  }
}
