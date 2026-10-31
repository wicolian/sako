/**
 * Campaign Landing-Page Design API
 *
 * GET  /api/campaigns/[id]/design
 *   Returns the canonical WebsiteDesign linked to this campaign.
 *   Backfill order when no linked design exists:
 *     1. campaign_assets landing-page HTML (preferred — fidelity-first)
 *     2. website_designs.sections projection from legacy data
 *     3. page_blocks fallback (no render_html available; UI will suggest regeneration)
 *   The linked design is persisted immediately after backfill.
 *
 * POST /api/campaigns/[id]/design
 *   Generates (or regenerates) the landing page via the template-aware pipeline,
 *   persists canonical render_html + render_manifest, links to campaign, returns
 *   the full WebsiteDesign with editorMode = 'controlled'.
 *
 * All heavy lifting is in lib/campaigns/landing-design.ts.
 */

import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import {
  fetchLinkedCampaignLandingDesign,
  generateCampaignLandingDesign,
  MissingWebsiteDesignStorageError,
} from '@/lib/campaigns/landing-design'
import type { DesignDirection } from '@/lib/design/archetype-selector'

const PostBodySchema = z.object({
  designDirection: z.enum(['auto', 'bold', 'minimal', 'professional', 'playful', 'trust-first']).optional(),
}).optional()

// ─────────────────────────────────────────────
// GET – fetch linked design (with backfill)
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceIdWithFallback(request)

  try {
    const design = await fetchLinkedCampaignLandingDesign({
      supabase,
      campaignId,
      workspaceId,
    })

    return NextResponse.json({ design })
  } catch (err) {
    if (err instanceof MissingWebsiteDesignStorageError) {
      return NextResponse.json(
        { error: err.message, code: 'STORAGE_UNAVAILABLE' },
        { status: 503 },
      )
    }

    console.error('[campaign design GET]', err)
    return NextResponse.json(
      { error: 'Failed to load campaign design' },
      { status: 500 },
    )
  }
}

// ─────────────────────────────────────────────
// POST – generate (or regenerate) design
// ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceIdWithFallback(request)

  let designDirection: DesignDirection = 'auto'
  try {
    const rawBody = await request.json().catch(() => null)
    const parsed = PostBodySchema.safeParse(rawBody)
    if (parsed.success && parsed.data?.designDirection) {
      designDirection = parsed.data.designDirection as DesignDirection
    }
  } catch {
    // body is optional
  }

  // Load campaign (we need the full row for the generation prompt)
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  try {
    const design = await generateCampaignLandingDesign({
      supabase,
      workspaceId,
      campaign: campaign as Record<string, unknown>,
      designDirection,
    })

    return NextResponse.json({ design }, { status: 201 })
  } catch (err) {
    if (err instanceof MissingWebsiteDesignStorageError) {
      return NextResponse.json(
        { error: err.message, code: 'STORAGE_UNAVAILABLE' },
        { status: 503 },
      )
    }

    console.error('[campaign design POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 },
    )
  }
}
