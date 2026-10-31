import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/workspace', () => ({
  getWorkspaceContext: vi.fn(),
}))

vi.mock('@/lib/sako/client', () => ({
  createSakoTask: vi.fn(),
}))

vi.mock('@/lib/billing/entitlements', () => ({
  requireWorkspaceEntitlement: vi.fn(),
}))

function createSupabaseMock(sequenceByTable: Record<string, Array<{ data: any; error: any }>>) {
  const from = vi.fn((table: string) => {
    let op: 'select' | 'insert' | 'update' | null = null
    const next = () => {
      const queue = sequenceByTable[table] || []
      if (queue.length === 0) return { data: null, error: null }
      return queue.shift() as { data: any; error: any }
    }

    const query: any = {
      select: vi.fn(() => {
        op = 'select'
        return query
      }),
      insert: vi.fn(() => {
        op = 'insert'
        return query
      }),
      update: vi.fn(() => {
        op = 'update'
        return query
      }),
      eq: vi.fn(() => {
        if (op === 'update') {
          return Promise.resolve(next())
        }
        return query
      }),
      in: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      maybeSingle: vi.fn(async () => next()),
      single: vi.fn(async () => next()),
    }

    return query
  })

  return {
    from,
    rpc: vi.fn(async () => ({ data: null, error: null })),
  }
}

describe('Send to Sako loop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('derives stable idempotency key from workspace+document+version', async () => {
    const { deriveComposerSendIdempotencyKey } = await import('@/app/api/sako/escalate/route')

    const keyA = deriveComposerSendIdempotencyKey({
      workspaceId: 'ws-1',
      composerDocumentId: 'doc-1',
      composerVersionId: 'ver-1',
    })

    const keyB = deriveComposerSendIdempotencyKey({
      workspaceId: 'ws-1',
      composerDocumentId: 'doc-1',
      composerVersionId: 'ver-1',
    })

    const keyC = deriveComposerSendIdempotencyKey({
      workspaceId: 'ws-1',
      composerDocumentId: 'doc-1',
      composerVersionId: 'ver-2',
    })

    expect(keyA).toBe(keyB)
    expect(keyA).not.toBe(keyC)
  })

  it('returns 403 for non-send-enabled plans', async () => {
    const { getWorkspaceContext } = await import('@/lib/workspace')
    const { requireWorkspaceEntitlement } = await import('@/lib/billing/entitlements')
    const { POST } = await import('@/app/api/sako/escalate/route')

    ;(getWorkspaceContext as unknown as { mockReturnValue: (value: any) => void }).mockReturnValue({
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'member',
    })

    ;(requireWorkspaceEntitlement as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      ok: false,
      entitlements: {
        workspaceId: 'ws-1',
        planId: 'team',
        plan: {} as never,
        subscriptionStatus: 'active',
        isActive: true,
        features: {
          advancedModelPicker: false,
          apiAccess: true,
          assetExport: true,
          customTemplates: false,
          directDeploy: true,
          prioritySupport: false,
          sakoEscalation: false,
          sso: false,
          subdomainPublish: false,
        },
      },
      message: 'Send to Sako requires Growth or Enterprise.',
    })

    const request = new Request('http://localhost/api/sako/escalate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ composerDocumentId: '11111111-1111-4111-8111-111111111111' }),
    })

    const response = await POST(request as NextRequest)
    expect(response.status).toBe(403)
  })

  it('prevents cross-tenant snapshot access', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { getWorkspaceContext } = await import('@/lib/workspace')
    const { GET } = await import('@/app/api/tasks/[id]/composer-snapshot/route')

    ;(getWorkspaceContext as unknown as { mockReturnValue: (value: any) => void }).mockReturnValue({
      workspaceId: 'ws-user',
      userId: 'user-1',
      role: 'member',
    })

    ;(createServiceClient as unknown as { mockReturnValue: (value: any) => void }).mockReturnValue(
      createSupabaseMock({
        sako_tasks: [
          {
            data: { id: 'task-1', workspace_id: 'ws-other', snapshot_id: 'snap-1' },
            error: null,
          },
        ],
      }) as any
    )

    const request = new Request('http://localhost/api/tasks/task-1/composer-snapshot', {
      method: 'GET',
    })

    const response = await GET(request as NextRequest, {
      params: Promise.resolve({ id: 'task-1' }),
    })

    expect(response.status).toBe(404)
  })

  it('writes feedback events on lifecycle completion', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { transitionTaskStatus } = await import('@/lib/sako/task-manager')

    const taskRow = {
      id: 'task-1',
      campaign_id: 'campaign-1',
      workspace_id: 'ws-1',
      type: 'design_refinement',
      status: 'in_progress',
      priority: 'normal',
      title: 'Test task',
      brief: 'Test brief',
      current_html: '<html></html>',
      assigned_to: null,
      estimated_delivery: null,
      deliverables: [],
      metadata: {},
      created_at: new Date(Date.now() - 60_000).toISOString(),
      updated_at: new Date().toISOString(),
    }

    const supabase = createSupabaseMock({
      sako_tasks: [
        { data: taskRow, error: null },
        { data: null, error: null },
        {
          data: {
            ...taskRow,
            status: 'completed',
          },
          error: null,
        },
      ],
    })

    ;(createServiceClient as unknown as { mockReturnValue: (value: any) => void }).mockReturnValue(
      supabase as any
    )

    await transitionTaskStatus({
      taskId: 'task-1',
      status: 'completed',
      actorId: 'user-1',
      outcome: 'accepted',
      notes: 'Looks good',
    })

    const rpcCalls = (supabase.rpc as any).mock.calls
    const eventTypes = rpcCalls.map((call: any[]) => call[1]?.p_event_type)

    expect(eventTypes).toContain('task_completed')
    expect(eventTypes).toContain('task_accepted')
  })
})
