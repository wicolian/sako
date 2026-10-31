import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPublishedUrl } from '@/lib/publish/subdomain-publisher'
import { uploadFile } from '@/lib/storage/r2'
import type { WebsiteDesign, WebsiteSection } from '@/lib/website/ai-designer'
import { checkCampaignComplianceGate, checkComplianceGate } from '@/lib/claims/compliance-gate'
import { incrementUsage } from '@/lib/billing/usage'
import { requireWorkspaceEntitlement } from '@/lib/billing/entitlements'

const RequestSchema = z.object({
  designId: z.string(),
  subdomain: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  campaignId: z.string().uuid().optional(),
  assetDocumentId: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { designId, subdomain, campaignId, assetDocumentId } = RequestSchema.parse(body)

    const supabase = await createServerSupabaseClient()
    const serviceSupabase = createServiceClient()
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

    const gate = await requireWorkspaceEntitlement(member.workspace_id, 'subdomainPublish', {
      message: 'Hosted publish requires an active Growth or Enterprise plan.',
    })
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.message, planId: gate.entitlements.planId },
        { status: 403 }
      )
    }

    // Check if subdomain is available
    const { data: existing } = await serviceSupabase
      .from('website_designs')
      .select('id')
      .eq('subdomain', subdomain)
      .neq('id', designId)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Subdomain is already taken' },
        { status: 400 }
      )
    }

    // Get the design
    const { data: design, error: fetchError } = await supabase
      .from('website_designs')
      .select('*')
      .eq('id', designId)
      .eq('workspace_id', member.workspace_id)
      .single()

    if (fetchError || !design) {
      return NextResponse.json(
        { error: 'Design not found' },
        { status: 404 }
      )
    }

    const workspaceId = (design as Record<string, unknown>).workspace_id
    if (typeof workspaceId !== 'string') {
      return NextResponse.json({ error: 'Invalid design workspace' }, { status: 400 })
    }

    if (assetDocumentId) {
      const blocked = await checkComplianceGate(assetDocumentId, workspaceId)
      if (blocked) return blocked
    }

    const inferredCampaignId = (design as Record<string, unknown>).campaign_id
    const effectiveCampaignId =
      campaignId || (typeof inferredCampaignId === 'string' ? inferredCampaignId : undefined)
    if (effectiveCampaignId) {
      const blocked = await checkCampaignComplianceGate(effectiveCampaignId, workspaceId)
      if (blocked) return blocked
    }

    // Generate HTML
    const html = generatePublishableHtml({
      id: design.id,
      workspace_id: design.workspace_id,
      name: design.name,
      description: design.description,
      sections: design.sections || [],
      globalStyles: design.global_styles || {},
      seoMeta: design.seo_meta || {},
      status: design.status,
      created_at: design.created_at,
      updated_at: design.updated_at,
    })

    // Upload to R2 storage
    const key = `published/${subdomain}/index.html`
    await uploadFile(key, html, { contentType: 'text/html', cacheControl: 'public, max-age=3600' })

    const publishedUrl = getPublishedUrl(subdomain)

    // Update design with published info
    const { error: updateError } = await supabase
      .from('website_designs')
      .update({
        subdomain,
        status: 'published',
        published_url: publishedUrl,
        published_at: new Date().toISOString(),
      })
      .eq('id', designId)
      .eq('workspace_id', member.workspace_id)

    if (updateError) {
      throw updateError
    }

    await incrementUsage(workspaceId, 'deployments')

    return NextResponse.json({
      url: publishedUrl,
      subdomain,
      deploymentMode: 'artifact_hosting_beta',
      message: 'HTML artifact uploaded. Public hosting depends on your PUBLISH_DOMAIN DNS configuration.',
    })
  } catch (error) {
    console.error('Publish failed:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to publish' },
      { status: 500 }
    )
  }
}

function generatePublishableHtml(design: WebsiteDesign): string {
  const { globalStyles, sections, seoMeta, name } = design

  const sortedSections = [...sections].sort((a, b) => a.order - b.order)
  const sectionsHtml = sortedSections.map(s => generateSectionHtml(s, globalStyles)).join('\n')

  const borderRadius = globalStyles.borderRadius === 'none' ? '0' 
    : globalStyles.borderRadius === 'small' ? '0.25rem'
    : globalStyles.borderRadius === 'medium' ? '0.5rem'
    : globalStyles.borderRadius === 'large' ? '0.75rem' : '9999px'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${seoMeta.title || name}</title>
  <meta name="description" content="${seoMeta.description || ''}">
  ${seoMeta.keywords?.length ? `<meta name="keywords" content="${seoMeta.keywords.join(', ')}">` : ''}
  <meta property="og:title" content="${seoMeta.title || name}">
  <meta property="og:description" content="${seoMeta.description || ''}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${(globalStyles.fontHeading || 'Inter').replace(' ', '+')}:wght@400;500;600;700&family=${(globalStyles.fontBody || 'Inter').replace(' ', '+')}:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --color-primary: ${globalStyles.primaryColor || '#6366f1'};
      --color-secondary: ${globalStyles.secondaryColor || globalStyles.primaryColor || '#6366f1'};
      --color-accent: ${globalStyles.accentColor || '#f59e0b'};
      --font-heading: '${globalStyles.fontHeading || 'Inter'}', system-ui, sans-serif;
      --font-body: '${globalStyles.fontBody || 'Inter'}', system-ui, sans-serif;
      --radius: ${borderRadius};
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: var(--font-body); 
      line-height: 1.6;
      ${globalStyles.colorScheme === 'dark' ? 'background:#0a0a0a;color:#fafafa;' : 'background:#fff;color:#0a0a0a;'}
    }
    h1,h2,h3,h4,h5,h6 { font-family: var(--font-heading); line-height: 1.2; }
    .btn-primary {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0.75rem 1.5rem; background: var(--color-primary); color: white;
      font-weight: 500; border-radius: var(--radius); border: none; cursor: pointer;
      transition: opacity 0.2s, transform 0.2s; text-decoration: none;
    }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-secondary {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0.75rem 1.5rem; background: transparent; color: var(--color-primary);
      font-weight: 500; border-radius: var(--radius); border: 1px solid var(--color-primary);
      cursor: pointer; transition: background 0.2s, color 0.2s; text-decoration: none;
    }
    .btn-secondary:hover { background: var(--color-primary); color: white; }
  </style>
</head>
<body>
${sectionsHtml}
</body>
</html>`
}

function generateSectionHtml(section: WebsiteSection, globalStyles: WebsiteDesign['globalStyles']): string {
  const { type, content, styles } = section

  const bgClass = styles.background === 'dark' 
    ? 'bg-card/40 backdrop-blur-sm text-white' 
    : styles.background === 'light' 
    ? 'bg-muted/10' 
    : styles.background === 'gradient'
    ? 'bg-gradient-to-br from-indigo-50 to-purple-50'
    : 'bg-card'

  const spacingClass = styles.spacing === 'compact' ? 'py-12' 
    : styles.spacing === 'spacious' ? 'py-24' : 'py-16'

  const alignClass = styles.alignment === 'left' ? 'text-left' 
    : styles.alignment === 'right' ? 'text-right' : 'text-center'

  switch (type) {
    case 'hero':
      return `<section class="${bgClass} ${spacingClass}">
  <div class="max-w-6xl mx-auto px-6 ${alignClass}">
    ${content.headline ? `<h1 class="text-5xl font-bold mb-6 leading-tight">${content.headline}</h1>` : ''}
    ${content.subheadline ? `<p class="text-xl text-muted-foreground mb-8 max-w-2xl ${styles.alignment === 'center' ? 'mx-auto' : ''}">${content.subheadline}</p>` : ''}
    <div class="flex gap-4 ${styles.alignment === 'center' ? 'justify-center' : ''}">
      ${content.cta ? `<a href="${content.cta.link}" class="btn-primary">${content.cta.text}</a>` : ''}
      ${content.secondaryCta ? `<a href="${content.secondaryCta.link}" class="btn-secondary">${content.secondaryCta.text}</a>` : ''}
    </div>
  </div>
</section>`

    case 'features':
      return `<section class="${bgClass} ${spacingClass}">
  <div class="max-w-6xl mx-auto px-6">
    ${content.headline ? `<h2 class="text-3xl font-bold mb-4 ${alignClass}">${content.headline}</h2>` : ''}
    ${content.subheadline ? `<p class="text-muted-foreground mb-12 ${alignClass}">${content.subheadline}</p>` : ''}
    <div class="grid grid-cols-1 md:grid-cols-${styles.columns || 3} gap-8">
      ${(content.items || []).map(item => `
      <div class="p-6 rounded-xl bg-card shadow-sm border">
        ${item.icon ? `<div class="text-4xl mb-4">${item.icon}</div>` : ''}
        <h3 class="text-xl font-semibold mb-2">${item.title}</h3>
        <p class="text-muted-foreground">${item.description}</p>
      </div>`).join('')}
    </div>
  </div>
</section>`

    case 'testimonials':
      return `<section class="${bgClass} ${spacingClass}">
  <div class="max-w-6xl mx-auto px-6">
    ${content.headline ? `<h2 class="text-3xl font-bold mb-12 ${alignClass}">${content.headline}</h2>` : ''}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      ${(content.items || []).map(item => `
      <div class="p-6 rounded-xl bg-card shadow-sm border">
        <p class="text-muted-foreground mb-4 italic">"${item.description}"</p>
        <p class="font-semibold">${item.title}</p>
      </div>`).join('')}
    </div>
  </div>
</section>`

    case 'cta':
      return `<section class="${bgClass} ${spacingClass}">
  <div class="max-w-4xl mx-auto px-6 text-center">
    ${content.headline ? `<h2 class="text-3xl font-bold mb-4">${content.headline}</h2>` : ''}
    ${content.subheadline ? `<p class="text-xl text-muted-foreground mb-8">${content.subheadline}</p>` : ''}
    ${content.cta ? `<a href="${content.cta.link}" class="btn-primary">${content.cta.text}</a>` : ''}
  </div>
</section>`

    case 'stats':
      return `<section class="${bgClass} ${spacingClass}">
  <div class="max-w-6xl mx-auto px-6">
    ${content.headline ? `<h2 class="text-3xl font-bold mb-12 ${alignClass}">${content.headline}</h2>` : ''}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
      ${(content.items || []).map(item => `
      <div>
        <p class="text-4xl font-bold mb-2" style="color: var(--color-primary)">${item.title}</p>
        <p class="text-muted-foreground">${item.description}</p>
      </div>`).join('')}
    </div>
  </div>
</section>`

    case 'faq':
      return `<section class="${bgClass} ${spacingClass}">
  <div class="max-w-3xl mx-auto px-6">
    ${content.headline ? `<h2 class="text-3xl font-bold mb-12 ${alignClass}">${content.headline}</h2>` : ''}
    <div class="space-y-4">
      ${(content.items || []).map(item => `
      <details class="p-4 rounded-lg bg-card shadow-sm border group">
        <summary class="font-semibold cursor-pointer list-none flex justify-between items-center">
          ${item.title}
          <span class="transform group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <p class="mt-4 text-muted-foreground">${item.description}</p>
      </details>`).join('')}
    </div>
  </div>
</section>`

    case 'logos':
      return `<section class="${bgClass} ${spacingClass}">
  <div class="max-w-6xl mx-auto px-6">
    ${content.headline ? `<p class="text-sm text-muted-foreground mb-8 ${alignClass} uppercase tracking-wider">${content.headline}</p>` : ''}
    <div class="flex flex-wrap justify-center items-center gap-12 opacity-60">
      ${(content.items || []).map(item => `
      <div class="text-2xl font-bold text-muted-foreground">${item.title}</div>`).join('')}
    </div>
  </div>
</section>`

    default:
      return `<section class="${bgClass} ${spacingClass}">
  <div class="max-w-6xl mx-auto px-6 ${alignClass}">
    ${content.headline ? `<h2 class="text-3xl font-bold mb-4">${content.headline}</h2>` : ''}
    ${content.description ? `<p class="text-muted-foreground">${content.description}</p>` : ''}
  </div>
</section>`
  }
}
