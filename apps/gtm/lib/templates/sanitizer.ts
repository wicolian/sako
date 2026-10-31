/**
 * Template Sanitizer
 * 
 * Removes vendor branding, 3D effects, and proprietary content from purchased templates.
 * Preserves only the styles, layouts, and design patterns for AI reference.
 */

import { JSDOM } from 'jsdom'

// Patterns to remove from templates (vendor-specific)
// IMPORTANT: These ensure NO vendor branding appears in generated HTML
const VENDOR_BRAND_PATTERNS = [
  // Aura/DesignMax specific (primary vendor)
  /aura/gi,
  /aura\s*template/gi,
  /aura\s*ui/gi,
  /aura-/gi,                    // Aura class prefix
  /data-aura/gi,                // Aura data attributes
  /orbital/gi,
  /designmax/gi,
  /design\s*max/gi,
  /designtocode/gi,
  /design\s*to\s*code/gi,
  /d2c-/gi,                     // D2C class prefix
  
  // Generic vendor/attribution patterns
  /template\s*by/gi,
  /created\s*by/gi,
  /designed\s*by/gi,
  /built\s*with/gi,
  /powered\s*by/gi,
  /made\s*with\s*\w+/gi,
  /crafted\s*by/gi,
  
  // Legal/copyright patterns
  /©\s*\d{4}/gi,
  /copyright\s*\d{4}/gi,
  /all\s*rights\s*reserved/gi,
  /licensed\s*to/gi,
  /license\s*key/gi,
  
  // Common template marketplace names
  /themeforest/gi,
  /envato/gi,
  /creative\s*market/gi,
  /ui8/gi,
  /gumroad/gi,
  
  // Placeholder vendor names to catch
  /your\s*company/gi,
  /company\s*name/gi,
  /brand\s*name/gi,
]

// CSS animation patterns for 3D effects to remove
const REMOVE_3D_PATTERNS = [
  /perspective\s*:/gi,
  /transform-style\s*:\s*preserve-3d/gi,
  /rotateX\s*\([^)]+\)/gi,
  /rotateY\s*\([^)]+\)/gi,
  /rotateZ\s*\([^)]+\)/gi,
  /translate3d\s*\([^)]+\)/gi,
]

// Class names indicating 3D content or vendor branding to remove
const REMOVE_3D_CLASSES = [
  // 3D/WebGL patterns
  'orbit-scene',
  'orbit-ring',
  'planet',
  'satellite',
  '3d-',
  'three-d',
  'webgl',
  'canvas-3d',
  'three-scene',
  'gl-canvas',
  
  // Aura/vendor specific classes
  'aura-',
  'aura_',
  'd2c-',
  'designmax-',
  'orbital-',
  
  // Demo/preview classes
  'demo-',
  'preview-',
  'sample-',
  'example-',
]

interface SanitizedTemplate {
  html: string
  css: string
  designTokens: {
    colors: string[]
    fonts: string[]
    gradients: string[]
    shadows: string[]
    borderRadius: string[]
  }
  layoutType: string
  hasRemoved3D: boolean
}

export function sanitizeTemplate(rawHtml: string): SanitizedTemplate {
  const dom = new JSDOM(rawHtml)
  const document = dom.window.document

  // Track what we removed
  let hasRemoved3D = false

  // 1. Remove vendor branding from text content
  sanitizeTextContent(document)

  // 2. Remove 3D elements and classes
  hasRemoved3D = remove3DElements(document)

  // 3. Extract and clean CSS
  const { css, designTokens } = extractAndCleanCSS(document)

  // 4. Neutralize specific branded content
  neutralizeBrandedContent(document)

  // 5. Replace specific content with placeholders
  replaceWithPlaceholders(document)

  // 6. Detect layout type
  const layoutType = detectLayoutType(document)

  // Get cleaned HTML
  const html = document.body.innerHTML

  return {
    html,
    css,
    designTokens,
    layoutType,
    hasRemoved3D,
  }
}

function sanitizeTextContent(document: Document): void {
  const walker = document.createTreeWalker(
    document.body,
    4, // NodeFilter.SHOW_TEXT
    null
  )

  const textNodes: Text[] = []
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    textNodes.push(node)
  }

  for (const textNode of textNodes) {
    if (textNode.textContent) {
      let content = textNode.textContent

      // Remove vendor brand patterns
      for (const pattern of VENDOR_BRAND_PATTERNS) {
        content = content.replace(pattern, '')
      }

      // Replace with cleaned content
      textNode.textContent = content
    }
  }
}

function remove3DElements(document: Document): boolean {
  let removed = false

  // Remove elements with 3D-related classes
  for (const className of REMOVE_3D_CLASSES) {
    const elements = document.querySelectorAll(`[class*="${className}"]`)
    elements.forEach((el) => {
      // Replace with a placeholder div to maintain layout
      const placeholder = document.createElement('div')
      placeholder.className = 'visual-placeholder'
      placeholder.setAttribute('data-original', className)
      placeholder.style.cssText = 'min-height: 200px; background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1));'
      el.parentNode?.replaceChild(placeholder, el)
      removed = true
    })
  }

  // Remove canvas elements (likely WebGL/3D)
  const canvases = document.querySelectorAll('canvas')
  canvases.forEach((canvas) => {
    const placeholder = document.createElement('div')
    placeholder.className = 'visual-placeholder canvas-replacement'
    placeholder.style.cssText = 'min-height: 300px; background: radial-gradient(circle at center, rgba(99,102,241,0.15), transparent);'
    canvas.parentNode?.replaceChild(placeholder, canvas)
    removed = true
  })

  return removed
}

function extractAndCleanCSS(document: Document): { css: string; designTokens: SanitizedTemplate['designTokens'] } {
  const styleElements = document.querySelectorAll('style')
  let allCss = ''

  const designTokens: SanitizedTemplate['designTokens'] = {
    colors: [],
    fonts: [],
    gradients: [],
    shadows: [],
    borderRadius: [],
  }

  styleElements.forEach((style) => {
    let css = style.textContent || ''

    // Remove 3D-related CSS
    for (const pattern of REMOVE_3D_PATTERNS) {
      css = css.replace(pattern, '/* removed-3d */')
    }

    // Extract design tokens
    
    // Colors (hex, rgb, hsl)
    const colorMatches = css.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g) || []
    designTokens.colors.push(...colorMatches)

    // Font families
    const fontMatches = css.match(/font-family:\s*([^;]+)/g) || []
    fontMatches.forEach((match) => {
      const font = match.replace('font-family:', '').trim()
      if (!designTokens.fonts.includes(font)) {
        designTokens.fonts.push(font)
      }
    })

    // Gradients
    const gradientMatches = css.match(/linear-gradient\([^)]+\)|radial-gradient\([^)]+\)/g) || []
    designTokens.gradients.push(...gradientMatches)

    // Box shadows
    const shadowMatches = css.match(/box-shadow:\s*([^;]+)/g) || []
    shadowMatches.forEach((match) => {
      const shadow = match.replace('box-shadow:', '').trim()
      if (!designTokens.shadows.includes(shadow)) {
        designTokens.shadows.push(shadow)
      }
    })

    // Border radius
    const radiusMatches = css.match(/border-radius:\s*([^;]+)/g) || []
    radiusMatches.forEach((match) => {
      const radius = match.replace('border-radius:', '').trim()
      if (!designTokens.borderRadius.includes(radius)) {
        designTokens.borderRadius.push(radius)
      }
    })

    allCss += css + '\n'
  })

  // Dedupe colors
  designTokens.colors = [...new Set(designTokens.colors)].slice(0, 20)
  designTokens.gradients = [...new Set(designTokens.gradients)].slice(0, 10)

  return { css: allCss, designTokens }
}

function neutralizeBrandedContent(document: Document): void {
  // Replace logo images with placeholders
  const logos = document.querySelectorAll('img[src*="logo"], img[alt*="logo"], .logo img')
  logos.forEach((img) => {
    img.setAttribute('src', 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><rect fill="%23374151" width="100" height="40" rx="4"/><text x="50" y="25" fill="%239CA3AF" text-anchor="middle" font-size="10">LOGO</text></svg>')
    img.setAttribute('alt', 'Company Logo')
  })

  // Replace footer copyright
  const footerTexts = document.querySelectorAll('footer p, footer span, .copyright')
  footerTexts.forEach((el) => {
    if (el.textContent?.match(/©|copyright|rights reserved/i)) {
      el.textContent = '© 2026 Company Name. All rights reserved.'
    }
  })
}

function replaceWithPlaceholders(document: Document): void {
  // Replace all headings with generic placeholders
  const headings = document.querySelectorAll('h1')
  headings.forEach((h1, index) => {
    if (index === 0) {
      h1.textContent = '[Hero Headline]'
    }
  })

  // Replace hero descriptions
  const heroP = document.querySelector('.hero p, header p, [class*="hero"] p')
  if (heroP) {
    heroP.textContent = '[Hero subheadline - describe the main value proposition]'
  }
}

function detectLayoutType(document: Document): string {
  const body = document.body
  const html = body.innerHTML.toLowerCase()

  // Check for common layout patterns
  if (html.includes('grid') && html.includes('pricing')) return 'pricing-grid'
  if (html.includes('hero') && html.includes('feature')) return 'landing-saas'
  if (html.includes('portfolio') || html.includes('gallery')) return 'portfolio'
  if (html.includes('dashboard')) return 'dashboard'
  if (html.includes('blog') || html.includes('article')) return 'blog'
  if (html.includes('contact') && html.includes('form')) return 'contact'
  if (html.includes('testimonial') || html.includes('review')) return 'testimonials'

  // Check structure
  const sections = document.querySelectorAll('section')
  if (sections.length > 5) return 'multi-section-landing'
  if (sections.length === 1) return 'single-section'

  return 'generic'
}

/**
 * Extract individual sections from a template
 */
export function extractSections(html: string): Array<{
  type: string
  html: string
  order: number
}> {
  const dom = new JSDOM(html)
  const document = dom.window.document
  const sections: Array<{ type: string; html: string; order: number }> = []

  // Look for semantic sections
  const sectionElements = document.querySelectorAll('section, header, footer, nav, [class*="hero"], [class*="feature"], [class*="pricing"], [class*="testimonial"], [class*="cta"], [class*="faq"]')

  sectionElements.forEach((section, index) => {
    const className = section.className || ''
    const id = section.id || ''
    const tagName = section.tagName.toLowerCase()

    // Determine section type
    let type = 'generic'
    if (tagName === 'header' || className.match(/header|nav/i)) type = 'header'
    else if (tagName === 'footer' || className.match(/footer/i)) type = 'footer'
    else if (className.match(/hero/i) || id.match(/hero/i)) type = 'hero'
    else if (className.match(/feature/i)) type = 'features'
    else if (className.match(/pricing/i)) type = 'pricing'
    else if (className.match(/testimonial|review/i)) type = 'testimonials'
    else if (className.match(/cta|call.?to.?action/i)) type = 'cta'
    else if (className.match(/faq/i)) type = 'faq'
    else if (className.match(/stat|metric|number/i)) type = 'stats'
    else if (className.match(/logo|partner|client/i)) type = 'logos'
    else if (className.match(/team/i)) type = 'team'
    else if (className.match(/contact/i)) type = 'contact'
    else if (className.match(/about/i)) type = 'about'

    sections.push({
      type,
      html: section.outerHTML,
      order: index,
    })
  })

  return sections
}
