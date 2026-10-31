/**
 * Social Post Visual Templates
 *
 * HTML templates for brand-consistent social media visuals.
 * Designed with Satori CSS constraints (flexbox only, no grid).
 *
 * Each template is a function that takes brand tokens + content
 * and returns HTML ready for Satori rendering.
 */

import type { BrandMemoryTokens } from '@/lib/templates/brand-assembler'
import type { DesignArchetype } from '@/lib/design/archetype-selector'

// ============================================================================
// Platform dimensions
// ============================================================================

export const SOCIAL_DIMENSIONS = {
  linkedin: { width: 1200, height: 627 },
  instagram_post: { width: 1080, height: 1080 },
  instagram_story: { width: 1080, height: 1920 },
  twitter: { width: 1200, height: 675 },
  facebook: { width: 1200, height: 630 },
} as const

export type SocialPlatform = keyof typeof SOCIAL_DIMENSIONS

// ============================================================================
// Template types
// ============================================================================

export type VisualCategory =
  | 'quote_card'
  | 'stat_card'
  | 'tips_list'
  | 'testimonial'
  | 'announcement'
  | 'comparison'
  | 'carousel_slide'

export interface SocialVisualContent {
  // Common
  headline?: string
  body?: string
  logoUrl?: string

  // Quote card
  quote?: string
  attribution?: string

  // Stat card
  statValue?: string
  statLabel?: string
  context?: string

  // Tips list
  tips?: string[]

  // Testimonial
  personName?: string
  personTitle?: string
  photoUrl?: string

  // Comparison
  before?: string
  after?: string
  brandName?: string
}

// ============================================================================
// Template functions
// ============================================================================

export function renderSocialVisualHtml(
  category: VisualCategory,
  content: SocialVisualContent,
  brand: BrandMemoryTokens,
  platform: SocialPlatform = 'linkedin',
  design?: DesignArchetype
): string {
  const dims = SOCIAL_DIMENSIONS[platform]
  const primary = brand.colors.find((c) => c.role === 'primary')?.value ?? '#3b82f6'
  const secondary = brand.colors.find((c) => c.role === 'secondary')?.value ?? '#1e293b'
  const background = brand.colors.find((c) => c.role === 'background')?.value ?? '#0f172a'
  const textColor = brand.colors.find((c) => c.role === 'text')?.value ?? '#f8fafc'
  const headingFont = brand.fonts.find((f) => f.role === 'heading')?.family ?? 'Georgia'
  const bodyFont = brand.fonts.find((f) => f.role === 'body')?.family ?? 'system-ui'
  const radius = design?.borderRadius ?? '24px'
  const pad = design?.spacingDensity === 'spacious' ? 72 : design?.spacingDensity === 'compact' ? 40 : 56
  const backgroundTreatment =
    design?.backgroundTreatment === 'plain'
      ? background
      : design?.backgroundTreatment === 'editorial-wash'
      ? `linear-gradient(180deg, color-mix(in oklch, ${background} 94%, ${secondary} 6%), ${background})`
      : `linear-gradient(180deg, color-mix(in oklch, ${background} 96%, ${primary} 4%), ${background})`

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${dims.width}px; height: ${dims.height}px; display: flex; align-items: center; justify-content: center; background: ${backgroundTreatment}; color: ${textColor}; font-family: '${bodyFont}', system-ui, sans-serif; overflow: hidden; }
    .card { width: 100%; height: 100%; padding: ${pad}px; display: flex; flex-direction: column; justify-content: center; position: relative; }
    h1, h2 { font-family: '${headingFont}', system-ui, sans-serif; }
    .accent { color: ${primary}; }
    .logo { position: absolute; bottom: 32px; right: 40px; width: 52px; height: 52px; }
    .brand-mark { position: absolute; top: 24px; left: 24px; padding: 10px 14px; border-radius: ${radius}; border: 1px solid color-mix(in oklch, ${textColor} 10%, transparent); background: color-mix(in oklch, ${background} 92%, ${primary} 8%); font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; }
    .divider { width: 60px; height: 4px; background: ${primary}; border-radius: 999px; margin: 20px 0; }
    .frame { border: 1px solid color-mix(in oklch, ${textColor} 12%, transparent); border-radius: ${radius}; background: color-mix(in oklch, ${background} 92%, ${primary} 8%); }
    .kicker { font-size: 13px; letter-spacing: 0.16em; text-transform: uppercase; color: color-mix(in oklch, ${textColor} 72%, transparent); margin-bottom: 16px; }
  `

  switch (category) {
    case 'quote_card':
      return wrapHtml(css, quoteCardHtml(content, primary, textColor), dims)
    case 'stat_card':
      return wrapHtml(css, statCardHtml(content, primary), dims)
    case 'tips_list':
      return wrapHtml(css, tipsListHtml(content, primary), dims)
    case 'testimonial':
      return wrapHtml(css, testimonialHtml(content, primary, secondary), dims)
    case 'announcement':
      return wrapHtml(css, announcementHtml(content, primary), dims)
    case 'comparison':
      return wrapHtml(css, comparisonHtml(content, primary, secondary), dims)
    case 'carousel_slide':
      return wrapHtml(css, carouselSlideHtml(content, primary), dims)
    default:
      return wrapHtml(css, announcementHtml(content, primary), dims)
  }
}

// ============================================================================
// Individual templates
// ============================================================================

function quoteCardHtml(content: SocialVisualContent, primary: string, text: string): string {
  return `<div class="card frame">
  ${brandMark(content.brandName)}
  <div style="font-size: 72px; color: ${primary}; line-height: 1; margin-bottom: 16px;">"</div>
  <p style="font-size: 28px; line-height: 1.5; max-width: 85%; font-weight: 500;">${esc(content.quote ?? content.body ?? '')}</p>
  <div class="divider"></div>
  <p style="font-size: 18px; opacity: 0.7; font-weight: 600;">${esc(content.attribution ?? '')}</p>
  ${logoTag(content.logoUrl)}
</div>`
}

function statCardHtml(content: SocialVisualContent, primary: string): string {
  return `<div class="card" style="align-items: center; text-align: center;">
  ${brandMark(content.brandName)}
  <div class="kicker">Proof point</div>
  <p style="font-size: 96px; font-weight: 800; color: ${primary}; line-height: 1;">${esc(content.statValue ?? '0')}</p>
  <p style="font-size: 28px; font-weight: 600; margin-top: 12px; text-transform: uppercase; letter-spacing: 2px;">${esc(content.statLabel ?? '')}</p>
  <div class="divider" style="margin: 24px auto;"></div>
  <p style="font-size: 20px; opacity: 0.7; max-width: 70%;">${esc(content.context ?? content.body ?? '')}</p>
  ${logoTag(content.logoUrl)}
</div>`
}

function tipsListHtml(content: SocialVisualContent, primary: string): string {
  const tips = content.tips ?? []
  const tipsHtml = tips
    .map(
      (tip, i) =>
        `<div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
          <span style="font-size: 20px; font-weight: 700; color: ${primary}; min-width: 36px;">${i + 1}.</span>
          <span style="font-size: 20px; line-height: 1.4;">${esc(tip)}</span>
        </div>`
    )
    .join('')

  return `<div class="card frame">
  ${brandMark(content.brandName)}
  <h2 style="font-size: 36px; font-weight: 700; margin-bottom: 32px;">${esc(content.headline ?? '')}</h2>
  ${tipsHtml}
  ${logoTag(content.logoUrl)}
</div>`
}

function testimonialHtml(content: SocialVisualContent, primary: string, secondary: string): string {
  return `<div class="card frame">
  ${brandMark(content.brandName)}
  <div style="font-size: 64px; color: ${primary}; line-height: 1; margin-bottom: 16px;">"</div>
  <p style="font-size: 24px; line-height: 1.6; max-width: 85%; font-style: italic;">${esc(content.quote ?? content.body ?? '')}</p>
  <div style="display: flex; align-items: center; margin-top: 32px;">
    ${content.photoUrl ? `<img src="${content.photoUrl}" style="width: 56px; height: 56px; border-radius: 28px; margin-right: 16px;" />` : `<div style="width: 56px; height: 56px; border-radius: 28px; background: ${secondary}; margin-right: 16px;"></div>`}
    <div>
      <p style="font-size: 18px; font-weight: 700;">${esc(content.personName ?? '')}</p>
      <p style="font-size: 14px; opacity: 0.6;">${esc(content.personTitle ?? '')}</p>
    </div>
  </div>
  ${logoTag(content.logoUrl)}
</div>`
}

function announcementHtml(content: SocialVisualContent, primary: string): string {
  return `<div class="card" style="align-items: center; text-align: center;">
  ${brandMark(content.brandName)}
  <div style="padding: 8px 24px; background: color-mix(in oklch, ${primary} 18%, transparent); border-radius: 100px; margin-bottom: 24px;">
    <span style="font-size: 14px; font-weight: 600; color: ${primary}; text-transform: uppercase; letter-spacing: 2px;">Launch</span>
  </div>
  <h1 style="font-size: 48px; font-weight: 800; line-height: 1.1; max-width: 90%;">${esc(content.headline ?? '')}</h1>
  <p style="font-size: 22px; opacity: 0.7; margin-top: 20px; max-width: 75%; line-height: 1.5;">${esc(content.body ?? '')}</p>
  ${logoTag(content.logoUrl)}
</div>`
}

function comparisonHtml(content: SocialVisualContent, primary: string, secondary: string): string {
  return `<div class="card">
  ${brandMark(content.brandName)}
  <h2 style="font-size: 32px; font-weight: 700; margin-bottom: 32px; text-align: center;">${esc(content.headline ?? '')}</h2>
  <div style="display: flex; width: 100%; gap: 24px;">
    <div style="flex: 1; padding: 32px; background: ${secondary}40; border-radius: 16px;">
      <p style="font-size: 14px; text-transform: uppercase; opacity: 0.5; margin-bottom: 12px; font-weight: 600;">Before</p>
      <p style="font-size: 20px; line-height: 1.5;">${esc(content.before ?? '')}</p>
    </div>
    <div style="flex: 1; padding: 32px; background: ${primary}20; border-radius: 16px; border: 2px solid ${primary};">
      <p style="font-size: 14px; text-transform: uppercase; color: ${primary}; margin-bottom: 12px; font-weight: 600;">After</p>
      <p style="font-size: 20px; line-height: 1.5;">${esc(content.after ?? '')}</p>
    </div>
  </div>
  ${logoTag(content.logoUrl)}
</div>`
}

function carouselSlideHtml(content: SocialVisualContent, primary: string): string {
  return `<div class="card" style="align-items: center; text-align: center;">
  ${brandMark(content.brandName)}
  <h1 style="font-size: 44px; font-weight: 800; line-height: 1.2; max-width: 85%;">${esc(content.headline ?? '')}</h1>
  <div class="divider" style="margin: 28px auto;"></div>
  <p style="font-size: 22px; opacity: 0.8; line-height: 1.6; max-width: 80%;">${esc(content.body ?? '')}</p>
  ${logoTag(content.logoUrl)}
</div>`
}

// ============================================================================
// Helpers
// ============================================================================

function wrapHtml(
  css: string,
  body: string,
  dims: { width: number; height: number }
): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>${css}</style>
</head>
<body style="width:${dims.width}px;height:${dims.height}px;">
${body}
</body></html>`
}

function logoTag(logoUrl?: string): string {
  if (!logoUrl) return ''
  return `<img class="logo" src="${logoUrl}" alt="Logo" />`
}

function brandMark(brandName?: string): string {
  if (!brandName) return ''
  return `<div class="brand-mark">${esc(brandName)}</div>`
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
