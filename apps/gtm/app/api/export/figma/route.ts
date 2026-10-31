import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checkCampaignComplianceGate, checkComplianceGate } from '@/lib/claims/compliance-gate'

const CODE_TO_DESIGN_API_KEY = process.env.CODE_TO_DESIGN_API_KEY

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaignId, html, dimensions, title, assetDocumentId } = body as {
      campaignId?: string
      html?: string
      dimensions?: { width?: number; height?: number }
      title?: string
      assetDocumentId?: string
    }

    if (!CODE_TO_DESIGN_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Figma export not configured',
        message: 'CODE_TO_DESIGN_API_KEY is not set',
      })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }
    let payloadHtml = html
    let layerName = title ?? 'Composer Asset'
    const width = dimensions?.width ?? 1280
    const height = dimensions?.height ?? 2000

    if (!payloadHtml && campaignId) {
      // Backward-compatible campaign export flow
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, name, workspace_id')
        .eq('id', campaignId)
        .eq('workspace_id', member.workspace_id)
        .single()

      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }

      const complianceBlock = await checkCampaignComplianceGate(campaignId, campaign.workspace_id)
      if (complianceBlock) return complianceBlock

      const { data: blocks } = await supabase
        .from('page_blocks')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('order')

      payloadHtml = generateLandingPageHTML(campaign, blocks || [])
      layerName = `${campaign.name} - Landing Page`
    }

    if (assetDocumentId) {
      const complianceBlock = await checkComplianceGate(assetDocumentId, member.workspace_id)
      if (complianceBlock) return complianceBlock
    }

    if (!payloadHtml) {
      return NextResponse.json({
        success: false,
        error: 'Either campaignId or html is required',
      }, { status: 400 })
    }

    // Call code.to.design API
    const response = await fetch('https://api.to.design/html', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CODE_TO_DESIGN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: payloadHtml,
        clip: true,
        topLayerName: layerName,
        width,
        height,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('code.to.design error:', error)
      return NextResponse.json({
        success: false,
        error: 'Export failed',
        details: error,
      })
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Figma export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}

function generateLandingPageHTML(campaign: { name: string; offer?: string | null }, blocks: Array<{ type: string; props: unknown }>) {
  const heroBlock = blocks.find((b) => b.type === 'hero')
  const heroProps = (heroBlock?.props || {}) as { headline?: string; subheadline?: string; cta_text?: string }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${campaign.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Geist', system-ui, sans-serif; color: #1a1a1a; }
    .hero { padding: 80px 40px; text-align: center; background: linear-gradient(180deg, #f7f8f8 0%, #fafafa 100%); }
    .hero h1 { font-size: 48px; font-weight: 700; margin-bottom: 16px; }
    .hero p { font-size: 20px; color: #737373; margin-bottom: 32px; max-width: 600px; margin-left: auto; margin-right: auto; }
    .btn { display: inline-block; padding: 16px 32px; background: #9ae83e; color: #1a1a1a; font-weight: 600; border-radius: 8px; text-decoration: none; }
    .section { padding: 60px 40px; max-width: 1200px; margin: 0 auto; }
    .section h2 { font-size: 32px; font-weight: 600; margin-bottom: 24px; }
  </style>
</head>
<body>
  <section class="hero">
    <h1>${heroProps.headline || campaign.name}</h1>
    <p>${heroProps.subheadline || campaign.offer || 'Your value proposition here'}</p>
    <a href="#" class="btn">${heroProps.cta_text || 'Get Started'}</a>
  </section>
  ${blocks
    .filter((b) => b.type !== 'hero')
    .map((block) => {
      const props = block.props as Record<string, unknown>
      return `
  <section class="section">
    <h2>${block.type.charAt(0).toUpperCase() + block.type.slice(1)}</h2>
    <p>${JSON.stringify(props)}</p>
  </section>`
    })
    .join('')}
</body>
</html>
  `.trim()
}
