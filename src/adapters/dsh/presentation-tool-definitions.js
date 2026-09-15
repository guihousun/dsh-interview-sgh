import { DomainError } from '../../domain/errors.js'
import { assertModeCapability } from '../../domain/mode-capabilities.js'
import { effectiveLeetcodeGuidance } from '../../domain/leetcode-guidance.js'
import { ARTIFACT_KINDS } from '../../application/interaction-artifact.js'
import { createPresentationResult } from '../../application/presentation-result.js'
import { createMaterialsFence, materialsFenceInstruction } from '../../application/leetcode-materials-fence.js'

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

async function sessionRevisionFor(application, sessionId, practiceId, questionId) {
  const session = (await application.readAtomicSession(sessionId)).resource.data
  return session.selected
    && session.practice.id === practiceId
    && session.currentQuestionId === questionId
    ? session.revision
    : null
}

const definitions = [
  presentationTool({
    name: 'interview_show_practice_setup',
    description: '展示可交互的新建练习配置卡片。用户要求新建或开始一条新练习时必须调用本工具，让用户在卡片中明确选择全部配置；禁止通过普通 Assistant Text 逐项询问配置，禁止自行填写默认值或提前创建练习。本工具只展示配置 UI，用户点击“开始练习”后才会创建练习。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute() {
      return createPresentationResult({
        kind: ARTIFACT_KINDS.PRACTICE_SETUP,
        text: '练习配置已展示，请完成配置。',
      })
    },
  }),
  presentationTool({
    name: 'interview_show_question',
    description: '展示数据库中已经存在的一道题目卡片。当用户需要查看、回答、继续或重新作答某道题，或者新题创建后需要呈现时，必须调用本工具。禁止使用普通 Assistant Text 输出或复述题目。本工具只展示，不创建、修改或聚焦题目。力扣题会同时返回 materialsFence：必须把它原样输出成对话里的 dsh-ui 材料卡；还没有材料时先用 interview_materials create 保存材料再展示。',
    parameters: practiceQuestionParameters,
    async execute(application, args, sessionId) {
      const { practice, question } = await practiceAndQuestion(application, args.practice_id, args.question_id)
      const sessionRevision = await sessionRevisionFor(application, sessionId, practice.id, question.id)
      const text = '题目已展示，请开始作答。'
      const isLeetcode = Boolean(question.leetcode)
      const fence = isLeetcode && question.materials
        ? createMaterialsFence(question, { guidance: effectiveLeetcodeGuidance(practice.config) })
        : ''
      return createPresentationResult({
        kind: ARTIFACT_KINDS.QUESTION,
        references: {
          practiceId: practice.id,
          questionId: question.id,
          ...(sessionRevision === null ? {} : { sessionRevision }),
        },
        resource: { kind: 'question-detail', data: question },
        revision: practice.updatedAt,
        text,
        materialsFence: fence,
        assistantInstruction: isLeetcode
          ? (fence
              ? `立即结束工具链。最终回复必须先原样输出 materialsFence 字段的完整内容（它已经是合法的 dsh-ui 围栏，含开头的 \`\`\`dsh-ui 和结尾的 \`\`\`），再写一句“${text}”；禁止改写、删减或重新排版围栏内容，禁止改用普通文本复述题目或材料。`
              : `立即结束工具链。这道力扣题还没有题目材料：先调用 interview_materials create 保存题意、示例、数据范围、前置知识、分级提示、常见误区和相似题，再把返回的 materialsFence 原样输出到回复正文，最后写一句“${text}”。`)
          : `立即结束工具链，最终回复必须且只能是“${text}”，禁止复述卡片内容。`,
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
    async execute(application, args, sessionId) {
      const { practice, question } = await practiceAndQuestion(application, args.practice_id, args.question_id)
      assertModeCapability(practice, 'review.show', 'REVIEW_NOT_ALLOWED', '当前模式不提供点评讲解')
      if (!question.explanation) throw new DomainError('EXPLANATION_NOT_FOUND', '当前题目还没有讲解')
      if (args.attempt_id && !question.attempts.some((item) => item.id === args.attempt_id)) {
        throw new DomainError('ATTEMPT_NOT_FOUND', `找不到作答：${String(args.attempt_id)}`)
      }
      const sessionRevision = await sessionRevisionFor(application, sessionId, practice.id, question.id)
      return createPresentationResult({
        kind: ARTIFACT_KINDS.REVIEW,
        references: {
          practiceId: practice.id,
          questionId: question.id,
          ...(args.attempt_id ? { attemptId: args.attempt_id } : {}),
          ...(sessionRevision === null ? {} : { sessionRevision }),
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
