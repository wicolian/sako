/**
 * HTML Generation Library
 *
 * Generates landing page HTML from campaign data and page blocks.
 * Supports multiple output formats for different platforms.
 * Brand-native and archetype-aware.
 */

import type { DesignArchetype } from '@/lib/design/archetype-selector'
import type { BrandContext } from '@/lib/ai/brand-context'
import { getBrandFontLink } from '@/lib/ai/brand-context'
import type { CreativeRoute } from '@/lib/planning/types'

export interface Campaign {
  id: string
  name: string
  goal?: string
  audience?: string
  cta?: string
}

export interface PageBlock {
  id: string
  type: string
  order: number
  props?: Record<string, unknown>
}

export interface HtmlGeneratorOptions {
  /** Include CSS inline (default: true) */
  inlineStyles?: boolean
  /** Include meta tags */
  includeMeta?: boolean
  /** Primary brand color */
  primaryColor?: string
  /** Custom fonts to include */
  fonts?: string[]
  /** Include tracking scripts */
  includeTracking?: boolean
  /** Full brand context for design-token-aware generation */
  brand?: BrandContext
  /** Archetype drives layout, spacing, corners */
  archetype?: DesignArchetype
  /** Selected route sharpens hero framing and section order */
  route?: CreativeRoute
}

type SectionType = 'hero' | 'benefits' | 'stats' | 'testimonial' | 'how-it-works' | 'cta'

/**
 * Select section order based on archetype
 */
function selectSectionOrder(
  archetype: DesignArchetype | undefined,
  route?: CreativeRoute,
): SectionType[] {
  if (route?.landingOrder?.length) {
    return route.landingOrder
      .map((entry) => normalizeSectionType(entry))
      .filter((entry): entry is SectionType => Boolean(entry))
  }

  switch (archetype?.landingPage) {
    case 'developer':
      return ['hero', 'how-it-works', 'benefits', 'cta']
    case 'trust-forward':
      return ['hero', 'stats', 'benefits', 'testimonial', 'cta']
    case 'storytelling':
      return ['hero', 'benefits', 'testimonial', 'cta']
    case 'product-led':
      return ['hero', 'benefits', 'how-it-works', 'testimonial', 'cta']
    default:
      return ['hero', 'benefits', 'testimonial', 'stats', 'cta']
  }
}

function normalizeSectionType(value: string): SectionType | null {
  switch (value) {
    case 'hero':
      return 'hero'
    case 'features':
    case 'benefits':
      return 'benefits'
    case 'stats':
      return 'stats'
    case 'testimonial':
    case 'testimonials':
      return 'testimonial'
    case 'faq':
    case 'how-it-works':
      return 'how-it-works'
    case 'cta':
      return 'cta'
    default:
      return null
  }
}

/**
 * Generate CSS custom properties :root block from brand + archetype
 */
export function generateBrandCSSVariables(
  brand: BrandContext | undefined,
  archetype: DesignArchetype | undefined,
  primaryColor: string = '#9ae83e',
): string {
  const primary = brand?.colors.primary ?? primaryColor
  const secondary = brand?.colors.secondary ?? primary
  const accent = brand?.colors.accent ?? primary
  const bg = brand?.colors.background ?? (archetype?.prefersDark ? '#0f0f0f' : '#ffffff')
  const text = brand?.colors.text ?? (archetype?.prefersDark ? '#f9fafb' : '#111827')

  const headingFont = brand?.typography.fontHeading ?? brand?.typography.fontFamily ?? 'Georgia'
  const bodyFont = brand?.typography.fontFamily ?? 'system-ui'

  const radiusSm = archetype?.borderRadius ?? '8px'
  const space = archetype?.spacingUnit ?? 8

  return `:root {
  --brand-primary: ${primary};
  --brand-secondary: ${secondary};
  --brand-accent: ${accent};
  --brand-bg: ${bg};
  --brand-text: ${text};
  --brand-primary-subtle: color-mix(in oklch, ${primary} 12%, transparent);
  --brand-surface: color-mix(in oklch, ${bg} 97%, ${text} 3%);
  --brand-border: color-mix(in oklch, ${text} 12%, transparent);
  --font-heading: '${headingFont}', system-ui, sans-serif;
  --font-body: '${bodyFont}', system-ui, sans-serif;
  --radius-sm: ${radiusSm};
  --radius-md: calc(${radiusSm} * 2);
  --radius-lg: calc(${radiusSm} * 3);
  --space: ${space}px;
  --section-gap: calc(var(--space) * 10);
  --content-gap: calc(var(--space) * 3);
}`
}

/**
 * Generate full CSS styles from brand + archetype
 */
export function generateBrandStyles(
  brand: BrandContext | undefined,
  archetype: DesignArchetype | undefined,
  route: CreativeRoute | undefined,
  primaryColor: string = '#9ae83e',
): string {
  const variables = generateBrandCSSVariables(brand, archetype, primaryColor)

  const heroAlignment =
    route?.heroFraming === 'proof-led' || route?.heroFraming === 'technical-brief' || archetype?.landingPage === 'trust-forward'
      ? 'align-items: flex-start; text-align: left;'
      : 'align-items: center; text-align: center;'

  const heroBg =
    route?.ornamentAllowance === 'none' || archetype?.backgroundTreatment === 'plain'
      ? 'background: var(--brand-bg); border-bottom: 1px solid var(--brand-border);'
      : route?.heroFraming === 'editorial-story'
      ? 'background: linear-gradient(180deg, color-mix(in oklch, var(--brand-bg) 94%, var(--brand-secondary) 6%) 0%, var(--brand-bg) 100%);'
      : archetype?.backgroundTreatment === 'tinted'
      ? 'background: color-mix(in oklch, var(--brand-bg) 96%, var(--brand-primary) 4%);'
      : archetype?.backgroundTreatment === 'editorial-wash'
      ? 'background: linear-gradient(180deg, color-mix(in oklch, var(--brand-bg) 92%, var(--brand-secondary) 8%) 0%, var(--brand-bg) 100%);'
      : 'background: linear-gradient(180deg, color-mix(in oklch, var(--brand-bg) 90%, var(--brand-primary) 10%) 0%, var(--brand-bg) 100%);'

  const heroMinHeight = route?.heroFraming === 'editorial-story' || archetype?.landingPage === 'storytelling' ? '85vh' : '65vh'

  const ctaPadding =
    route?.ctaStyle === 'pill' ? '16px 40px' : archetype?.spacingDensity === 'spacious' ? '18px 48px' : '14px 36px'

  const sectionTitleAlign =
    route?.heroFraming === 'editorial-story' || archetype?.landingPage === 'trust-forward' ? 'left' : 'center'

  const bodyLetterSpacing = route?.typographyMode === 'technical' ? '0.01em' : '0'
  const benefitHover =
    route?.motionPolicy === 'none'
      ? 'transition: none;'
      : 'transition: border-color 0.2s ease, box-shadow 0.2s ease;'

  return `${variables}

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--font-body);
      background: var(--brand-bg);
      color: var(--brand-text);
      line-height: 1.6;
      letter-spacing: ${bodyLetterSpacing};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-heading);
    }

    .hero {
      padding: clamp(60px, 10vw, 120px) clamp(20px, 5vw, 48px);
      display: flex;
      flex-direction: column;
      justify-content: center;
      ${heroAlignment}
      ${heroBg}
      min-height: ${heroMinHeight};
      container-type: inline-size;
    }

    .hero h1 {
      font-size: clamp(2rem, 5cqi, 3.5rem);
      font-weight: 800;
      letter-spacing: -0.03em;
      margin-bottom: calc(var(--space) * 2);
      max-width: 900px;
    }

    .hero .eyebrow {
      font-size: 0.78rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.7;
      margin-bottom: calc(var(--space) * 2);
    }

    .hero .subheadline {
      font-size: clamp(1rem, 2cqi, 1.25rem);
      opacity: 0.75;
      max-width: 640px;
      margin-bottom: calc(var(--space) * 4);
    }

    .cta-button {
      background: var(--brand-primary);
      color: ${route?.ctaStyle === 'outline' ? 'var(--brand-text)' : 'var(--brand-bg)'};
      padding: ${ctaPadding};
      border-radius: ${route?.ctaStyle === 'pill' ? '9999px' : 'var(--radius-sm)'};
      font-weight: 600;
      text-decoration: none;
      display: inline-block;
      font-size: 1.05rem;
      border: ${route?.ctaStyle === 'outline' ? '1px solid var(--brand-border)' : 'none'};
      transition: ${route?.motionPolicy === 'none' ? 'none' : 'filter 0.2s ease'};
    }

    .cta-button:hover {
      filter: brightness(1.1);
    }

    .section {
      padding: var(--section-gap) clamp(20px, 5vw, 48px);
      max-width: 1280px;
      margin-inline: auto;
    }

    .section-title {
      font-size: clamp(1.5rem, 3vw, 2.25rem);
      text-align: ${sectionTitleAlign};
      margin-bottom: var(--content-gap);
    }

    .benefits-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: calc(var(--space) * 3);
    }

    .benefit-card {
      padding: calc(var(--space) * 3);
      border: 1px solid var(--brand-border);
      border-radius: var(--radius-md);
      background: var(--brand-surface);
      ${benefitHover}
    }

    .benefit-card:hover {
      border-color: color-mix(in oklch, var(--brand-primary) 28%, var(--brand-border));
      box-shadow: 0 4px 24px color-mix(in oklch, var(--brand-primary) 20%, transparent);
    }

    .benefit-card h3 {
      font-size: 1.2rem;
      margin-bottom: calc(var(--space) * 1);
    }

    .benefit-card p {
      opacity: 0.75;
    }

    .stats-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: calc(var(--space) * 2);
      background: color-mix(in oklch, var(--brand-bg) 94%, var(--brand-primary) 6%);
      color: var(--brand-text);
      padding: calc(var(--space) * 5) clamp(20px, 5vw, 48px);
      text-align: center;
      border: 1px solid var(--brand-border);
      border-radius: var(--radius-md);
    }

    .stat-number {
      font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 800;
      font-family: var(--font-heading);
      line-height: 1;
      margin-bottom: calc(var(--space) * 1);
    }

    .stat-label {
      font-size: 0.9rem;
      opacity: 0.85;
    }

    .testimonial-block {
      border-left: 4px solid var(--brand-primary);
      padding: calc(var(--space) * 3) calc(var(--space) * 4);
      margin-bottom: calc(var(--space) * 3);
      background: var(--brand-surface);
      border-radius: 0 var(--radius-md) var(--radius-md) 0;
    }

    .testimonial-block blockquote {
      font-size: 1.15rem;
      font-style: italic;
      margin-bottom: calc(var(--space) * 1);
    }

    .testimonial-block cite {
      font-style: normal;
      opacity: 0.7;
      font-size: 0.9rem;
    }

    .cta-section {
      background: color-mix(in oklch, var(--brand-bg) 92%, var(--brand-primary) 8%);
      color: var(--brand-text);
      padding: var(--section-gap) clamp(20px, 5vw, 48px);
      text-align: center;
      border: 1px solid var(--brand-border);
      border-radius: var(--radius-lg);
    }

    .cta-section h2 {
      font-size: clamp(1.5rem, 3vw, 2.25rem);
      margin-bottom: calc(var(--space) * 2);
    }

    .cta-section .cta-button {
      background: var(--brand-primary);
      color: var(--brand-bg);
    }

    .how-it-works {
      counter-reset: steps;
    }

    .how-it-works-step {
      display: flex;
      gap: calc(var(--space) * 3);
      align-items: flex-start;
      margin-bottom: calc(var(--space) * 4);
      counter-increment: steps;
    }

    .how-it-works-step::before {
      content: counter(steps);
      font-family: var(--font-heading);
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--brand-primary);
      min-width: 2.5rem;
      text-align: center;
    }

    .footer {
      border-top: 1px solid var(--brand-border);
      padding: calc(var(--space) * 5) clamp(20px, 5vw, 48px);
      text-align: center;
      background: var(--brand-bg);
      opacity: 0.7;
    }

    @media (max-width: 640px) {
      .hero {
        min-height: auto;
        padding: 48px 20px;
        align-items: flex-start;
        text-align: left;
      }

      .section {
        padding: calc(var(--space) * 6) 20px;
      }

      .benefits-grid {
        grid-template-columns: 1fr;
      }

      .stats-strip {
        grid-template-columns: repeat(2, 1fr);
      }

      .how-it-works-step {
        flex-direction: column;
        gap: calc(var(--space) * 1);
      }
    }`.trim()
}

/**
 * Generate CSS styles for the landing page (legacy wrapper)
 */
export function generateStyles(primaryColor: string = '#9ae83e'): string {
  return generateBrandStyles(undefined, undefined, undefined, primaryColor)
}

/**
 * Generate a complete landing page HTML document
 */
export function generateLandingPageHtml(
  campaign: Campaign,
  blocks: PageBlock[],
  heroBlock?: PageBlock | null,
  options: HtmlGeneratorOptions = {}
): string {
  const {
    inlineStyles = true,
    includeMeta = true,
    primaryColor = '#9ae83e',
    fonts = ['Inter'],
    brand,
    archetype,
    route,
  } = options

  const heroProps = (heroBlock?.props as Record<string, unknown>) || {}

  // Build font link: prefer brand typography, fall back to manual fonts list
  const fontLinkHref = brand
    ? getBrandFontLink(brand)
    : fonts
        .map(font => `family=${encodeURIComponent(font)}:wght@400;500;600;700`)
        .join('&')

  const fontLink = brand
    ? `<link href="${fontLinkHref}" rel="stylesheet">`
    : fonts.length > 0
    ? `<link href="https://fonts.googleapis.com/css2?${fontLinkHref}&display=swap" rel="stylesheet">`
    : ''

  const styles = inlineStyles ? generateBrandStyles(brand, archetype, route, primaryColor) : ''
  const metaTags = includeMeta ? generateMetaTags(campaign) : ''

  const sectionOrder = selectSectionOrder(archetype, route)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(campaign.name)}</title>
  ${metaTags}
  ${fontLink}
  ${styles ? `<style>\n${styles}\n  </style>` : ''}
</head>
<body>
  ${generateHeroSection(campaign, heroProps, route)}

  ${generateOrderedBlocksHtml(blocks, sectionOrder)}

  ${generateFooter()}
</body>
</html>`.trim()
}

/**
 * Generate just the body HTML (for embedding)
 */
export function generateBodyHtml(
  campaign: Campaign,
  blocks: PageBlock[],
  heroBlock?: PageBlock | null,
  options: HtmlGeneratorOptions = {}
): string {
  const heroProps = (heroBlock?.props as Record<string, unknown>) || {}
  const { archetype } = options
  const sectionOrder = selectSectionOrder(archetype, options.route)

  return `
${generateHeroSection(campaign, heroProps, options.route)}
${generateOrderedBlocksHtml(blocks, sectionOrder)}
${generateFooter()}
`.trim()
}

/**
 * Generate hero section HTML
 */
function generateHeroSection(
  campaign: Campaign,
  heroProps: Record<string, unknown>,
  route?: CreativeRoute,
): string {
  const headline = (heroProps.headline as string) || campaign.name
  const subheadline = (heroProps.subheadline as string) || campaign.goal || ''
  const ctaText = (heroProps.cta_text as string) || campaign.cta || 'Get Started'
  const ctaUrl = (heroProps.cta_url as string) || '#form'
  const eyebrow =
    route?.heroFraming === 'proof-led'
      ? '<div class="eyebrow">Proof-led overview</div>'
      : route?.heroFraming === 'technical-brief'
        ? '<div class="eyebrow">Technical brief</div>'
        : route?.heroFraming === 'editorial-story'
          ? '<div class="eyebrow">Story-driven launch</div>'
          : route?.heroFraming === 'product-led'
            ? '<div class="eyebrow">Product walkthrough</div>'
            : '<div class="eyebrow">Conversion-focused overview</div>'

  return `
  <section class="hero">
    ${eyebrow}
    <h1>${escapeHtml(headline)}</h1>
    ${subheadline ? `<p class="subheadline">${escapeHtml(subheadline)}</p>` : ''}
    <a href="${escapeHtml(ctaUrl)}" class="cta-button">${escapeHtml(ctaText)}</a>
  </section>`
}

export function generateHeroSectionHtml(
  campaign: Pick<Campaign, 'name' | 'goal' | 'cta'>,
  heroProps: Record<string, unknown>,
  _archetype?: DesignArchetype,
  route?: CreativeRoute,
): string {
  return generateHeroSection(
    {
      id: 'hero',
      name: campaign.name,
      goal: campaign.goal,
      cta: campaign.cta,
    },
    heroProps,
    route,
  )
}

/**
 * Generate HTML for page blocks following section order
 */
function generateOrderedBlocksHtml(blocks: PageBlock[], sectionOrder: SectionType[]): string {
  const sections: string[] = []

  const benefitBlocks = blocks.filter(b => b.type === 'benefits' || b.type === 'feature')
  const statsBlocks = blocks.filter(b => b.type === 'stats')
  const testimonialBlocks = blocks.filter(b => b.type === 'testimonial')
  const ctaBlocks = blocks.filter(b => b.type === 'cta')
  const textBlocks = blocks.filter(b => b.type === 'text' || b.type === 'paragraph')

  for (const sectionType of sectionOrder) {
    if (sectionType === 'hero') continue // rendered separately

    if (sectionType === 'benefits' && benefitBlocks.length > 0) {
      sections.push(`
  <section class="section">
    <h2 class="section-title">Features &amp; Benefits</h2>
    <div class="benefits-grid">
      ${benefitBlocks.map(block => generateBenefitCard(block)).join('\n      ')}
    </div>
  </section>`)
    }

    if (sectionType === 'testimonial' && testimonialBlocks.length > 0) {
      sections.push(`
  <section class="section">
    ${testimonialBlocks.map(block => generateTestimonialBlock(block)).join('\n    ')}
  </section>`)
    }

    if (sectionType === 'stats') {
      const statsSource = statsBlocks[0]?.props as Record<string, unknown> | undefined
      const statItems = Array.isArray(statsSource?.items) && statsSource.items.length > 0
        ? statsSource.items.slice(0, 4).map((item, index) => {
            const text = String(item)
            const [value, ...rest] = text.split(' ')
            return {
              value,
              label: rest.join(' ') || `Metric ${index + 1}`,
            }
          })
        : [
            { value: '10x', label: 'Faster campaigns' },
            { value: '500+', label: 'Brands trust us' },
            { value: '99%', label: 'Compliance rate' },
          ]

      sections.push(`
  <div class="stats-strip">
    ${statItems.map((item) => `
    <div class="stat-item">
      <div class="stat-number">${escapeHtml(item.value)}</div>
      <div class="stat-label">${escapeHtml(item.label)}</div>
    </div>`).join('')}
  </div>`)
    }

    if (sectionType === 'how-it-works') {
      sections.push(`
  <section class="section">
    <h2 class="section-title">How It Works</h2>
    <div class="how-it-works">
      <div class="how-it-works-step">
        <div><h3>Import your brand</h3><p>Paste your URL and we extract your brand identity automatically.</p></div>
      </div>
      <div class="how-it-works-step">
        <div><h3>Generate campaigns</h3><p>AI creates on-brand content across all your channels in minutes.</p></div>
      </div>
      <div class="how-it-works-step">
        <div><h3>Validate &amp; deploy</h3><p>Built-in compliance checks before you publish to 20+ channels.</p></div>
      </div>
    </div>
  </section>`)
    }

    if (sectionType === 'cta') {
      if (ctaBlocks.length > 0) {
        ctaBlocks.forEach(block => {
          const props = block.props || {}
          sections.push(`
  <section class="cta-section" id="form">
    <h2>${escapeHtml((props.headline as string) || 'Ready to Get Started?')}</h2>
    ${props.subheadline ? `<p>${escapeHtml(props.subheadline as string)}</p>` : ''}
    <a href="${escapeHtml((props.cta_url as string) || '#')}" class="cta-button">
      ${escapeHtml((props.cta_text as string) || 'Sign Up Now')}
    </a>
  </section>`)
        })
      } else {
        sections.push(`
  <section class="cta-section" id="form">
    <h2>Ready to Get Started?</h2>
    <div id="form-container">
      <!-- Form will be injected here -->
    </div>
  </section>`)
      }
    }
  }

  // Text sections (not part of section order, append after)
  textBlocks.forEach(block => {
    const props = block.props || {}
    sections.push(`
  <section class="section">
    ${props.title ? `<h2 class="section-title">${escapeHtml(props.title as string)}</h2>` : ''}
    ${props.content ? `<p>${escapeHtml(props.content as string)}</p>` : ''}
  </section>`)
  })

  return sections.join('\n')
}

/**
 * Generate a benefit/feature card
 */
function generateBenefitCard(block: PageBlock): string {
  const props = block.props || {}
  const title = (props.title as string) || 'Feature'
  const description = (props.description as string) || ''
  const icon = props.icon as string | undefined

  return `
      <div class="benefit-card">
        ${icon ? `<div class="benefit-icon">${icon}</div>` : ''}
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
      </div>`
}

/**
 * Generate a testimonial block
 */
function generateTestimonialBlock(block: PageBlock): string {
  const props = block.props || {}
  const quote = (props.quote as string) || (props.content as string) || ''
  const author = (props.author as string) || (props.name as string) || ''
  const company = (props.company as string) || (props.role as string) || ''

  return `
    <div class="testimonial-block">
      <blockquote>"${escapeHtml(quote)}"</blockquote>
      <cite>— ${escapeHtml(author)}${company ? `, ${escapeHtml(company)}` : ''}</cite>
    </div>`
}

/**
 * Generate footer HTML
 */
function generateFooter(): string {
  return `
  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} All rights reserved.</p>
  </footer>`
}

/**
 * Generate meta tags
 */
function generateMetaTags(campaign: Campaign): string {
  return `
  <meta name="description" content="${escapeHtml(campaign.goal || campaign.name)}">
  <meta property="og:title" content="${escapeHtml(campaign.name)}">
  <meta property="og:description" content="${escapeHtml(campaign.goal || '')}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="[og-image-placeholder]">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(campaign.name)}">`.trim()
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Generate CSS-only version for embedding
 */
export function generateEmbedCss(primaryColor: string = '#9ae83e'): string {
  return generateStyles(primaryColor)
}

/**
 * Convert page blocks to a flat HTML string (no wrapper)
 */
export function blocksToHtml(blocks: PageBlock[]): string {
  return blocks
    .sort((a, b) => a.order - b.order)
    .map(block => blockToHtml(block))
    .join('\n')
}

/**
 * Convert a single block to HTML
 */
export function blockToHtml(block: PageBlock): string {
  const props = block.props || {}

  switch (block.type) {
    case 'hero':
      return `
<section class="hero">
  <h1>${escapeHtml((props.headline as string) || '')}</h1>
  <p class="subheadline">${escapeHtml((props.subheadline as string) || '')}</p>
  <a href="${escapeHtml((props.cta_url as string) || '#')}" class="cta-button">${escapeHtml((props.cta_text as string) || 'Get Started')}</a>
</section>`

    case 'benefits':
    case 'feature':
      return `
<div class="benefit-card">
  <h3>${escapeHtml((props.title as string) || '')}</h3>
  <p>${escapeHtml((props.description as string) || '')}</p>
</div>`

    case 'testimonial':
      return `
<div class="testimonial-block">
  <blockquote>"${escapeHtml((props.quote as string) || '')}"</blockquote>
  <cite>— ${escapeHtml((props.author as string) || '')}</cite>
</div>`

    case 'text':
    case 'paragraph':
      return `
<div class="text-block">
  ${props.title ? `<h2>${escapeHtml(props.title as string)}</h2>` : ''}
  <p>${escapeHtml((props.content as string) || '')}</p>
</div>`

    case 'image':
      return `
<figure class="image-block">
  <img src="${escapeHtml((props.src as string) || '')}" alt="${escapeHtml((props.alt as string) || '')}">
  ${props.caption ? `<figcaption>${escapeHtml(props.caption as string)}</figcaption>` : ''}
</figure>`

    case 'cta':
      return `
<section class="cta-section">
  <h2>${escapeHtml((props.headline as string) || '')}</h2>
  <a href="${escapeHtml((props.cta_url as string) || '#')}" class="cta-button">${escapeHtml((props.cta_text as string) || 'Sign Up')}</a>
</section>`

    default:
      return `<!-- Unknown block type: ${block.type} -->`
  }
}
