import { InterviewApplication } from '../../application/interview-application.js'
import { MarkdownPracticeExporter } from '../../infrastructure/markdown-practice-exporter.js'
import { SqliteInterviewRepository } from '../../infrastructure/sqlite-interview-repository.js'
import { createSystemPorts } from '../../infrastructure/system-ports.js'
import { registerApiRoutes } from '../http/api-routes.js'
import { AgentEventBridge } from './agent-event-bridge.js'
import { createAtomicToolDefinitions } from './atomic-tool-definitions.js'
import { ModeToolCatalog } from './mode-tool-catalog.js'
import { createPresentationToolDefinitions } from './presentation-tool-definitions.js'

export const name = 'dsh-interview'
export const inject = ['tools', 'agents']

export function createRuntime(ctx, options = {}) {
  const repository = options.repository || new SqliteInterviewRepository(options.databasePath)
  const exporter = options.exporter || new MarkdownPracticeExporter({ outputDirectory: options.exportDirectory })
  const system = createSystemPorts()
  const application = options.application || new InterviewApplication({
    repository,
    exporter,
    events: options.events || system.events,
    clock: options.clock || system.clock,
    ids: options.ids || system.ids,
    random: options.random || system.random,
  })
  const toolCatalog = new ModeToolCatalog({ context: ctx, application })
  const eventBridge = new AgentEventBridge(ctx, toolCatalog)
  return {
    application,
    repository,
    exporter,
    eventBridge,
    toolCatalog,
  }
}

export function apply(ctx) {
  const runtime = createRuntime(ctx)
  for (const tool of createAtomicToolDefinitions(runtime.application, {
    onComplete: (sessionId) => runtime.toolCatalog.refresh(sessionId),
  })) ctx.tools.register(tool)
  for (const tool of createPresentationToolDefinitions(runtime.application)) ctx.tools.register(tool)

  for (const agent of ctx.agents.list()) runtime.toolCatalog.attach(agent)
  ctx.on('agent/created', ({ agent }) => runtime.toolCatalog.attach(agent))
  ctx.on('agent/disposed', ({ agent }) => runtime.toolCatalog.detach(agent))

  ctx.inject(['webServer'], (hostCtx) => {
    registerApiRoutes(hostCtx, runtime)
  })

  ctx.effect?.(() => () => runtime.repository.close?.())
}
