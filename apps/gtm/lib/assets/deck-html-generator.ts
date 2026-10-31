/**
 * HTML Deck Generator
 *
 * Generates presentation decks as HTML slides at 1920x1080 (16:9).
 * Each slide is a standalone HTML section with brand design system.
 * Export: render each slide to image preview, full deck as multi-page PDF.
 */

import { generateObject } from '@/lib/ai/langsmith-ai'
import { z } from 'zod'
import { MODELS } from '@/lib/ai/ai-sdk-client'
import type { DesignArchetype } from '@/lib/design/archetype-selector'
import type { BrandMemoryTokens } from '@/lib/templates/brand-assembler'
import { createAssetDocument, type AssetDocument, type ContentBlock } from './asset-document'

// ============================================================================
// Types
// ============================================================================

export type SlideType =
  | 'title'
  | 'problem'
  | 'solution'
  | 'features'
  | 'stats'
  | 'testimonial'
  | 'pricing'
  | 'cta'
  | 'team'
  | 'timeline'

export interface SlideContent {
  type: SlideType
  headline: string
  subheadline?: string
  bullets?: string[]
  statValue?: string
  statLabel?: string
  quote?: string
  quoteAuthor?: string
  visualSuggestion?: string
  speakerNotes?: string
}

export interface DeckGenerationRequest {
  workspaceId: string
  brandId: string
  campaignId?: string
  title: string
  outline: string
  audience?: string
  slideCount?: number
  brand: BrandMemoryTokens
  archetype?: DesignArchetype
}

// ============================================================================
// AI Schema for deck generation
// ============================================================================

const DeckContentSchema = z.object({
  title: z.string(),
  slides: z.array(
    z.object({
      type: z.enum([
        'title', 'problem', 'solution', 'features', 'stats',
        'testimonial', 'pricing', 'cta', 'team', 'timeline',
      ]),
      headline: z.string(),
      subheadline: z.string().optional(),
      bullets: z.array(z.string()).optional(),
      statValue: z.string().optional(),
      statLabel: z.string().optional(),
      quote: z.string().optional(),
      quoteAuthor: z.string().optional(),
      speakerNotes: z.string().optional(),
    })
  ),
  claims: z.array(z.string()).describe('Marketing claims needing validation'),
})

// ============================================================================
// Main generator
// ============================================================================

export async function generateHtmlDeck(
  request: DeckGenerationRequest
): Promise<AssetDocument> {
  const slideCount = request.slideCount ?? 10

  // 1. Generate deck content via AI
  const { object: rawDeckContent } = await generateObject({
    model: MODELS.CREATIVE,
    schema: DeckContentSchema,
    prompt: `Create a ${slideCount}-slide presentation deck.
Title: ${request.title}
Outline: ${request.outline}
${request.audience ? `Audience: ${request.audience}` : ''}

Requirements:
- First slide must be type "title"
- Last slide must be type "cta"
- Include a mix of slide types: problem, solution, features, stats, testimonial
- Each slide needs a clear headline and supporting content
- Keep bullets concise (max 5 per slide)
- Speaker notes should guide the presenter
- Flag any marketing claims that need evidence

Generate exactly ${slideCount} slides.`,
  })
  const deckContent = rawDeckContent as { title: string; slides: SlideContent[]; claims: string[] }

  // 2. Render each slide to HTML
  const slideHtmls = deckContent.slides.map((slide) =>
    renderSlideHtml(slide, request.brand, request.archetype)
  )

  // 3. Build full deck HTML
  const fullHtml = buildDeckDocument(slideHtmls, deckContent.title, request.brand)

  // 4. Build content blocks for editor
  const blocks: ContentBlock[] = deckContent.slides.map((slide, i) => ({
    id: crypto.randomUUID(),
    type: slide.type === 'title' ? 'headline' as const : 'custom' as const,
    content: slideHtmls[i],
    position: { x: 0, y: i * 1080 },
  }))

  // 5. Create AssetDocument
  return createAssetDocument({
    workspaceId: request.workspaceId,
    brandId: request.brandId,
    campaignId: request.campaignId,
    type: 'deck',
    html: fullHtml,
    blocks,
    designTokens: {
      colors: {
        primary: request.brand.colors.find((c) => c.role === 'primary')?.value ?? '#3b82f6',
        secondary: request.brand.colors.find((c) => c.role === 'secondary')?.value ?? '#1e293b',
        background: request.brand.colors.find((c) => c.role === 'background')?.value ?? '#0f172a',
        text: request.brand.colors.find((c) => c.role === 'text')?.value ?? '#f8fafc',
      },
      typography: {
        heading: request.brand.fonts.find((f) => f.role === 'heading')?.family ?? 'Inter',
        body: request.brand.fonts.find((f) => f.role === 'body')?.family ?? 'Inter',
        sizes: { h1: '64px', h2: '48px', h3: '32px', body: '24px' },
      },
      spacing: { base: 8, scale: [8, 16, 24, 32, 48, 64, 80] },
    },
    dimensions: { width: 1920, height: 1080 },
    claims: (deckContent.claims ?? []).map((text) => ({
      id: crypto.randomUUID(),
      text,
      riskScore: 0,
      riskLevel: 'low' as const,
      status: 'unverified' as const,
      evidenceIds: [],
    })),
    title: deckContent.title,
  })
}

// ============================================================================
// Slide HTML rendering
// ============================================================================

function renderSlideHtml(
  slide: SlideContent,
  brand: BrandMemoryTokens,
  archetype?: DesignArchetype
): string {
  const primary = brand.colors.find((c) => c.role === 'primary')?.value ?? '#3b82f6'
  const bg = brand.colors.find((c) => c.role === 'background')?.value ?? '#0f172a'
  const text = brand.colors.find((c) => c.role === 'text')?.value ?? '#f8fafc'
  const headingFont = brand.fonts.find((f) => f.role === 'heading')?.family ?? 'Georgia'
  const bodyFont = brand.fonts.find((f) => f.role === 'body')?.family ?? 'system-ui'
  const radius = archetype?.borderRadius ?? '24px'
  const spacing = archetype?.spacingDensity === 'spacious' ? 96 : archetype?.spacingDensity === 'compact' ? 64 : 80
  const surface = archetype?.deck === 'clean-light' ? '#f8fafc' : bg
  const copyColor = archetype?.deck === 'clean-light' ? '#111827' : text

  const baseStyle = `width:1920px;height:1080px;padding:${spacing}px;display:flex;flex-direction:column;justify-content:center;background:${surface};color:${copyColor};font-family:'${bodyFont}',system-ui,sans-serif;overflow:hidden;position:relative;`
  const kicker = `<div style="font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:${primary};opacity:0.82;margin-bottom:20px;">
  ${esc(slide.type.replace('_', ' '))}
</div>`

  switch (slide.type) {
    case 'title':
      return `<div style="${baseStyle}align-items:center;text-align:center;background:color-mix(in oklch, ${surface} 94%, ${primary} 6%);">
  ${kicker}
  <h1 style="font-family:'${headingFont}',system-ui,sans-serif;font-size:72px;font-weight:800;line-height:1.1;max-width:80%;">${esc(slide.headline)}</h1>
  ${slide.subheadline ? `<p style="font-size:28px;opacity:0.7;margin-top:24px;max-width:60%;">${esc(slide.subheadline)}</p>` : ''}
</div>`

    case 'stats':
      return `<div style="${baseStyle}align-items:center;text-align:center;">
  ${kicker}
  <p style="font-size:120px;font-weight:800;color:${primary};line-height:1;">${esc(slide.statValue ?? '')}</p>
  <p style="font-size:32px;font-weight:600;margin-top:16px;text-transform:uppercase;letter-spacing:3px;">${esc(slide.statLabel ?? '')}</p>
  <div style="width:80px;height:4px;background:${primary};border-radius:2px;margin:32px 0;"></div>
  <p style="font-size:24px;opacity:0.6;max-width:60%;">${esc(slide.headline)}</p>
</div>`

    case 'testimonial':
      return `<div style="${baseStyle}">
  ${kicker}
  <div style="font-size:80px;color:${primary};line-height:1;margin-bottom:16px;">"</div>
  <p style="font-size:32px;line-height:1.5;max-width:80%;font-style:italic;">${esc(slide.quote ?? slide.headline)}</p>
  <p style="font-size:20px;opacity:0.6;margin-top:32px;font-weight:600;">— ${esc(slide.quoteAuthor ?? '')}</p>
</div>`

    case 'cta':
      return `<div style="${baseStyle}align-items:center;text-align:center;background:color-mix(in oklch, ${surface} 92%, ${primary} 8%);">
  ${kicker}
  <h2 style="font-family:'${headingFont}',system-ui,sans-serif;font-size:56px;font-weight:700;line-height:1.2;max-width:80%;">${esc(slide.headline)}</h2>
  ${slide.subheadline ? `<p style="font-size:24px;opacity:0.7;margin-top:20px;max-width:60%;">${esc(slide.subheadline)}</p>` : ''}
  <div style="margin-top:40px;padding:18px 48px;background:${primary};border-radius:${radius};font-size:24px;font-weight:600;color:${surface};">
    ${esc(slide.bullets?.[0] ?? 'Get Started')}
  </div>
</div>`

    default:
      // Generic content slide (problem, solution, features, pricing, team, timeline)
      return `<div style="${baseStyle}">
  ${kicker}
  <div style="display:grid;grid-template-columns:${slide.type === 'solution' || slide.type === 'features' ? '1.2fr 0.8fr' : '1fr'};gap:48px;align-items:${slide.type === 'problem' ? 'center' : 'start'};">
  <div>
  <h2 style="font-family:'${headingFont}',system-ui,sans-serif;font-size:48px;font-weight:700;margin-bottom:32px;color:${primary};">${esc(slide.headline)}</h2>
  ${slide.subheadline ? `<p style="font-size:24px;opacity:0.7;margin-bottom:32px;">${esc(slide.subheadline)}</p>` : ''}
  ${slide.bullets?.length ? `<div style="display:flex;flex-direction:column;gap:20px;">
    ${slide.bullets.map((b) => `<div style="display:flex;align-items:flex-start;gap:16px;">
      <span style="color:${primary};font-size:24px;font-weight:700;">→</span>
      <span style="font-size:24px;line-height:1.5;">${esc(b)}</span>
    </div>`).join('')}
  </div>` : ''}
  </div>
  ${slide.type === 'solution' || slide.type === 'features' ? `<div style="border:1px solid color-mix(in oklch, ${copyColor} 12%, transparent);border-radius:${radius};padding:32px;background:color-mix(in oklch, ${surface} 86%, ${primary} 14%);min-height:340px;display:flex;align-items:center;justify-content:center;font-family:'${headingFont}',system-ui,sans-serif;font-size:26px;line-height:1.3;text-align:center;">${esc(slide.visualSuggestion || 'Product visual placeholder')}</div>` : ''}
  </div>
</div>`
  }
}

function buildDeckDocument(
  slideHtmls: string[],
  title: string,
  brand: BrandMemoryTokens
): string {
  const headingFont = brand.fonts.find((f) => f.role === 'heading')?.family ?? 'Inter'

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(headingFont)}:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: 1920px 1080px; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .slide { page-break-after: always; }
  .slide:last-child { page-break-after: auto; }
</style>
</head><body>
${slideHtmls.map((html, i) => `<div class="slide" data-slide="${i + 1}">${html}</div>`).join('\n')}
</body></html>`
}

// ============================================================================
// Extract individual slide HTML for editing
// ============================================================================

export function extractSlideHtmls(deckHtml: string): string[] {
  const matches = [...deckHtml.matchAll(/<div class="slide"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="slide"|<\/body>)/gi)]
  return matches.map((m) => m[1])
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
