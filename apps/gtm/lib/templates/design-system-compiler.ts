/**
 * Design System Compiler
 *
 * Parses template section HTML → extracts structural skeleton with
 * brand variable placeholders and content slots.
 *
 * The skeleton is the layout DNA: CSS layout rules, component structure,
 * typography hierarchy, and spatial relationships — with all brand-specific
 * values replaced by tokens.
 */

import crypto from 'crypto'

// ============================================================================
// Types
// ============================================================================

export interface DesignSkeleton {
  id: string
  templateId: string
  sectionType: string

  /** CSS with brand variable placeholders like {{brand-primary}}, {{brand-font}} */
  layoutCSS: string

  /** HTML with content slots like {{headline}}, {{items}}, {{cta}} */
  structureHTML: string

  /** What content goes where, with constraints */
  componentSlots: ComponentSlot[]

  /** 1-10 complexity rating for matching to brand sophistication */
  complexityScore: number

  /** Vectorizable style fingerprint */
  aestheticSignature: number[]

  /** Design constraints */
  constraints: DesignConstraints
}

export interface ComponentSlot {
  id: string
  type: 'headline' | 'subheadline' | 'body' | 'cta' | 'image' | 'list' | 'testimonial' | 'stat' | 'logo'
  required: boolean
  maxLength?: number
  placeholder?: string
}

export interface DesignConstraints {
  minColors: number
  maxColors: number
  requiresImage: boolean
  supportsDarkMode: boolean
  responsivePattern: 'stack' | 'grid' | 'flex'
  maxItems?: number
}

export interface SectionMetadata {
  type: string
  category?: string
  tags?: string[]
}

// ============================================================================
// Color detection patterns
// ============================================================================

const COLOR_PATTERNS = [
  // Hex colors
  /#[0-9a-fA-F]{3,8}/g,
  // RGB/RGBA
  /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g,
  // HSL/HSLA
  /hsla?\(\s*\d+/g,
  // OKLCH
  /oklch\([^)]+\)/g,
]

const FONT_PATTERNS = [
  /font-family:\s*['"]?([^'",;]+)/gi,
  /font-family:\s*var\(--[^)]+\)/gi,
]

// ============================================================================
// Main compiler function
// ============================================================================

export function compileDesignSkeleton(
  html: string,
  css: string,
  metadata: SectionMetadata
): DesignSkeleton {
  const id = crypto.randomUUID()

  // 1. Extract and replace colors with brand tokens
  const { css: tokenizedCSS, colorCount } = tokenizeColors(css)

  // 2. Extract and replace fonts with brand tokens
  const fontTokenizedCSS = tokenizeFonts(tokenizedCSS)

  // 3. Extract content and replace with slots
  const { html: slottedHTML, slots } = extractContentSlots(html, metadata.type)

  // 4. Compute complexity score
  const complexityScore = computeComplexity(html, css, slots)

  // 5. Compute aesthetic signature vector
  const aestheticSignature = computeAestheticSignature(html, css, metadata)

  // 6. Detect design constraints
  const constraints = detectConstraints(html, css, colorCount, slots)

  return {
    id,
    templateId: '',
    sectionType: metadata.type,
    layoutCSS: fontTokenizedCSS,
    structureHTML: slottedHTML,
    componentSlots: slots,
    complexityScore,
    aestheticSignature,
    constraints,
  }
}

// ============================================================================
// Color tokenization
// ============================================================================

function tokenizeColors(css: string): { css: string; colorCount: number } {
  let result = css
  const uniqueColors = new Set<string>()

  // Collect all colors
  for (const pattern of COLOR_PATTERNS) {
    const matches = css.match(pattern) ?? []
    for (const m of matches) {
      uniqueColors.add(m.toLowerCase().trim())
    }
  }

  const colorList = Array.from(uniqueColors)

  // Sort by frequency (most used first → primary)
  const colorFreq = colorList.map((c) => ({
    color: c,
    count: (css.match(new RegExp(escapeRegex(c), 'gi')) ?? []).length,
  }))
  colorFreq.sort((a, b) => b.count - a.count)

  // Replace top colors with brand tokens
  const tokenMap: [string, string][] = [
    [colorFreq[0]?.color, 'var(--brand-primary)'],
    [colorFreq[1]?.color, 'var(--brand-secondary)'],
    [colorFreq[2]?.color, 'var(--brand-accent)'],
    [colorFreq[3]?.color, 'var(--brand-background)'],
    [colorFreq[4]?.color, 'var(--brand-text)'],
  ]

  for (const [original, token] of tokenMap) {
    if (original) {
      result = result.replace(
        new RegExp(escapeRegex(original), 'gi'),
        token
      )
    }
  }

  return { css: result, colorCount: colorList.length }
}

function tokenizeFonts(css: string): string {
  let result = css

  for (const pattern of FONT_PATTERNS) {
    result = result.replace(pattern, (match) => {
      if (match.includes('var(--')) return match
      // Replace first font-family with brand heading token
      if (match.toLowerCase().includes('heading') || match.toLowerCase().includes('title')) {
        return 'font-family: var(--brand-font-heading)'
      }
      return 'font-family: var(--brand-font-family)'
    })
  }

  return result
}

// ============================================================================
// Content slot extraction
// ============================================================================

function extractContentSlots(
  html: string,
  sectionType: string
): { html: string; slots: ComponentSlot[] } {
  let result = html
  const slots: ComponentSlot[] = []

  // Extract headlines (h1-h3)
  result = result.replace(
    /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi,
    (_match, tag, content) => {
      const slotType = tag === 'h1' ? 'headline' : 'subheadline'
      const slot: ComponentSlot = {
        id: crypto.randomUUID(),
        type: slotType as ComponentSlot['type'],
        required: tag === 'h1',
        maxLength: tag === 'h1' ? 80 : 150,
        placeholder: content.trim().replace(/<[^>]+>/g, ''),
      }
      slots.push(slot)
      return `<${tag}>{{${slotType}}}</${tag}>`
    }
  )

  // Extract paragraph content
  result = result.replace(
    /<p[^>]*>([\s\S]*?)<\/p>/gi,
    (_match, content) => {
      const slot: ComponentSlot = {
        id: crypto.randomUUID(),
        type: 'body',
        required: false,
        maxLength: 500,
        placeholder: content.trim().replace(/<[^>]+>/g, ''),
      }
      slots.push(slot)
      return '<p>{{body}}</p>'
    }
  )

  // Extract CTAs (buttons/links with CTA-like text)
  result = result.replace(
    /<(a|button)[^>]*>([\s\S]*?)<\/\1>/gi,
    (_match, tag, content) => {
      const text = content.trim().replace(/<[^>]+>/g, '')
      if (text.length < 50) {
        const slot: ComponentSlot = {
          id: crypto.randomUUID(),
          type: 'cta',
          required: false,
          maxLength: 40,
          placeholder: text,
        }
        slots.push(slot)
        return `<${tag}>{{cta}}</${tag}>`
      }
      return _match
    }
  )

  // Extract list items
  result = result.replace(
    /<ul[^>]*>([\s\S]*?)<\/ul>/gi,
    (_match, content) => {
      const slot: ComponentSlot = {
        id: crypto.randomUUID(),
        type: 'list',
        required: false,
        placeholder: content.trim().replace(/<[^>]+>/g, ''),
      }
      slots.push(slot)
      return '<ul>{{items}}</ul>'
    }
  )

  // Extract images
  result = result.replace(
    /<img[^>]*>/gi,
    (_match) => {
      const slot: ComponentSlot = {
        id: crypto.randomUUID(),
        type: 'image',
        required: false,
      }
      slots.push(slot)
      return '<img src="{{image}}" />'
    }
  )

  return { html: result, slots }
}

// ============================================================================
// Complexity scoring
// ============================================================================

function computeComplexity(
  html: string,
  css: string,
  slots: ComponentSlot[]
): number {
  let score = 1

  // More slots = more complex
  score += Math.min(slots.length, 5)

  // CSS features
  if (css.includes('grid')) score += 1
  if (css.includes('animation') || css.includes('@keyframes')) score += 1
  if (css.includes('backdrop-filter') || css.includes('blur')) score += 0.5
  if (css.includes('gradient')) score += 0.5

  // HTML depth (nested elements)
  const nestingDepth = (html.match(/<div/g) ?? []).length
  if (nestingDepth > 5) score += 1

  return Math.min(Math.round(score), 10)
}

// ============================================================================
// Aesthetic signature (384-dim vector for pgvector similarity)
// ============================================================================

function computeAestheticSignature(
  html: string,
  css: string,
  metadata: SectionMetadata
): number[] {
  // Build a 384-dimensional vector from layout features
  // This is a simplified feature extraction — in production you'd use
  // a proper embedding model on the HTML/CSS
  const features: number[] = []

  // Section type features (one-hot-ish, 20 dims)
  const sectionTypes = [
    'hero', 'features', 'testimonials', 'pricing', 'cta', 'faq',
    'stats', 'logos', 'footer', 'header', 'gallery', 'team',
    'about', 'contact', 'blog', 'comparison', 'timeline', 'steps',
    'newsletter', 'custom',
  ]
  for (const t of sectionTypes) {
    features.push(metadata.type === t ? 1.0 : 0.0)
  }

  // Layout features (30 dims)
  features.push(css.includes('grid') ? 1 : 0)
  features.push(css.includes('flex') ? 1 : 0)
  features.push(css.includes('float') ? 1 : 0)
  features.push(css.includes('position: absolute') ? 1 : 0)
  features.push(css.includes('position: fixed') ? 1 : 0)
  features.push(css.includes('gradient') ? 1 : 0)
  features.push(css.includes('border-radius') ? 1 : 0)
  features.push(css.includes('box-shadow') ? 1 : 0)
  features.push(css.includes('text-shadow') ? 1 : 0)
  features.push(css.includes('backdrop-filter') ? 1 : 0)
  features.push(css.includes('animation') ? 1 : 0)
  features.push(css.includes('@keyframes') ? 1 : 0)
  features.push(css.includes('transform') ? 1 : 0)
  features.push(css.includes('transition') ? 1 : 0)
  features.push(css.includes('opacity') ? 1 : 0)
  features.push(css.includes('overflow: hidden') ? 1 : 0)
  features.push(css.includes('z-index') ? 1 : 0)
  features.push(css.includes('clip-path') ? 1 : 0)
  features.push(css.includes('mask') ? 1 : 0)
  features.push(css.includes('filter') ? 1 : 0)

  // Spacing features
  const paddingValues = (css.match(/padding:\s*(\d+)/g) ?? []).map((m) =>
    parseInt(m.replace(/\D/g, ''), 10)
  )
  features.push(paddingValues.length > 0 ? Math.max(...paddingValues) / 100 : 0.5)
  features.push(paddingValues.length > 0 ? Math.min(...paddingValues) / 100 : 0.1)

  const marginValues = (css.match(/margin:\s*(\d+)/g) ?? []).map((m) =>
    parseInt(m.replace(/\D/g, ''), 10)
  )
  features.push(marginValues.length > 0 ? Math.max(...marginValues) / 100 : 0.5)

  // Gap features
  const gapValues = (css.match(/gap:\s*(\d+)/g) ?? []).map((m) =>
    parseInt(m.replace(/\D/g, ''), 10)
  )
  features.push(gapValues.length > 0 ? Math.max(...gapValues) / 100 : 0.3)

  // Font size features
  const fontSizes = (css.match(/font-size:\s*(\d+)/g) ?? []).map((m) =>
    parseInt(m.replace(/\D/g, ''), 10)
  )
  features.push(fontSizes.length > 0 ? Math.max(...fontSizes) / 100 : 0.48)
  features.push(fontSizes.length > 0 ? Math.min(...fontSizes) / 100 : 0.14)

  // HTML structure features
  features.push((html.match(/<h1/g) ?? []).length > 0 ? 1 : 0)
  features.push((html.match(/<h2/g) ?? []).length / 5)
  features.push((html.match(/<img/g) ?? []).length / 5)
  features.push((html.match(/<button|<a[^>]*class/g) ?? []).length / 3)

  // Pad to 384 dimensions
  while (features.length < 384) {
    features.push(0)
  }

  return features.slice(0, 384)
}

// ============================================================================
// Constraint detection
// ============================================================================

function detectConstraints(
  html: string,
  css: string,
  colorCount: number,
  slots: ComponentSlot[]
): DesignConstraints {
  const hasImages = slots.some((s) => s.type === 'image')

  let responsivePattern: DesignConstraints['responsivePattern'] = 'flex'
  if (css.includes('display: grid') || css.includes('display:grid')) {
    responsivePattern = 'grid'
  } else if (
    !css.includes('display: flex') &&
    !css.includes('display:flex')
  ) {
    responsivePattern = 'stack'
  }

  return {
    minColors: Math.max(2, Math.min(colorCount, 3)),
    maxColors: Math.min(colorCount + 1, 6),
    requiresImage: hasImages,
    supportsDarkMode: css.includes('prefers-color-scheme') || css.includes('dark'),
    responsivePattern,
    maxItems: slots.filter((s) => s.type === 'list').length > 0 ? 8 : undefined,
  }
}

// ============================================================================
// Helpers
// ============================================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
