/**
 * Unified HTML Export API
 * 
 * Exports campaign HTML to various design/publishing platforms:
 * - Figma (via code.to.design clipboard API)
 * - Framer (matching official extension format)
 * - Webflow (via CMS API)
 * - HubSpot (via CMS API)
 * - Raw HTML download
 * 
 * POST /api/export
 * {
 *   campaignId: string
 *   platform: 'figma' | 'framer' | 'webflow' | 'hubspot' | 'raw'
 *   options?: { ... }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checkCampaignComplianceGate, checkComplianceGate } from '@/lib/claims/compliance-gate'
import { getProviderCapabilityTier } from '@/lib/providers/registry'
import { requireWorkspaceEntitlement } from '@/lib/billing/entitlements'
import { 
  exportHtml, 
  getFigmaExportBalance,
  type ExportPlatform 
} from '@/lib/html/export'
import { generateLandingPageHtml } from '@/lib/html/generator'
import { incrementUsage } from '@/lib/billing/usage'

interface ExportRequestBody {
  campaignId?: string
  assetDocumentId?: string
  platform: ExportPlatform
  html?: string
  css?: string
  options?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as ExportRequestBody
    const { 
      campaignId, 
      assetDocumentId,
      platform,
      html: rawHtml,
      css: rawCss,
      options = {} 
    } = body

    // Validate platform
    const validPlatforms: ExportPlatform[] = ['figma', 'framer', 'webflow', 'hubspot', 'raw']
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json({ 
        error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` 
      }, { status: 400 })
    }

    let html: string
    let css: string
    let campaignName: string
    const exportOptions: Record<string, unknown> = { ...options }

    // If raw HTML/CSS provided, use that
    if (rawHtml) {
      if (assetDocumentId) {
        const { data: member } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .single()

        if (!member) {
          return NextResponse.json({ error: 'No workspace' }, { status: 400 })
        }

        const blocked = await checkComplianceGate(assetDocumentId, member.workspace_id)
        if (blocked) return blocked
        exportOptions.workspaceId = member.workspace_id
      }

      html = rawHtml
      css = rawCss || ''
      campaignName = typeof options.name === 'string' ? options.name : 'Export'
    } 
    // Otherwise, generate from campaign
    else if (campaignId) {
      // Get workspace membership
      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()

      if (!member) {
        return NextResponse.json({ error: 'No workspace' }, { status: 400 })
      }

      // Get campaign
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('workspace_id', member.workspace_id)
        .single()

      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }

      const complianceBlock = await checkCampaignComplianceGate(campaignId, member.workspace_id)
      if (complianceBlock) return complianceBlock

      // Get page blocks
      const { data: blocks } = await supabase
        .from('page_blocks')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('order')

      // Generate HTML from blocks
      const heroBlock = blocks?.find((b: { type: string }) => b.type === 'hero')
      const generatedHtml = generateLandingPageHtml(campaign, blocks || [], heroBlock)
      
      html = generatedHtml
      css = '' // CSS is inlined in the generated HTML
      campaignName = campaign.name
      exportOptions.workspaceId = member.workspace_id
    } else {
      return NextResponse.json({ 
        error: 'Either campaignId or html must be provided' 
      }, { status: 400 })
    }

    // Export to the target platform
    if (typeof exportOptions.workspaceId === 'string') {
      const feature =
        platform === 'webflow' || platform === 'hubspot'
          ? 'directDeploy'
          : 'assetExport'
      const gate = await requireWorkspaceEntitlement(exportOptions.workspaceId, feature, {
        message:
          feature === 'directDeploy'
            ? 'Direct deploys require an active Team, Growth, or Enterprise plan.'
            : 'Exports require an active paid plan.',
      })

      if (!gate.ok) {
        return NextResponse.json(
          { success: false, error: gate.message, planId: gate.entitlements.planId },
          { status: 403 }
        )
      }
    }

    const result = await exportHtml(html, css, {
      platform,
      name: campaignName,
      width: typeof options.width === 'number' ? options.width : 1280,
      height: typeof options.height === 'number' ? options.height : 2000,
      ...exportOptions,
    })

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error,
        instructions: result.instructions,
      }, { status: 400 })
    }

    if (typeof exportOptions.workspaceId === 'string') {
      await incrementUsage(exportOptions.workspaceId, 'deployments')
    }

    return NextResponse.json({
      success: true,
      platform,
      clipboardData: result.clipboardData,
      url: result.url,
      externalId: result.externalId,
      instructions: result.instructions,
    })

  } catch (error) {
    console.error('Export API error:', error)
    return NextResponse.json({ 
      error: 'Export failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

/**
 * GET /api/export - Get export status/balance
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')

  if (action === 'balance') {
    // Get code.to.design API balance
    const balance = await getFigmaExportBalance()
    return NextResponse.json({ balance })
  }

  // Return available export platforms
  return NextResponse.json({
    platforms: [
      {
        id: 'figma',
        name: 'Figma',
        description: 'Export to Figma clipboard (via code.to.design)',
        type: 'clipboard',
        capability: getProviderCapabilityTier('figma'),
        requiresConnection: false,
        configured: !!process.env.CODE_TO_DESIGN_API_KEY,
      },
      {
        id: 'framer',
        name: 'Framer',
        description: 'Export to Framer clipboard (paste in Framer)',
        type: 'clipboard',
        capability: getProviderCapabilityTier('framer'),
        requiresConnection: false,
        configured: true, // Always available (no API needed)
      },
      {
        id: 'webflow',
        name: 'Webflow',
        description: 'Publish directly to Webflow CMS',
        type: 'publish',
        capability: getProviderCapabilityTier('webflow'),
        requiresConnection: true,
        configured: !!(process.env.WEBFLOW_CLIENT_ID && process.env.WEBFLOW_CLIENT_SECRET),
      },
      {
        id: 'hubspot',
        name: 'HubSpot',
        description: 'Publish as HubSpot landing page',
        type: 'publish',
        capability: getProviderCapabilityTier('hubspot'),
        requiresConnection: true,
        configured: !!(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET),
      },
      {
        id: 'raw',
        name: 'Raw HTML',
        description: 'Download raw HTML for manual integration',
        type: 'download',
        capability: 'export_only',
        requiresConnection: false,
        configured: true,
      },
    ],
  })
}
