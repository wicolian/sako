import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import JSZip from 'jszip'
import { nanoid } from 'nanoid'
import { requireWorkspaceEntitlement } from '@/lib/billing/entitlements'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaignId } = body

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

    const gate = await requireWorkspaceEntitlement(member.workspace_id, 'assetExport', {
      message: 'Package export requires an active paid plan.',
    })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message, planId: gate.entitlements.planId }, { status: 403 })
    }

    // Get all campaign data
    const [campaignRes, messagesRes, anglesRes, blocksRes, flowRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', campaignId).eq('workspace_id', member.workspace_id).single(),
      supabase.from('messages').select('*').eq('campaign_id', campaignId),
      supabase.from('angles').select('*').eq('campaign_id', campaignId).order('rank'),
      supabase.from('page_blocks').select('*').eq('campaign_id', campaignId).order('order'),
      supabase.from('followup_flows').select('*').eq('campaign_id', campaignId).single(),
    ])

    if (!campaignRes.data) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const campaign = campaignRes.data
    const messages = messagesRes.data || []
    const angles = anglesRes.data || []
    const blocks = blocksRes.data || []
    const flow = flowRes.data
    const { data: evidenceData } = await supabase
      .from('evidence')
      .select('*')
      .eq('workspace_id', campaign.workspace_id)

    const evidence = evidenceData || []

    // Create ZIP file
    const zip = new JSZip()

    // Add campaign brief
    const briefContent = `# ${campaign.name}

## Campaign Brief

**Audience:** ${campaign.audience}
**Goal:** ${campaign.goal}
**Offer:** ${campaign.offer}
**CTA:** ${campaign.cta}
**Status:** ${campaign.status}
**Version:** ${campaign.version}

## Constraints
${campaign.constraints ? JSON.stringify(campaign.constraints, null, 2) : 'None specified'}

---
*Exported on ${new Date().toISOString()}*
`
    zip.file('brief.md', briefContent)

    // Add messages
    const messagesContent = `# Campaign Messages

## Headlines
${messages.filter((m: any) => m.type === 'headline').map((m: any) => `- ${m.text} (${m.status})`).join('\n') || 'None generated'}

## Supporting Points
${messages.filter((m: any) => m.type === 'supporting').map((m: any) => `- ${m.text} (${m.status})`).join('\n') || 'None generated'}

## Calls to Action
${messages.filter((m: any) => m.type === 'cta').map((m: any) => `- ${m.text} (${m.status})`).join('\n') || 'None generated'}

## Disclaimers
${messages.filter((m: any) => m.type === 'disclaimer').map((m: any) => `- ${m.text}`).join('\n') || 'None generated'}
`
    zip.file('messages.md', messagesContent)

    // Add angles
    const selectedAngle = angles.find((a: any) => a.id === campaign.selected_angle_id)
    const anglesContent = `# Campaign Angles

## Selected Angle
${selectedAngle ? `
**${selectedAngle.name}**
Trust Score: ${selectedAngle.trust_score}/100
${selectedAngle.description}

Rationale: ${selectedAngle.rationale}
` : 'No angle selected'}

## All Angles
${angles.map((a: any, i: number) => `
### ${i + 1}. ${a.name}
Trust Score: ${a.trust_score}/100
${a.description}
`).join('\n')}
`
    zip.file('angles.md', anglesContent)

    // Add page blocks as JSON
    zip.file('page-blocks.json', JSON.stringify(blocks, null, 2))

    // Add workflow
    if (flow) {
      zip.file('workflow.json', JSON.stringify({
        graph: flow.graph_json,
        compiled: flow.compiled_json,
      }, null, 2))
    }

    // Add evidence
    const evidenceContent = `# Evidence Library

${evidence.map((e: any) => `
## ${e.title}
- Type: ${e.type}
- URL: ${e.url || 'N/A'}
- Content: ${e.content || 'N/A'}
`).join('\n')}
`
    zip.file('evidence.md', evidenceContent)

    // Add landing page HTML
    const heroBlock = blocks.find((b: any) => b.type === 'hero')
    const landingPageHtml = generateLandingPageHtml(campaign, blocks, heroBlock)
    zip.file('landing-page.html', landingPageHtml)

    // Add README
    const readmeContent = `# ${campaign.name} - Handoff Package

This package contains all assets for the campaign.

## Contents

- \`brief.md\` - Campaign brief and strategy
- \`messages.md\` - All generated messaging (headlines, supporting points, CTAs)
- \`angles.md\` - Campaign angles with trust scores
- \`page-blocks.json\` - Landing page block configuration
- \`workflow.json\` - Follow-up automation workflow
- \`evidence.md\` - Supporting evidence and proof points
- \`landing-page.html\` - Ready-to-use landing page HTML

## Next Steps

1. Review all messaging for brand alignment
2. Customize landing page design as needed
3. Set up form integrations in your marketing platform
4. Configure follow-up workflow
5. Launch and monitor performance

---
*Generated by Sako Composer*
*Export Date: ${new Date().toISOString()}*
`
    zip.file('README.md', readmeContent)

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ type: 'nodebuffer' })
    const fileName = `${campaign.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${nanoid(8)}.zip`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('exports')
      .upload(fileName, zipBlob, {
        contentType: 'application/zip',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      // If storage upload fails, return the ZIP as a direct download
      return new NextResponse(new Uint8Array(zipBlob), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('exports')
      .getPublicUrl(fileName)

    return NextResponse.json({
      success: true,
      fileName,
      downloadUrl: urlData.publicUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    })
  } catch (error) {
    console.error('Package export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}

function generateLandingPageHtml(campaign: any, blocks: any[], heroBlock: any): string {
  const heroProps = (heroBlock?.props as Record<string, unknown>) || {}
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${campaign.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.6;
      color: #1a1a1a;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
    
    /* Hero Section */
    .hero { 
      padding: 100px 20px; 
      text-align: center; 
      background: linear-gradient(135deg, #f8faf5 0%, #e8f5d6 100%); 
    }
    .hero h1 { 
      font-size: 3rem; 
      margin-bottom: 1.5rem; 
      font-weight: 700;
    }
    .hero p { 
      font-size: 1.25rem; 
      color: #666; 
      margin-bottom: 2rem; 
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }
    .cta-button { 
      background: #9ae83e; 
      color: #1a1a1a; 
      padding: 16px 40px; 
      border-radius: 8px; 
      font-weight: 600; 
      text-decoration: none; 
      display: inline-block; 
      font-size: 1.1rem;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(154, 232, 62, 0.4);
    }
    
    /* Trust Section */
    .trust { 
      padding: 40px 20px; 
      background: #fff; 
      border-bottom: 1px solid #e5e5e5;
    }
    .trust-logos {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 3rem;
      flex-wrap: wrap;
    }
    .trust-logo {
      width: 100px;
      height: 40px;
      background: #f0f0f0;
      border-radius: 4px;
    }
    
    /* Benefits Section */
    .benefits { 
      padding: 80px 20px; 
      background: #fff;
    }
    .benefits h2 {
      text-align: center;
      margin-bottom: 3rem;
      font-size: 2rem;
    }
    .benefits-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
      gap: 2rem; 
    }
    .benefit-card { 
      padding: 2rem; 
      border-radius: 12px; 
      background: #f9f9f9;
      text-align: center;
    }
    .benefit-icon {
      width: 60px;
      height: 60px;
      background: #e8f5d6;
      border-radius: 50%;
      margin: 0 auto 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .benefit-card h3 { margin-bottom: 0.5rem; }
    .benefit-card p { color: #666; }
    
    /* Form Section */
    .form-section {
      padding: 80px 20px;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      color: #fff;
    }
    .form-section h2 {
      text-align: center;
      margin-bottom: 2rem;
    }
    .form-container {
      max-width: 500px;
      margin: 0 auto;
      background: #fff;
      padding: 2rem;
      border-radius: 12px;
      color: #1a1a1a;
    }
    
    /* Footer */
    .footer { 
      padding: 40px 20px; 
      text-align: center; 
      background: #1a1a1a; 
      color: #999; 
    }
    
    @media (max-width: 768px) {
      .hero h1 { font-size: 2rem; }
      .hero p { font-size: 1rem; }
    }
  </style>
</head>
<body>
  <section class="hero">
    <div class="container">
      <h1>${heroProps.headline || campaign.name}</h1>
      <p>${heroProps.subheadline || campaign.goal}</p>
      <a href="#form" class="cta-button">${heroProps.cta_text || campaign.cta || 'Get Started'}</a>
    </div>
  </section>
  
  <section class="trust">
    <div class="container">
      <div class="trust-logos">
        <div class="trust-logo"></div>
        <div class="trust-logo"></div>
        <div class="trust-logo"></div>
        <div class="trust-logo"></div>
      </div>
    </div>
  </section>
  
  <section class="benefits">
    <div class="container">
      <h2>Why Choose Us</h2>
      <div class="benefits-grid">
        ${blocks.filter((b: any) => b.type === 'benefits').length > 0 
          ? blocks.filter((b: any) => b.type === 'benefits').map((b: any) => {
              const props = b.props as Record<string, unknown>
              return `
                <div class="benefit-card">
                  <div class="benefit-icon">✓</div>
                  <h3>${(props as any).title || 'Benefit'}</h3>
                  <p>${(props as any).description || ''}</p>
                </div>
              `
            }).join('')
          : `
            <div class="benefit-card">
              <div class="benefit-icon">⚡</div>
              <h3>Fast Results</h3>
              <p>Get started quickly and see results in no time.</p>
            </div>
            <div class="benefit-card">
              <div class="benefit-icon">🎯</div>
              <h3>Easy to Use</h3>
              <p>Intuitive interface that anyone can master.</p>
            </div>
            <div class="benefit-card">
              <div class="benefit-icon">💪</div>
              <h3>Powerful Features</h3>
              <p>Everything you need to succeed.</p>
            </div>
          `
        }
      </div>
    </div>
  </section>
  
  <section id="form" class="form-section">
    <div class="container">
      <h2>Get Started Today</h2>
      <div class="form-container">
        <!-- Replace with your form embed code -->
        <p style="text-align: center; color: #666;">Form placeholder - embed your HubSpot form here</p>
      </div>
    </div>
  </section>
  
  <footer class="footer">
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`
}
