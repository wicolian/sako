import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/workspace'
import { 
  generateLandingPageContent, 
  streamLandingPageHTML,
  type LandingPageContent 
} from '@/lib/ai/ai-sdk-client'
import { buildCampaignContextWithLearning, type CampaignInput } from '@/lib/learning/prompt-enhancer'
import { createServiceClient } from '@/lib/supabase/service'
import { getBrandContext, formatBrandPrompt, generateBrandCSS, getBrandFontLink } from '@/lib/ai/brand-context'
import { generateLandingPage } from '@/lib/ai/template-aware-generation'

export async function POST(request: NextRequest) {
  try {
    const workspaceId = getWorkspaceId(request)
    const { 
      prompt, 
      campaignId, 
      brandId,
      streaming = false,
      useTemplates = true,
      sections,
      style,
    } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    
    // Get brand context (uses default if brandId not specified)
    const brandContext = await getBrandContext(workspaceId, brandId)
    
    // Get workspace settings
    const { data: settings } = await supabase
      .from('workspace_settings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()

    // Build context with learning loop data if campaign provided
    let context = ''
    if (campaignId) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('workspace_id', workspaceId)
        .single()

      if (campaign) {
        const campaignInput: CampaignInput = {
          audience: (campaign as Record<string, unknown>).audience as string || '',
          goal: (campaign as Record<string, unknown>).goal as string || '',
          offer: (campaign as Record<string, unknown>).offer as string || '',
          cta: (campaign as Record<string, unknown>).cta as string,
        }
        const enhancedContext = await buildCampaignContextWithLearning(campaignInput, workspaceId)
        context = enhancedContext.campaignContext
        if (enhancedContext.hasLearningData) {
          context = enhancedContext.learningContext + '\n\n' + context
        }
      }
    }

    // Add brand context to prompt
    if (brandContext) {
      context += '\n\n' + formatBrandPrompt(brandContext)
    } else if (settings) {
      // Fallback to legacy settings
      context += `\n\nBrand Voice: ${settings.brand_voice || 'Professional and approachable'}`
      if (settings.industry) {
        context += `\nIndustry: ${settings.industry}`
      }
    }

    // Use template-aware generation if enabled
    if (useTemplates) {
      const result = await generateLandingPage({
        brief: prompt,
        industry: (settings as Record<string, unknown>)?.industry as string | undefined,
        style: style || {
          theme: brandContext?.visualStyle.theme || 'dark',
          layout: 'centered',
        },
        sections,
        brandId,
        workspaceId,
      })

      // Inject brand CSS and fonts
      let finalHtml = result.html
      if (brandContext) {
        const fontLink = getBrandFontLink(brandContext)
        const brandCss = generateBrandCSS(brandContext)
        
        // Inject into head
        finalHtml = finalHtml.replace(
          '</head>',
          `<link href="${fontLink}" rel="stylesheet">
<style>${brandCss}</style>
</head>`
        )
      }

      return NextResponse.json({
        html: finalHtml,
        sections: result.sections,
        designTokens: result.designTokens,
        claims: result.claims,
        brandApplied: !!brandContext,
        workspaceId,
      })
    }

    // Legacy generation path (non-template)
    const content = await generateLandingPageContent(prompt, context)

    // Get brand colors from brand context or legacy settings
    const brandColors = brandContext 
      ? { 
          primary: brandContext.colors.primary, 
          secondary: brandContext.colors.secondary || brandContext.colors.primary 
        }
      : settings?.brand_colors as { primary: string; secondary: string } | null

    if (streaming) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            await streamLandingPageHTML(content, brandColors || undefined, (chunk) => {
              controller.enqueue(encoder.encode(chunk))
            })
            controller.close()
          } catch (error) {
            controller.error(error)
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Transfer-Encoding': 'chunked',
        },
      })
    }

    // Generate complete HTML
    const html = await streamLandingPageHTML(content, brandColors || undefined)

    // Inject brand fonts if available
    let finalHtml = html
    if (brandContext) {
      const fontLink = getBrandFontLink(brandContext)
      const brandCss = generateBrandCSS(brandContext)
      
      finalHtml = html.replace(
        '</head>',
        `<link href="${fontLink}" rel="stylesheet">
<style>${brandCss}</style>
</head>`
      )
    }

    return NextResponse.json({ 
      content,
      html: finalHtml,
      brandApplied: !!brandContext,
      workspaceId,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate landing page'
    console.error('Error generating landing page:', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
