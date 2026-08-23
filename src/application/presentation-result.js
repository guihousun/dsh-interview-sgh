import { INTERACTION_PROTOCOL } from '../protocol/interaction-protocol.js'
import { createInteractionArtifact } from './interaction-artifact.js'

export function createPresentationResult({ kind, references = {}, resource = null, revision = 0, text }) {
  return {
    protocol: INTERACTION_PROTOCOL,
    action: `presentation.${kind}`,
    revision,
    artifact: createInteractionArtifact(kind, references),
    assistantResponse: {
      mode: 'exact',
      text,
      mustNotRepeatArtifact: true,
    },
    assistantInstruction: `立即结束工具链，最终回复必须且只能是“${text}”，禁止复述卡片内容。`,
    resource,
    events: [],
  }
}
