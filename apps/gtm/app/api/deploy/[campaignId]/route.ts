import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createHash } from 'crypto'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import { getProvider, getDefaultFormFields, batchDeploy } from '@/lib/providers/registry'
import type { ProviderType, PageMetadata } from '@/lib/providers/types'
import { checkCampaignComplianceGate } from '@/lib/claims/compliance-gate'
import { requireWorkspaceEntitlement } from '@/lib/billing/entitlements'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  const workspaceId = getWorkspaceIdWithFallback(request)
  const supabase = createServiceClient()

  try {
    const gate = await requireWorkspaceEntitlement(workspaceId, 'directDeploy', {
      message: 'Direct deploys require an active Team, Growth, or Enterprise plan.',
    })
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.message, planId: gate.entitlements.planId },
        { status: 403 }
      )
    }

    // Compliance gate: block deploy if any campaign assets have unresolved high-risk claims
    const complianceBlock = await checkCampaignComplianceGate(campaignId, workspaceId)
    if (complianceBlock) return complianceBlock

    // Parse request body for destinations
    const body = await request.json().catch(() => ({}))
    const destinations: ProviderType[] = body.destinations || ['hubspot']

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Check if at least one provider is connected
    const hubspotProvider = getProvider('hubspot')
    const isHubSpotConnected = await hubspotProvider.isConnected(workspaceId)

    if (destinations.includes('hubspot') && !isHubSpotConnected) {
      return NextResponse.json({
        success: false,
        error: 'HubSpot not connected',
        fallback: true,
        instructions: [
          'Connect your HubSpot account in Settings',
          'Then return here to publish',
        ],
      })
    }

    // Get messages for form fields
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('campaign_id', campaignId)

    // Get page blocks for payload
    const { data: blocks } = await supabase
      .from('page_blocks')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('order')

    // Generate idempotency key
    const payloadHash = createHash('sha256')
      .update(JSON.stringify({ campaignId, blocks, messages, version: campaign.version, destinations }))
      .digest('hex')
    const idempotencyKey = `${workspaceId}-${campaignId}-${campaign.version}-${payloadHash.slice(0, 8)}`

    // Check for existing deployment with same key
    const { data: existingDeployment } = await supabase
      .from('deployments')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single()

    if (existingDeployment && existingDeployment.status === 'success') {
      return NextResponse.json({
        success: true,
        deployment: existingDeployment,
        message: 'Campaign already deployed (idempotent)',
      })
    }

    // Create deployment record
    const { data: deployment, error: deployError } = await supabase
      .from('deployments')
      .insert({
        campaign_id: campaignId,
        angle_id: campaign.selected_angle_id,
        idempotency_key: idempotencyKey,
        status: 'pending',
        hubspot_payload: { blocks, messages },
      })
      .select()
      .single()

    if (deployError) {
      return NextResponse.json({ error: deployError.message }, { status: 500 })
    }

    // Generate HTML from blocks
    const heroBlock = blocks?.find((b: any) => b.type === 'hero')
    const htmlContent = generateLandingPageHtml(campaign, blocks || [], heroBlock)

    // Prepare metadata for deployment
    const pageMetadata: PageMetadata = {
      name: campaign.name,
      slug: campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      workspaceId,
      campaignId,
      seoTitle: campaign.name,
    }

    // Get form fields with campaign tracking
    const formFields = getDefaultFormFields(campaignId)

    // Deploy to all requested destinations using batch deploy
    const batchResult = await batchDeploy({
      campaignId,
      workspaceId,
      destinations,
      html: htmlContent,
      formFields,
      metadata: pageMetadata,
    })

    // Determine final status using proper tri-state semantics:
    // success = all destinations succeeded
    // partial = some succeeded, some failed
    // failed = no destinations succeeded
    const status = batchResult.success ? 'success' : batchResult.partial ? 'partial' : 'failed'

    // Update deployment with result
    await supabase
      .from('deployments')
      .update({
        status,
        hubspot_result: batchResult.results,
      })
      .eq('id', deployment.id)

    // Only mark campaign published on full success; partial stays in previous state
    if (status === 'success') {
      await supabase
        .from('campaigns')
        .update({ status: 'published' })
        .eq('id', campaignId)
    }

    return NextResponse.json({
      success: status === 'success',
      partial: status === 'partial',
      deployment,
      results: batchResult.results,
      errors: batchResult.errors,
      instructions: batchResult.errors.length > 0 ? [
        'Some destinations could not be deployed:',
        ...batchResult.errors,
        'Check your connections in Settings.',
      ] : undefined,
    })
  } catch (error) {
    console.error('Deploy failed:', error)
    return NextResponse.json({ error: 'Deployment failed' }, { status: 500 })
  }
}

function generateLandingPageHtml(campaign: any, blocks: any[], heroBlock: any): string {
  const heroProps = heroBlock?.props as Record<string, unknown> || {}
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>${campaign.name}</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .hero { padding: 80px 20px; text-align: center; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); }
    .hero h1 { font-size: 2.5rem; margin-bottom: 1rem; color: #1a1a1a; }
    .hero p { font-size: 1.25rem; color: #666; margin-bottom: 2rem; }
    .cta-button { background: #9ae83e; color: #1a1a1a; padding: 12px 32px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; }
    .section { padding: 60px 20px; max-width: 1200px; margin: 0 auto; }
    .benefits { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
    .benefit-card { padding: 2rem; border-radius: 12px; background: #f9f9f9; }
    .footer { padding: 40px 20px; text-align: center; background: #1a1a1a; color: #fff; }
  </style>
</head>
<body>
  <section class="hero">
    <h1>${heroProps.headline || campaign.name}</h1>
    <p>${heroProps.subheadline || campaign.goal}</p>
    <a href="#form" class="cta-button">${heroProps.cta_text || campaign.cta || 'Get Started'}</a>
  </section>
  
  <section class="section">
    <div class="benefits">
      ${blocks.filter((b: any) => b.type === 'benefits').map((b: any) => {
        const props = b.props as Record<string, unknown>
        return `
          <div class="benefit-card">
            <h3>${(props as any).title || 'Benefit'}</h3>
            <p>${(props as any).description || ''}</p>
          </div>
        `
      }).join('')}
    </div>
  </section>
  
  <section id="form" class="section">
    <!-- HubSpot form will be embedded here -->
    <div id="hubspot-form-container"></div>
  </section>
  
  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} All rights reserved.</p>
  </footer>
</body>
</html>
  `.trim()
}
