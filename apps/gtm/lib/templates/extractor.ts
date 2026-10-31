import { JSDOM } from 'jsdom'
import { generateStructuredOutput } from '@/lib/ai/ai-sdk-client'
import { z } from 'zod'

const SectionMetadataSchema = z.object({
  category: z.enum([
    'hero', 'features', 'pricing', 'testimonials', 'faq', 'cta', 
    'footer', 'logos', 'stats', 'team', 'gallery', 'contact', 
    'about', 'process', 'comparison'
  ]),
  industry: z.array(z.string()),
  visualStyle: z.object({
    theme: z.enum(['light', 'dark', 'gradient', 'glass']),
    layout: z.enum(['centered', 'split', 'grid', 'asymmetric', 'stacked']),
    density: z.enum(['compact', 'normal', 'spacious']),
    motion: z.enum(['none', 'subtle', 'moderate', 'intense']),
  }),
  components: z.array(z.string()),
  designTokens: z.object({
    primaryColors: z.array(z.string()),
    fontFamilies: z.array(z.string()),
    borderRadius: z.string(),
    shadows: z.array(z.string()),
  }),
  semanticDescription: z.string(),
})

export interface ExtractedSection {
  sectionId: string
  templateName: string
  category: string
  industry: string[]
  visualStyle: {
    theme: string
    layout: string
    density: string
    motion: string
  }
  components: string[]
  designTokens: {
    primaryColors: string[]
    fontFamilies: string[]
    borderRadius: string
    shadows: string[]
  }
  html: string
  description: string
}

/**
 * Extract template metadata from HTML using AI
 */
export async function extractTemplateMetadata(
  html: string,
  templateName: string
): Promise<ExtractedSection[]> {
  const dom = new JSDOM(html)
  const sections = identifySections(dom)
  
  const results: ExtractedSection[] = []
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    
    try {
      const metadata = await generateStructuredOutput({
        prompt: `Analyze this HTML section and extract structured metadata:

Section HTML (truncated):
${section.html.slice(0, 4000)}

Template name: ${templateName}

Extract:
1. Category (hero, features, pricing, testimonials, faq, cta, footer, logos, stats, team, gallery, contact, about, process, comparison)
2. Industry tags (saas, agency, finance, healthcare, ecommerce, education, etc.)
3. Visual style (theme, layout, density, motion level)
4. Components used (buttons, cards, icons, images, forms, etc.)
5. Design tokens (colors from Tailwind classes, fonts, border radius, shadows)
6. A semantic description for similarity search (1-2 sentences describing the visual style and purpose)
`,
        schema: SectionMetadataSchema,
      })

      results.push({
        sectionId: `${templateName}-${metadata.category}-${i}`,
        templateName,
        category: metadata.category,
        industry: metadata.industry,
        visualStyle: metadata.visualStyle,
        components: metadata.components,
        designTokens: metadata.designTokens,
        html: section.html,
        description: metadata.semanticDescription,
      })
    } catch (error) {
      console.error(`Failed to extract metadata for section ${i}:`, error)
    }
  }
  
  return results
}

/**
 * Identify discrete sections in HTML
 */
function identifySections(dom: JSDOM): { html: string; type: string }[] {
  const sections: { html: string; type: string }[] = []
  const body = dom.window.document.body
  
  if (!body) return sections
  
  // Look for semantic sections
  const candidates = body.querySelectorAll(
    'section, header, footer, [class*="hero"], [class*="pricing"], [class*="feature"], [class*="testimonial"], [class*="faq"], [class*="cta"], [class*="footer"]'
  )
  
  if (candidates.length > 0) {
    for (const el of candidates) {
      sections.push({
        html: el.outerHTML,
        type: inferSectionType(el),
      })
    }
  } else {
    // Fallback: treat direct children of body as sections
    for (const child of body.children) {
      if (child.innerHTML.trim().length > 100) {
        sections.push({
          html: child.outerHTML,
          type: 'unknown',
        })
      }
    }
  }
  
  return sections
}

/**
 * Infer section type from element classes and content
 */
function inferSectionType(el: Element): string {
  const className = el.className.toLowerCase()
  const tagName = el.tagName.toLowerCase()
  
  if (tagName === 'header' || className.includes('hero') || className.includes('banner')) {
    return 'hero'
  }
  if (tagName === 'footer' || className.includes('footer')) {
    return 'footer'
  }
  if (className.includes('pricing')) return 'pricing'
  if (className.includes('feature')) return 'features'
  if (className.includes('testimonial') || className.includes('review')) return 'testimonials'
  if (className.includes('faq')) return 'faq'
  if (className.includes('cta') || className.includes('call-to-action')) return 'cta'
  if (className.includes('logo') || className.includes('client')) return 'logos'
  if (className.includes('stat') || className.includes('metric')) return 'stats'
  if (className.includes('team')) return 'team'
  
  return 'unknown'
}

/**
 * Extract Tailwind colors from class names
 */
export function extractTailwindColors(html: string): string[] {
  const colorPattern = /(?:bg|text|border|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:\d{2,3})/g
  const matches = html.match(colorPattern) || []
  return [...new Set(matches)]
}

/**
 * Extract font families from Tailwind classes
 */
export function extractFontFamilies(html: string): string[] {
  const fontPattern = /font-(?:sans|serif|mono|display|heading|body)/g
  const matches = html.match(fontPattern) || []
  return [...new Set(matches)]
}
