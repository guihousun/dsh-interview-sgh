import { LEETCODE_LANGUAGE_IDS } from '../../domain/leetcode-languages.js'
import { createAtomicOperationResult } from '../../protocol/atomic-operation-protocol.js'
import {
  ATOMIC_ANSWER_POLICY,
  ATOMIC_CONFIGURATION_POLICY,
  ATOMIC_INTERVIEW_POLICY,
  ATOMIC_QUESTION_POLICY,
  ATOMIC_REVIEW_POLICY,
  modeContextForMode,
} from './atomic-prompt-policy.js'

const output = {
  schema: { type: 'object', additionalProperties: true },
  render: (_args, result) => [{ type: 'text', text: JSON.stringify(result, null, 2) }],
}

function sessionIdOf(exec) {
  const sessionId = exec?.agent?.session?.header?.id || exec?.agent?.session?.id
  if (typeof sessionId !== 'string' || !sessionId.trim()) throw new TypeError('DSH 会话 ID 缺失')
  return sessionId.trim()
}

function configOf(args) {
  if (args.mode === 'mock') {
    return {
      resume: args.resume,
      targetRole: args.target_role,
      jobDescriptionProvided: args.job_description_provided,
      jobDescription: args.job_description,
      interviewerStyle: args.interviewer_style,
      coding: args.coding,
      difficulty: args.difficulty,
    }
  }
  if (args.mode === 'resume_drill') {
    return {
      resume: args.resume,
      targetRole: args.target_role,
      jobDescriptionProvided: args.job_description_provided,
      jobDescription: args.job_description,
      focus: args.focus,
      difficulty: args.difficulty,
    }
  }
  if (args.mode === 'leetcode') return { language: args.language }
  return { topic: args.topic }
}

function atomicTool({ name, description, parameters, execute, afterExecute = null }) {
  return (application) => ({
    name,
    description: `${description}${ATOMIC_INTERVIEW_POLICY}`,
    parameters,
    output,
    async execute(args, exec) {
      const operation = `${name}.${args?.operation || 'unknown'}`
      const sessionId = sessionIdOf(exec)
      const result = await execute(application, args || {}, sessionId)
      await afterExecute?.({ application, args: args || {}, result, sessionId })
      return createAtomicOperationResult(operation, result)
    },
  })
}

function attachModeContext(result, mode) {
  return {
    ...result,
    instruction: `${result.instruction}当前练习已激活${modeContextForMode(mode)}后续操作只需遵守这份模式上下文，不要重复注入其他模式规则。`,
  }
}

const practiceParameters = {
  type: 'object',
  properties: {
    operation: { type: 'string', enum: ['create', 'read', 'list', 'update', 'complete', 'reopen', 'delete', 'export', 'insights'] },
    practice_id: { type: 'string', minLength: 1 },
    mode: { type: 'string', enum: ['bagu', 'mock', 'resume_drill', 'scenario', 'leetcode'] },
    topic: { type: 'string', minLength: 1 },
    language: { type: 'string', enum: LEETCODE_LANGUAGE_IDS },
    resume: { type: 'string', minLength: 1 },
    target_role: { type: 'string', minLength: 1 },
    job_description_provided: { type: 'boolean' },
    job_description: { type: 'string', minLength: 1 },
    interviewer_style: { type: 'string', minLength: 1 },
    coding: { type: 'boolean' },
    focus: { type: 'string', minLength: 1 },
    difficulty: { type: 'string', enum: ['junior', 'intermediate', 'senior'] },
    status: { type: 'string', enum: ['active', 'completed'] },
    query: { type: 'string' },
    overall: { type: 'string', minLength: 1 },
    strengths: { type: 'array', items: { type: 'string', minLength: 1 } },
    improvements: { type: 'array', items: { type: 'string', minLength: 1 } },
    practice_ids: { type: 'array', items: { type: 'string', minLength: 1 } },
    scope: { type: 'string', enum: ['selected', 'all'] },
    include: { type: 'array', items: { type: 'string', enum: ['metadata', 'questions', 'answers', 'evaluations', 'explanations', 'summary'] } },
  },
  required: ['operation'],
  additionalProperties: false,
}

const questionParameters = {
  type: 'object',
  properties: {
    operation: { type: 'string', enum: ['create', 'read', 'list', 'update', 'delete', 'focus', 'draw_hot100'] },
    practice_id: { type: 'string', minLength: 1 },
    question_id: { type: 'string', minLength: 1 },
    prompt: { type: 'string', minLength: 1, maxLength: 120 },
  },
  required: ['operation'],
  additionalProperties: false,
}

function definitionsFor(afterExecute = null) {
  const syncCatalog = afterExecute ? ({ sessionId }) => afterExecute(sessionId) : null
  return [
  atomicTool({
    name: 'interview_session',
    description: '读取当前会话绑定与派生状态，或把一条进行中练习绑定到当前会话。用户说继续时先 read，再根据真实数据自行组合后续原子操作；不存在继续宏命令。',
    parameters: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['read', 'bind'] },
        practice_id: { type: 'string', minLength: 1 },
      },
      required: ['operation'],
      additionalProperties: false,
    },
    afterExecute: syncCatalog,
    execute(application, args, sessionId) {
      if (args.operation === 'read') return application.readAtomicSession(sessionId)
      return application.bindAtomicPractice(sessionId, args.practice_id).then((result) => (
        attachModeContext(result, result.resource.data.practice.mode)
      ))
    },
  }),
  atomicTool({
    name: 'interview_practice',
    description: `对练习执行原子增删改查、结束、重新打开、导出或洞察。create/update 必须提供所选模式的完整显式配置；背八股、简历押题和场景题 complete 必须提供真实总结，模拟面试 complete 只结束并归档问答记录，刷力扣使用固定汇总。${ATOMIC_CONFIGURATION_POLICY}`,
    parameters: practiceParameters,
    afterExecute: syncCatalog,
    execute(application, args, sessionId) {
      const input = { mode: args.mode, config: configOf(args) }
      switch (args.operation) {
        case 'create': return application.createAtomicPractice(sessionId, input).then((result) => (
          attachModeContext(result, result.resource.data.mode)
        ))
        case 'read': return application.getPractice(args.practice_id)
        case 'list': return application.listPractices({ query: args.query, mode: args.mode, status: args.status })
        case 'update': return application.updatePractice(args.practice_id, input)
        case 'complete': return application.completeAtomicPractice(sessionId, {
          overall: args.overall, strengths: args.strengths, improvements: args.improvements,
        })
        case 'reopen': return application.reopenAtomicPractice(sessionId, args.practice_id)
        case 'delete': return application.deletePractice(args.practice_id, sessionId)
        case 'export': return application.exportPractices({ practiceIds: args.practice_ids, scope: args.scope, include: args.include })
        case 'insights': return application.getInsights()
        default: throw new TypeError(`不支持的练习操作：${String(args.operation)}`)
      }
    },
  }),
  atomicTool({
    name: 'interview_question',
    description: `对题目执行原子创建、读取、列表、修改、删除、聚焦或从固定 Hot 100 抽取模拟面试手撕题。create 会把新题设为当前题；delete 当前题后可继续 create 完成重新出题；focus 用于重新作答历史题。${ATOMIC_QUESTION_POLICY}`,
    parameters: questionParameters,
    afterExecute: syncCatalog,
    async execute(application, args, sessionId) {
      switch (args.operation) {
        case 'create': return application.createAtomicQuestion(sessionId, { prompt: args.prompt })
        case 'draw_hot100': return application.drawAtomicMockCodingQuestion(sessionId)
        case 'read': return application.getQuestion(args.practice_id, args.question_id)
        case 'list': return application.getPractice(args.practice_id)
        case 'update': return application.updateQuestion(args.practice_id, args.question_id, { prompt: args.prompt })
        case 'delete': return application.deleteAtomicQuestion(sessionId, args.question_id)
        case 'focus': return application.focusAtomicQuestion(sessionId, args.question_id)
        default: throw new TypeError(`不支持的题目操作：${String(args.operation)}`)
      }
    },
  }),
  atomicTool({
    name: 'interview_attempt',
    description: `创建正式作答，或读取一道题的历次作答。create 永远追加新记录，不覆盖历史。${ATOMIC_ANSWER_POLICY}`,
    parameters: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['create', 'list'] },
        practice_id: { type: 'string', minLength: 1 },
        question_id: { type: 'string', minLength: 1 },
        answer: { type: 'string', minLength: 1 },
      },
      required: ['operation', 'question_id'],
      additionalProperties: false,
    },
    afterExecute: syncCatalog,
    execute(application, args, sessionId) {
      if (args.operation === 'create') {
        return application.createAtomicAttempt(sessionId, { questionId: args.question_id, answer: args.answer })
      }
      return application.getQuestion(args.practice_id, args.question_id)
    },
  }),
  atomicTool({
    name: 'interview_evaluation',
    description: `为一条尚未评价的真实作答保存评分和点评。${ATOMIC_REVIEW_POLICY}`,
    parameters: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['create'] },
        question_id: { type: 'string', minLength: 1 },
        attempt_id: { type: 'string', minLength: 1 },
        score: { type: 'number', minimum: 0, maximum: 10 },
        feedback: { type: 'string', minLength: 1 },
        dimensions: { type: 'object', additionalProperties: { type: 'number', minimum: 0, maximum: 10 } },
      },
      required: ['operation', 'question_id', 'attempt_id', 'score', 'feedback'],
      additionalProperties: false,
    },
    afterExecute: syncCatalog,
    execute: (application, args, sessionId) => application.createAtomicEvaluation(sessionId, {
      questionId: args.question_id,
      attemptId: args.attempt_id,
      score: args.score,
      feedback: args.feedback,
      dimensions: args.dimensions,
    }),
  }),
  atomicTool({
    name: 'interview_explanation',
    description: `创建或明确替换一道题的详细讲解。memorization_points 保存当前激活模式要求的直接背或精炼解法。${ATOMIC_REVIEW_POLICY}`,
    parameters: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['create', 'replace'] },
        question_id: { type: 'string', minLength: 1 },
        detail: { type: 'string', minLength: 1 },
        memorization_points: { type: 'string', minLength: 1 },
      },
      required: ['operation', 'question_id', 'detail', 'memorization_points'],
      additionalProperties: false,
    },
    afterExecute: syncCatalog,
    execute: (application, args, sessionId) => application.createAtomicExplanation(sessionId, {
      questionId: args.question_id,
      detail: args.detail,
      memorizationPoints: args.memorization_points,
      replace: args.operation === 'replace',
    }),
  }),
  atomicTool({
    name: 'interview_leetcode',
    description: '读取力扣热题 100、从固定题库抽取当前题、原子结束旧练习并随机创建下一题，或保存用户明确指定的完成状态。AI禁止自行生成力扣题。',
    parameters: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['catalog', 'draw', 'draw_next', 'set_completion'] },
        slug: { type: 'string', minLength: 1 },
        completed: { type: 'boolean' },
      },
      required: ['operation'],
      additionalProperties: false,
    },
    afterExecute: syncCatalog,
    execute(application, args, sessionId) {
      switch (args.operation) {
        case 'catalog': return application.getLeetcodeCatalog()
        case 'draw': return application.drawAtomicLeetcode(sessionId)
        case 'draw_next': return application.drawNextAtomicLeetcode(sessionId)
        case 'set_completion': return application.setLeetcodeProblemCompletion(args.slug, args.completed, sessionId)
        default: throw new TypeError(`不支持的力扣操作：${String(args.operation)}`)
      }
    },
  }),
  ]
}

export const ATOMIC_BUSINESS_TOOL_NAMES = Object.freeze(definitionsFor().map((create) => create({}).name))

export function createAtomicToolDefinitions(application, { onComplete = null } = {}) {
  return definitionsFor(onComplete).map((create) => create(application))
}

export { sessionIdOf }
