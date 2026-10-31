/**
 * Brand-Aware Assembly Engine
 *
 * Injects brand tokens (colors, fonts, spacing) into design skeletons and
 * fills content slots with AI-generated content.
 *
 * This is the core of the "Template-as-DNA" pipeline:
 * skeleton structure + brand tokens + AI content = branded output.
 */

import type { DesignSkeleton, ComponentSlot } from './design-system-compiler'
import { generateBrandCSS, type BrandContext } from '@/lib/ai/brand-context'

// ============================================================================
// Types
// ============================================================================

export interface BrandMemoryTokens {
  colors: Array<{ value: string; role: string; format?: string }>
  fonts: Array<{ family: string; weight?: string; role: string }>
  spacing?: { base: number; scale: number[] }
  logoUrl?: string
  borderRadius?: string
}

export interface SectionContent {
  headline?: string
  subheadline?: string
  body?: string
  cta?: string
  items?: string[]
  image?: string
  testimonial?: { quote: string; author: string; title?: string }
  stat?: { value: string; label: string }
  logo?: string
}

// ============================================================================
// Core assembly
// ============================================================================

/**
 * Assemble a single section: skeleton + brand tokens + content
 */
export function assembleSectionHTML(
  skeleton: DesignSkeleton,
  content: SectionContent,
  brand: BrandMemoryTokens
): string {
  // 1. Inject brand tokens into skeleton CSS
  const brandedCSS = injectBrandTokens(skeleton.layoutCSS, brand)

  // 2. Fill content slots in HTML
  const filledHTML = fillContentSlots(skeleton.structureHTML, content, skeleton.componentSlots)

  // 3. Combine with scoped styles
  const scopeId = `section-${skeleton.id.slice(0, 8)}`
  return `<section class="${scopeId}" data-skeleton="${skeleton.id}" data-type="${skeleton.sectionType}">
<style>
.${scopeId} {
${brandedCSS}
}
</style>
${filledHTML}
</section>`
}

/**
 * Assemble a full page from multiple sections
 */
export function assembleFullPage(
  sections: Array<{ skeleton: DesignSkeleton; content: SectionContent }>,
  brand: BrandMemoryTokens,
  options?: {
    title?: string
    description?: string
    globalCSS?: string
  }
): string {
  const brandCSS = buildBrandCSSVariables(brand)
  const fontLink = buildFontLink(brand)

  const sectionsHTML = sections
    .map(({ skeleton, content }) => assembleSectionHTML(skeleton, content, brand))
    .join('\n\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${options?.title ? `<title>${escapeHtml(options.title)}</title>` : ''}
  ${options?.description ? `<meta name="description" content="${escapeHtml(options.description)}">` : ''}
  ${fontLink}
  <style>
    ${brandCSS}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--brand-font-family);
      background-color: var(--brand-background);
      color: var(--brand-text);
      line-height: 1.6;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: var(--brand-font-heading);
      line-height: 1.2;
    }
    img { max-width: 100%; height: auto; }
    ${options?.globalCSS ?? ''}
  </style>
</head>
<body>
${sectionsHTML}
</body>
</html>`
}

// ============================================================================
// Token injection
// ============================================================================

/**
 * Replace brand variable placeholders in CSS with actual brand values
 */
export function injectBrandTokens(css: string, brand: BrandMemoryTokens): string {
  let result = css

  // Color tokens
  const primary = brand.colors.find((c) => c.role === 'primary')?.value ?? '#000000'
  const secondary = brand.colors.find((c) => c.role === 'secondary')?.value ?? '#333333'
  const accent = brand.colors.find((c) => c.role === 'accent')?.value ?? primary
  const background = brand.colors.find((c) => c.role === 'background')?.value ?? '#ffffff'
  const text = brand.colors.find((c) => c.role === 'text')?.value ?? '#111111'

  result = result.replace(/var\(--brand-primary\)/g, primary)
  result = result.replace(/var\(--brand-secondary\)/g, secondary)
  result = result.replace(/var\(--brand-accent\)/g, accent)
  result = result.replace(/var\(--brand-background\)/g, background)
  result = result.replace(/var\(--brand-text\)/g, text)

  // Font tokens
  const headingFont = brand.fonts.find((f) => f.role === 'heading')?.family ?? 'Inter'
  const bodyFont = brand.fonts.find((f) => f.role === 'body')?.family ?? 'Inter'

  result = result.replace(/var\(--brand-font-heading\)/g, `'${headingFont}', system-ui, sans-serif`)
  result = result.replace(/var\(--brand-font-family\)/g, `'${bodyFont}', system-ui, sans-serif`)

  // Spacing tokens
  if (brand.spacing) {
    result = result.replace(/var\(--brand-spacing-base\)/g, `${brand.spacing.base}px`)
  }

  // Border radius
  if (brand.borderRadius) {
    result = result.replace(/var\(--brand-radius\)/g, brand.borderRadius)
  }

  return result
}

// ============================================================================
// Content slot filling
// ============================================================================

function fillContentSlots(
  html: string,
  content: SectionContent,
  slots: ComponentSlot[]
): string {
  let result = html

  // Fill named slots
  if (content.headline) {
    result = result.replace(/\{\{headline\}\}/g, escapeHtml(content.headline))
  }
  if (content.subheadline) {
    result = result.replace(/\{\{subheadline\}\}/g, escapeHtml(content.subheadline))
  }
  if (content.body) {
    result = result.replace(/\{\{body\}\}/g, escapeHtml(content.body))
  }
  if (content.cta) {
    result = result.replace(/\{\{cta\}\}/g, escapeHtml(content.cta))
  }
  if (content.image) {
    result = result.replace(/\{\{image\}\}/g, content.image)
  }
  if (content.logo) {
    result = result.replace(/\{\{logo\}\}/g, content.logo)
  }

  // Fill list items
  if (content.items?.length) {
    const listHtml = content.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n')
    result = result.replace(/\{\{items\}\}/g, listHtml)
  }

  // Fill testimonial
  if (content.testimonial) {
    result = result.replace(/\{\{quote\}\}/g, escapeHtml(content.testimonial.quote))
    result = result.replace(/\{\{author\}\}/g, escapeHtml(content.testimonial.author))
    result = result.replace(/\{\{author_title\}\}/g, escapeHtml(content.testimonial.title ?? ''))
  }

  // Fill stat
  if (content.stat) {
    result = result.replace(/\{\{stat_value\}\}/g, escapeHtml(content.stat.value))
    result = result.replace(/\{\{stat_label\}\}/g, escapeHtml(content.stat.label))
  }

  // Remove unfilled slots (clean up)
  result = result.replace(/\{\{[a-z_]+\}\}/gi, '')

  return result
}

// ============================================================================
// CSS variable generation
// ============================================================================

function buildBrandCSSVariables(brand: BrandMemoryTokens): string {
  const primary = brand.colors.find((c) => c.role === 'primary')?.value ?? '#000000'
  const secondary = brand.colors.find((c) => c.role === 'secondary')?.value ?? '#333333'
  const accent = brand.colors.find((c) => c.role === 'accent')?.value ?? primary
  const background = brand.colors.find((c) => c.role === 'background')?.value ?? '#ffffff'
  const text = brand.colors.find((c) => c.role === 'text')?.value ?? '#111111'
  const headingFont = brand.fonts.find((f) => f.role === 'heading')?.family ?? 'Inter'
  const bodyFont = brand.fonts.find((f) => f.role === 'body')?.family ?? 'Inter'
  const spacingBase = brand.spacing?.base ?? 8

  return `:root {
  --brand-primary: ${primary};
  --brand-secondary: ${secondary};
  --brand-accent: ${accent};
  --brand-background: ${background};
  --brand-text: ${text};
  --brand-font-heading: '${headingFont}', system-ui, sans-serif;
  --brand-font-family: '${bodyFont}', system-ui, sans-serif;
  --brand-spacing-base: ${spacingBase}px;
  --brand-radius: ${brand.borderRadius ?? '8px'};
}`
}

function buildFontLink(brand: BrandMemoryTokens): string {
  const families = new Set<string>()
  for (const font of brand.fonts) {
    if (font.family && font.family !== 'system-ui' && font.family !== 'sans-serif') {
      families.add(font.family)
    }
  }
  if (families.size === 0) families.add('Inter')

  const fontParam = Array.from(families)
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
    .join('&')

  return `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?${fontParam}&display=swap" rel="stylesheet">`
}

// ============================================================================
// Brand context adapter
// ============================================================================

/**
 * Convert a BrandContext (existing lib/ai/brand-context.ts) to BrandMemoryTokens
 */
export function brandContextToTokens(ctx: BrandContext): BrandMemoryTokens {
  return {
    colors: [
      { value: ctx.colors.primary, role: 'primary' },
      { value: ctx.colors.secondary ?? ctx.colors.primary, role: 'secondary' },
      { value: ctx.colors.accent ?? ctx.colors.primary, role: 'accent' },
      { value: ctx.colors.background ?? '#ffffff', role: 'background' },
      { value: ctx.colors.text ?? '#111111', role: 'text' },
    ],
    fonts: [
      { family: ctx.typography.fontHeading ?? ctx.typography.fontFamily, role: 'heading' },
      { family: ctx.typography.fontFamily, role: 'body' },
    ],
  }
}

// ============================================================================
// Helpers
// ============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
