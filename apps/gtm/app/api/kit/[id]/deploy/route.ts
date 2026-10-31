/**
 * Kit Deploy API - Deploy kit assets to connected providers
 * 
 * Supports: Webflow, HubSpot, Framer, Sako Subdomain
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import { getProvider } from '@/lib/providers/registry'
import type { PageMetadata, ProviderType } from '@/lib/providers/types'
import { checkKitComplianceGate } from '@/lib/claims/compliance-gate'
import { requireWorkspaceEntitlement } from '@/lib/billing/entitlements'

export type DeployProvider = 'webflow' | 'hubspot' | 'framer' | 'subdomain' | 'figma'

interface DeployRequest {
  provider: DeployProvider
  options?: {
    siteName?: string
    pageTitle?: string
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: kitId } = await params
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  let body: DeployRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }
  
  const { provider, options } = body

  if (!provider || !['webflow', 'hubspot', 'framer', 'subdomain', 'figma'].includes(provider)) {
    return NextResponse.json(
      { error: 'Invalid provider' },
      { status: 400 }
    )
  }
  
  const supabase = createServiceClient()

  const feature = provider === 'subdomain' ? 'subdomainPublish' : provider === 'figma' ? 'assetExport' : 'directDeploy'
  const gate = await requireWorkspaceEntitlement(workspaceId, feature, {
    message:
      feature === 'subdomainPublish'
        ? 'Hosted publish requires an active Growth or Enterprise plan.'
        : feature === 'directDeploy'
          ? 'Direct deploys require an active Team, Growth, or Enterprise plan.'
          : 'Exports require an active paid plan.',
  })
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.message, planId: gate.entitlements.planId }, { status: 403 })
  }
  
  // Get the kit
  const { data: kit, error: kitError } = await supabase
    .from('launch_kits')
    .select('*')
    .eq('id', kitId)
    .eq('workspace_id', workspaceId)
    .single()
  
  if (kitError || !kit) {
    return NextResponse.json(
      { error: 'Kit not found' },
      { status: 404 }
    )
  }

  // Compliance gate: block deploy if kit has unresolved high-risk claims.
  const complianceBlock = await checkKitComplianceGate(kitId, workspaceId)
  if (complianceBlock) return complianceBlock
  
  // Check if provider is connected
  if (provider !== 'subdomain') {
    const { data: connection } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', provider)
      .eq('is_active', true)
      .single()
    
    if (!connection) {
      return NextResponse.json({
        success: false,
        error: 'Provider not connected',
        connectUrl: `/api/providers/${provider}/connect`,
      }, { status: 400 })
    }
  }
  
  try {
    let result: { url: string; deploymentId?: string }
    
    switch (provider) {
      case 'subdomain':
        result = await deployToSubdomain(kit, workspaceId, options)
        break
      case 'webflow':
        result = await deployToWebflow(kit, workspaceId)
        break
      case 'hubspot':
        result = await deployToHubSpot(kit, workspaceId)
        break
      case 'framer':
        result = await deployToFramer(kit, workspaceId)
        break
      case 'figma':
        result = await exportToFigma(kit, workspaceId)
        break
      default:
        throw new Error('Unsupported provider')
    }
    
    // Record deployment
    await supabase.from('kit_deployments').insert({
      kit_id: kitId,
      workspace_id: workspaceId,
      provider,
      url: result.url,
      deployment_id: result.deploymentId,
    })
    
    // Update kit status
    await supabase
      .from('launch_kits')
      .update({ 
        status: 'exported',
        exported_at: new Date().toISOString(),
      })
      .eq('id', kitId)
    
    return NextResponse.json({
      success: true,
      provider,
      url: result.url,
      deploymentId: result.deploymentId,
    })
    
  } catch (error) {
    console.error('Deploy error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Deployment failed',
    }, { status: 500 })
  }
}

// ============================================================================
// Deployment Functions
// ============================================================================

async function deployToSubdomain(
  kit: { id: string; assets: { landingPage?: { html?: string } } },
  workspaceId: string,
  options?: { siteName?: string }
): Promise<{ url: string; deploymentId: string }> {
  // Generate a unique subdomain
  const slug = options?.siteName || `kit-${kit.id.slice(0, 8)}`
  const deploymentId = crypto.randomUUID()
  
  // In production, this would deploy to a hosting service
  // For now, we'll store the HTML and create a route
  const supabase = createServiceClient()
  
  await supabase.from('published_pages').insert({
    id: deploymentId,
    workspace_id: workspaceId,
    slug,
    html: kit.assets.landingPage?.html || '<html><body>No content</body></html>',
    kit_id: kit.id,
    is_active: true,
  })
  
  return {
    url: `https://${slug}.sako.pub`,
    deploymentId,
  }
}

async function deployToWebflow(
  kit: { id: string; name?: string; assets: unknown },
  workspaceId: string
): Promise<{ url: string; deploymentId: string }> {
  return deployViaRegistry('webflow', kit, workspaceId)
}

async function deployToHubSpot(
  kit: { id: string; name?: string; assets: unknown },
  workspaceId: string
): Promise<{ url: string; deploymentId: string }> {
  return deployViaRegistry('hubspot', kit, workspaceId)
}

async function deployToFramer(
  kit: { id: string; name?: string; assets: unknown },
  workspaceId: string
): Promise<{ url: string; deploymentId: string }> {
  return deployViaRegistry('framer', kit, workspaceId)
}

async function exportToFigma(
  kit: { id: string; name?: string; assets: unknown },
  workspaceId: string
): Promise<{ url: string; deploymentId: string }> {
  return deployViaRegistry('figma', kit, workspaceId)
}

async function deployViaRegistry(
  providerType: Extract<ProviderType, 'webflow' | 'hubspot' | 'framer' | 'figma'>,
  kit: { id: string; name?: string; assets: unknown },
  workspaceId: string
): Promise<{ url: string; deploymentId: string }> {
  const provider = getProvider(providerType)
  if (!provider.capabilities.deployPage || !provider.deployPage) {
    throw new Error(`${provider.name} is currently export-only for this asset type`)
  }

  const landingHtml = extractLandingHtml(kit.assets)
  if (!landingHtml) {
    throw new Error('Kit has no landing page HTML to deploy')
  }

  const metadata: PageMetadata = {
    name: kit.name ?? `Kit ${kit.id.slice(0, 8)}`,
    slug: `kit-${kit.id.slice(0, 8)}`,
    workspaceId,
    campaignId: kit.id,
  }

  const result = await provider.deployPage(landingHtml, metadata)
  if (!result.success) {
    throw new Error(result.error || `Failed to deploy to ${provider.name}`)
  }

  return {
    url: result.url ?? '',
    deploymentId: result.externalId || crypto.randomUUID(),
  }
}

function extractLandingHtml(assets: unknown): string | null {
  if (!assets || typeof assets !== 'object') return null
  const record = assets as Record<string, unknown>
  const landing = record.landingPage as Record<string, unknown> | undefined
  const html = landing?.html
  return typeof html === 'string' && html.length > 0 ? html : null
}
