import { randomUUID } from 'crypto'

export interface OpenAIResponsesSessionState {
  sessionId: string
  runId: string
  workspaceId: string
  snapshotId: string
  createdAt: number
  lastTouchedAt: number
  deltas: Array<{
    inputDelta: unknown
    toolResult?: unknown
    createdAt: number
  }>
}

const SESSION_TTL_MS = 15 * 60 * 1000
const sessions = new Map<string, OpenAIResponsesSessionState>()

function pruneExpiredSessions(): void {
  const now = Date.now()
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastTouchedAt > SESSION_TTL_MS) {
      sessions.delete(id)
    }
  }
}

export async function acquireSession(
  runId: string,
  workspaceId: string,
  snapshotId: string,
): Promise<OpenAIResponsesSessionState> {
  pruneExpiredSessions()
  const existing = [...sessions.values()].find(
    (session) => session.runId === runId && session.workspaceId === workspaceId,
  )

  if (existing) {
    existing.lastTouchedAt = Date.now()
    return existing
  }

  const created: OpenAIResponsesSessionState = {
    sessionId: randomUUID(),
    runId,
    workspaceId,
    snapshotId,
    createdAt: Date.now(),
    lastTouchedAt: Date.now(),
    deltas: [],
  }
  sessions.set(created.sessionId, created)
  return created
}

export async function appendTurn(
  sessionId: string,
  inputDelta: unknown,
  toolResult?: unknown,
): Promise<OpenAIResponsesSessionState | null> {
  pruneExpiredSessions()
  const session = sessions.get(sessionId)
  if (!session) {
    return null
  }

  session.deltas.push({
    inputDelta,
    toolResult,
    createdAt: Date.now(),
  })
  session.lastTouchedAt = Date.now()
  return session
}

export async function releaseSession(sessionId: string): Promise<void> {
  sessions.delete(sessionId)
}

export async function getSession(sessionId: string): Promise<OpenAIResponsesSessionState | null> {
  pruneExpiredSessions()
  return sessions.get(sessionId) ?? null
}

export async function getSessionByRunId(
  runId: string,
  workspaceId: string,
): Promise<OpenAIResponsesSessionState | null> {
  pruneExpiredSessions()
  return (
    [...sessions.values()].find(
      (session) => session.runId === runId && session.workspaceId === workspaceId,
    ) ?? null
  )
}
