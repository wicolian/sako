import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/workspace', () => ({
  getWorkspaceContext: vi.fn(),
  handleWorkspaceError: vi.fn(() => new Response(JSON.stringify({ error: 'workspace error' }), { status: 500 })),
}))

vi.mock('@/lib/billing/entitlements', () => ({
  requireWorkspaceEntitlement: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/publish/subdomain-publisher', () => ({
  getPublishedUrl: vi.fn((subdomain: string) => `https://${subdomain}.example.com`),
}))

vi.mock('@/lib/storage/r2', () => ({
  uploadFile: vi.fn(),
}))

vi.mock('@/lib/claims/compliance-gate', () => ({
  checkCampaignComplianceGate: vi.fn(),
  checkComplianceGate: vi.fn(),
}))

vi.mock('@/lib/billing/usage', () => ({
  incrementUsage: vi.fn(),
}))

function createServerSupabaseMock(workspaceId = 'ws-1') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: vi.fn((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { workspace_id: workspaceId } }),
            })),
          })),
        }
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
      }
    }),
  }
}

describe('route entitlement gates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks API key listing for free plans', async () => {
    const { getWorkspaceContext } = await import('@/lib/workspace')
    const { requireWorkspaceEntitlement } = await import('@/lib/billing/entitlements')
    const { GET } = await import('@/app/api/api-keys/route')

    ;(getWorkspaceContext as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'admin',
    })

    ;(requireWorkspaceEntitlement as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      ok: false,
      entitlements: {
        workspaceId: 'ws-1',
        planId: 'free',
        plan: {} as never,
        subscriptionStatus: 'active',
        isActive: true,
        features: {
          advancedModelPicker: false,
          apiAccess: false,
          assetExport: false,
          customTemplates: false,
          directDeploy: false,
          prioritySupport: false,
          sakoEscalation: false,
          sso: false,
          subdomainPublish: false,
        },
      },
      message: 'ClaimsOS API keys require an active paid plan.',
    })

    const request = new Request('http://localhost/api/api-keys')
    const response = await GET(request as NextRequest)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.planId).toBe('free')
    expect(data.error).toContain('paid plan')
  })

  it('blocks hosted publish for non-growth workspaces', async () => {
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const { requireWorkspaceEntitlement } = await import('@/lib/billing/entitlements')
    const { POST } = await import('@/app/api/publish/route')

    ;(createServerSupabaseClient as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(createServerSupabaseMock() as never)
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
      message: 'Hosted publish requires an active Growth or Enterprise plan.',
    })

    const request = new Request('http://localhost/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ designId: 'design-1', subdomain: 'launch-ready' }),
    })

    const response = await POST(request as NextRequest)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.planId).toBe('team')
    expect(data.error).toContain('Growth or Enterprise')
  })
})
