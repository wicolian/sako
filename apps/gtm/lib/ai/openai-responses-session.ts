import { getAIContext } from './context'
import { appendTurn, getSessionByRunId } from './session-manager'

interface SessionTransportOptions {
  model: unknown
  prompt?: unknown
  system?: unknown
}

function canUseResponsesSession(model: unknown): boolean {
  if (!process.env.OPENAI_RESPONSES_SESSION_ENABLED) {
    return false
  }

  return typeof model === 'string' && model.startsWith('openai/')
}

export async function maybeRecordResponsesSessionTurn(
  options: SessionTransportOptions,
): Promise<void> {
  const context = getAIContext()
  if (!context?.session || context.session.mode !== 'openai_responses') {
    return
  }

  if (!canUseResponsesSession(options.model)) {
    return
  }

  const session = await getSessionByRunId(context.session.runId, context.workspaceId)
  if (session) {
    await appendTurn(session.sessionId, {
      prompt: options.prompt,
      system: options.system,
    })
  }
}
