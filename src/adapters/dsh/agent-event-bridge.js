import { modeContextForMode } from './atomic-prompt-policy.js'

function pluginMessage(text) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `dsh-interview-${Date.now()}`,
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'plugin', plugin: 'dsh-interview' },
  }
}

const END = '完成工具调用后立即结束工具链，只输出展示工具规定的简短辅助文本；禁止用普通 Assistant Text 复述题目、点评、讲解或总结。'

function activeModeContext(event) {
  return event.includeModeContext ? `${modeContextForMode(event.mode)}当前练习配置和历史必须通过读取能力获得。` : ''
}

function instructionFor(event) {
  const practice = `practice_id=${event.practiceId}`
  const question = event.questionId ? `，question_id=${event.questionId}` : ''
  switch (event.type) {
    case 'question.generate':
      return `${activeModeContext(event)}练习 UI 请求生成一道新题。${practice}，phase=question。先调用 interview_session read 读取当前练习的真实配置与全部历史。完成对应原子操作后，用 interview_show_question 展示刚创建或抽取的题目。${END}`
    case 'question.show':
      return `${activeModeContext(event)}练习 UI 请求展示已保存题目。${practice}${question}。只调用 interview_show_question 展示该题，不执行任何业务修改。${END}`
    case 'review.generate':
      return `${activeModeContext(event)}练习 UI 请求当前题讲解。${practice}${question}，phase=reveal。调用 interview_practice read 读取真实配置与完整上下文。调用 interview_explanation create 保存，然后调用 interview_show_review 展示。直接看答案不创建作答、评价或评分。${END}`
    case 'review.show':
      return `练习 UI 请求展示已保存的点评讲解。${practice}${question}。只调用 interview_show_review，不执行任何业务修改。${END}`
    case 'practice.summarize':
      return `${activeModeContext(event)}练习 UI 请求结束练习。${practice}，phase=summary。调用 interview_practice read 读取真实配置、全部题目、历次作答、评价与讲解。只基于真实记录生成当前模式要求的总结，调用 interview_practice complete 保存，最后调用 interview_show_summary 展示。禁止继续出题。${END}`
    case 'practice.selected':
      return `${activeModeContext(event)}练习已由后端绑定到当前会话。只回复“已切换到当前练习。”，不要出题、展示卡片或执行其他工具。`
    case 'practice.continue':
      return `${activeModeContext(event)}用户请求继续当前练习。${practice}。先调用 interview_session read，并使用返回的真实配置与历史。根据数据组合原子操作：没有题目则创建或抽取并展示题目；当前题尚可回答则只展示当前题；有未评价作答则生成并保存评价，再生成并保存讲解，最后展示点评讲解；已有讲解则展示点评讲解。不要把“继续”固定等同于“下一题”。${END}`
    default:
      return null
  }
}

export class AgentEventBridge {
  constructor(ctx) {
    this.ctx = ctx
  }

  dispatch(sessionId, event) {
    const text = instructionFor(event)
    if (!text) return false
    const agent = this.ctx.get('agents')?.get?.(sessionId)
    if (!agent?.followup) return false
    try {
      agent.followup(pluginMessage(text))
      return true
    } catch (error) {
      this.ctx.logger?.warn?.(`dsh-interview: 一次性 UI 请求投递失败：${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }
}

export { instructionFor }
