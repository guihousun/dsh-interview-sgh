import { DomainError } from '../../domain/errors.js'
import { ARTIFACT_KINDS } from '../../application/interaction-artifact.js'
import { createPresentationResult } from '../../application/presentation-result.js'

const output = {
  schema: { type: 'object', additionalProperties: true },
  render: (_args, result) => [{ type: 'text', text: JSON.stringify(result, null, 2) }],
}

function requiredId(value, name) {
  const id = typeof value === 'string' ? value.trim() : ''
  if (!id) throw new TypeError(`${name} 不能为空`)
  return id
}

function sessionIdOf(exec) {
  const sessionId = exec?.agent?.session?.header?.id || exec?.agent?.session?.id
  if (typeof sessionId !== 'string' || !sessionId.trim()) throw new TypeError('DSH 会话 ID 缺失')
  return sessionId.trim()
}

function presentationTool({ name, description, parameters, execute }) {
  return (application) => ({ name, description, parameters, output, execute: (args, exec) => execute(application, args || {}, sessionIdOf(exec)) })
}

const practiceQuestionParameters = {
  type: 'object',
  properties: {
    practice_id: { type: 'string', minLength: 1 },
    question_id: { type: 'string', minLength: 1 },
  },
  required: ['practice_id', 'question_id'],
  additionalProperties: false,
}

async function practiceAndQuestion(application, practiceId, questionId) {
  const result = await application.getPractice(requiredId(practiceId, 'practice_id'))
  const question = result.resource.data.questions.find((item) => item.id === requiredId(questionId, 'question_id'))
  if (!question) throw new DomainError('QUESTION_NOT_FOUND', `找不到题目：${String(questionId)}`)
  return { practice: result.resource.data, question }
}

const definitions = [
  presentationTool({
    name: 'interview_show_question',
    description: '展示数据库中已经存在的一道题目卡片。当用户需要查看、回答、继续或重新作答某道题，或者新题创建后需要呈现时，必须调用本工具。禁止使用普通 Assistant Text 输出或复述题目。本工具只展示，不创建、修改或聚焦题目。',
    parameters: practiceQuestionParameters,
    async execute(application, args) {
      const { practice, question } = await practiceAndQuestion(application, args.practice_id, args.question_id)
      return createPresentationResult({
        kind: ARTIFACT_KINDS.QUESTION,
        references: { practiceId: practice.id, questionId: question.id },
        resource: { kind: 'question-detail', data: question },
        revision: practice.updatedAt,
        text: '题目已展示，请开始作答。',
      })
    },
  }),
  presentationTool({
    name: 'interview_show_review',
    description: '展示数据库中已经保存的点评讲解卡片。当用户需要查看评分、点评、答案、详细讲解或直接背时，必须调用本工具。禁止使用普通 Assistant Text 输出或复述这些内容。本工具只展示，不生成、不保存评价或讲解。',
    parameters: {
      type: 'object',
      properties: {
        practice_id: { type: 'string', minLength: 1 },
        question_id: { type: 'string', minLength: 1 },
        attempt_id: { type: 'string', minLength: 1 },
      },
      required: ['practice_id', 'question_id'],
      additionalProperties: false,
    },
    async execute(application, args) {
      const { practice, question } = await practiceAndQuestion(application, args.practice_id, args.question_id)
      if (!question.explanation) throw new DomainError('EXPLANATION_NOT_FOUND', '当前题目还没有讲解')
      if (args.attempt_id && !question.attempts.some((item) => item.id === args.attempt_id)) {
        throw new DomainError('ATTEMPT_NOT_FOUND', `找不到作答：${String(args.attempt_id)}`)
      }
      return createPresentationResult({
        kind: ARTIFACT_KINDS.REVIEW,
        references: {
          practiceId: practice.id,
          questionId: question.id,
          ...(args.attempt_id ? { attemptId: args.attempt_id } : {}),
        },
        resource: { kind: 'question-detail', data: question },
        revision: practice.updatedAt,
        text: '点评讲解已展示。',
      })
    },
  }),
  presentationTool({
    name: 'interview_show_summary',
    description: '展示数据库中已经保存的练习总结卡片。当用户结束练习并需要查看总结，或要求查看历史总结时，必须调用本工具。禁止使用普通 Assistant Text 输出或复述总结。本工具只展示，不结束练习、不生成总结。',
    parameters: {
      type: 'object',
      properties: { practice_id: { type: 'string', minLength: 1 } },
      required: ['practice_id'],
      additionalProperties: false,
    },
    async execute(application, args) {
      const result = await application.getPractice(requiredId(args.practice_id, 'practice_id'))
      const practice = result.resource.data
      if (!practice.summary) throw new DomainError('SUMMARY_NOT_FOUND', '当前练习还没有总结')
      return createPresentationResult({
        kind: ARTIFACT_KINDS.FINISHED,
        references: { practiceId: practice.id },
        resource: result.resource,
        revision: practice.updatedAt,
        text: '练习总结已展示。',
      })
    },
  }),
  presentationTool({
    name: 'interview_show_practice',
    description: '展示指定练习的档案和时间轴。当用户明确要求查看某条练习详情时必须调用本工具，禁止用普通文本复述完整档案。本工具不切换会话、不修改练习。',
    parameters: {
      type: 'object',
      properties: { practice_id: { type: 'string', minLength: 1 } },
      required: ['practice_id'],
      additionalProperties: false,
    },
    async execute(application, args) {
      const result = await application.getPractice(requiredId(args.practice_id, 'practice_id'))
      return createPresentationResult({
        kind: ARTIFACT_KINDS.LIBRARY,
        references: { practiceId: result.resource.data.id },
        resource: result.resource,
        revision: result.resource.data.updatedAt,
        text: '练习档案已展示。',
      })
    },
  }),
  presentationTool({
    name: 'interview_show_practice_list',
    description: '展示练习工作台的练习列表。当用户明确要求查看练习列表、进行中练习或练习档案时必须调用本工具，禁止使用普通文本代替列表。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute() {
      return createPresentationResult({
        kind: ARTIFACT_KINDS.LIBRARY,
        text: '练习列表已展示。',
      })
    },
  }),
  presentationTool({
    name: 'interview_show_insights',
    description: '展示全部练习计算出的能力洞察。当用户明确要求查看能力分析、薄弱项或练习洞察时必须调用本工具，禁止使用普通文本代替洞察卡片。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    async execute(application) {
      const result = await application.getInsights()
      return createPresentationResult({
        kind: ARTIFACT_KINDS.INSIGHTS,
        resource: result.resource,
        text: '能力洞察已展示。',
      })
    },
  }),
  presentationTool({
    name: 'interview_show_leetcode_catalog',
    description: '展示力扣热题 100 列表。当用户明确要求查看题目列表、完成进度或题型分组时必须调用本工具，禁止使用普通文本代替目录 UI。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    async execute(application) {
      const result = await application.getLeetcodeCatalog()
      return createPresentationResult({
        kind: ARTIFACT_KINDS.LEETCODE_CATALOG,
        resource: result.resource,
        text: '力扣热题 100 已展示。',
      })
    },
  }),
]

export const PRESENTATION_TOOL_NAMES = Object.freeze(definitions.map((create) => create({}).name))

export function createPresentationToolDefinitions(application) {
  return definitions.map((create) => create(application))
}
