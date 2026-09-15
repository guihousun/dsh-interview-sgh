import { INTERACTION_PROTOCOL } from '../protocol/interaction-protocol.js'
import { createInteractionArtifact } from './interaction-artifact.js'

let presentationSequence = 0

function nextPresentationId() {
  return globalThis.crypto?.randomUUID?.() || `presentation-${Date.now()}-${++presentationSequence}`
}

export function createPresentationResult({
  kind, references = {}, resource = null, revision = 0, text,
  materialsFence = '', assistantInstruction = '',
}) {
  const presentationId = nextPresentationId()
  return {
    protocol: INTERACTION_PROTOCOL,
    action: `presentation.${kind}`,
    revision,
    artifact: createInteractionArtifact(kind, { ...references, presentationId }),
    assistantResponse: {
      mode: 'exact',
      text,
      mustNotRepeatArtifact: true,
    },
    assistantInstruction: assistantInstruction || `立即结束工具链，最终回复必须且只能是“${text}”，禁止复述卡片内容。`,
    ...(materialsFence ? { materialsFence } : {}),
    resource,
    events: [],
  }
}
