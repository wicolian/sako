/**
 * Brand Context for AI Generation
 * 
 * Provides brand-import { Database } from '@/lib/supabase/types'


specific context to AI generation pipelines.
 * Ensures all generated content adheres to brand guidelines.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface BrandContext {
  name: string
  tagline?: string
  targetAudience?: string
  industry?: string
  colors: {
    primary: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
  typography: {
    fontFamily: string
    fontHeading?: string
    fontMono?: string
    fontCdnUrl?: string
  }
  voice: {
    tone: string
    attributes: string[]
    scores?: {
      formality: number
      humor: number
      technicalDepth: number
    }
  }
  messaging: {
    keyMessages: string[]
    valuePropositions: string[]
    boilerplate?: string
    differentiators?: string[]
  }
  visualStyle: {
    theme?: string
    corners?: string
    shadows?: string
    animations?: string
    iconStyle?: string
    imageStyle?: string
  }
  guidelines: {
    dos: string[]
    donts: string[]
  }
  claims?: {
    approved: Array<{ text: string; category: string }>
    risky: Array<{ text: string; category: string; status: string }>
  }
  proofHints?: {
    recommendedStrategy?: string
    candidates: string[]
    gaps: string[]
  }
}

/**
 * Get brand context for a workspace
 * Falls back to default brand if brandId not specified
 */
export async function getBrandContext(
  workspaceId: string,
  brandId?: string
): Promise<BrandContext | null> {
  const supabase = createServiceClient()
  
  let query = supabase
    .from('brands')
    .select('*')
    .eq('workspace_id', workspaceId)

  if (brandId) {
    query = query.eq('id', brandId)
  } else {
    query = query.eq('is_default', true)
  }

  const { data: brand, error } = await query.maybeSingle()

  if (error || !brand) {
    console.warn(`⚠️ No brand found for workspace ${workspaceId}${brandId ? ` (brandId: ${brandId})` : ' (no default brand set)'}`)
    console.warn('   → Using fallback generic styling. Set up a brand for premium generation.')
    return null
  }

  const toneKeywords = ((brand.tone_keywords as string[] | null) ?? []).filter(Boolean)
  const inferredScores = inferToneScores(String(brand.voice || ''), toneKeywords)

  const { data: claimsData } = await supabase
    .from('claims')
    .select('text, category, status, risk_score')
    .eq('workspace_id', workspaceId)
    .order('risk_score', { ascending: false })
    .limit(25)

  const { data: brandMemory } = await supabase
    .from('brand_memory')
    .select('sources')
    .eq('workspace_id', workspaceId)
    .eq('brand_id', brand.id)
    .maybeSingle()

  const proofProfile = Array.isArray(brandMemory?.sources)
    ? brandMemory.sources
        .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>).proofProfile : null))
        .find((entry): entry is Record<string, unknown> => Boolean(entry))
    : null

  const approvedClaims = (claimsData ?? [])
    .filter((claim) => claim.status === 'approved')
    .slice(0, 10)
    .map((claim) => ({
      text: claim.text,
      category: claim.category || 'general',
    }))

  const riskyClaims = (claimsData ?? [])
    .filter((claim) => claim.status !== 'approved')
    .slice(0, 10)
    .map((claim) => ({
      text: claim.text,
      category: claim.category || 'general',
      status: claim.status || 'draft',
    }))

  return {
    name: brand.name,
    tagline: brand.tagline,
    targetAudience: ((brand.target_audience as string | null) || undefined) ?? undefined,
    industry: ((brand.industry as string | null) || undefined) ?? undefined,
    colors: {
      primary: brand.primary_color,
      secondary: brand.secondary_color,
      accent: brand.accent_color,
      background: brand.background_color,
      text: brand.text_color,
    },
    typography: {
      fontFamily: brand.font_family,
      fontHeading: brand.font_heading,
      fontMono: brand.font_mono,
      fontCdnUrl: brand.font_cdn_url,
    },
    voice: {
      tone: brand.voice || 'Professional & Friendly',
      attributes: (brand.tone_attributes as string[]) || [],
      scores: inferredScores,
    },
    messaging: {
      keyMessages: (brand.key_messages as string[]) || [],
      valuePropositions: (brand.value_propositions as string[]) || [],
      boilerplate: brand.boilerplate,
      differentiators: (brand.differentiators as string[]) || [],
    },
    visualStyle: {
      theme: (brand.visual_style as Record<string, string>)?.theme,
      corners: (brand.visual_style as Record<string, string>)?.corners,
      shadows: (brand.visual_style as Record<string, string>)?.shadows,
      animations: (brand.visual_style as Record<string, string>)?.animations,
      iconStyle: brand.icon_style,
      imageStyle: brand.image_style,
    },
    guidelines: {
      dos: (brand.dos as string[]) || [],
      donts: (brand.donts as string[]) || [],
    },
    claims: {
      approved: approvedClaims,
      risky: riskyClaims,
    },
    proofHints: {
      recommendedStrategy:
        typeof proofProfile?.recommendedStrategy === 'string'
          ? proofProfile.recommendedStrategy
          : undefined,
      candidates: Array.isArray(proofProfile?.candidates)
        ? proofProfile.candidates.filter((value): value is string => typeof value === 'string')
        : [],
      gaps: Array.isArray(proofProfile?.gaps)
        ? proofProfile.gaps.filter((value): value is string => typeof value === 'string')
        : [],
    },
  }
}

/**
 * Get a default/fallback brand context for new workspaces
 * Provides sensible defaults when no brand is configured
 */
export function getDefaultBrandContext(): BrandContext {
  return {
    name: 'Neutral Brand',
    colors: {
      primary: '#1f2937',
      secondary: '#475569',
      accent: '#0f766e',
      background: '#ffffff',
      text: '#111827',
    },
    typography: {
      fontFamily: 'system-ui',
      fontHeading: 'Georgia',
      fontMono: 'ui-monospace',
    },
    voice: {
      tone: 'Clear and restrained',
      attributes: ['clear', 'measured', 'credible'],
      scores: {
        formality: 4,
        humor: 1,
        technicalDepth: 2,
      },
    },
    messaging: {
      keyMessages: [],
      valuePropositions: [],
      differentiators: [],
    },
    visualStyle: {
      theme: 'light',
      corners: 'soft',
      shadows: 'none',
      animations: 'none',
      iconStyle: 'line',
      imageStyle: 'product-proof',
    },
    guidelines: {
      dos: ['Use high contrast', 'Lead with proof', 'Keep motion purposeful'],
      donts: ['Use decorative gradients', 'Over-animate the layout', 'Make unsubstantiated claims'],
    },
    claims: {
      approved: [],
      risky: [],
    },
    proofHints: {
      recommendedStrategy: 'evidence-stack',
      candidates: [],
      gaps: ['No imported proof context yet'],
    },
  }
}

/**
 * Format brand context as a prompt section
 */
export function formatBrandPrompt(brand: BrandContext): string {
  const sections: string[] = []

  // Core Identity
  sections.push(`## BRAND: ${brand.name}`)
  if (brand.tagline) {
    sections.push(`Tagline: "${brand.tagline}"`)
  }
  if (brand.industry) {
    sections.push(`Industry: ${brand.industry}`)
  }
  if (brand.targetAudience) {
    sections.push(`Target Audience: ${brand.targetAudience}`)
  }

  // Colors
  sections.push(`
## COLOR PALETTE
- Primary: ${brand.colors.primary}
- Secondary: ${brand.colors.secondary || brand.colors.primary}
${brand.colors.accent ? `- Accent: ${brand.colors.accent}` : ''}
${brand.colors.background ? `- Background: ${brand.colors.background}` : ''}
${brand.colors.text ? `- Text: ${brand.colors.text}` : ''}`)

  // Typography
  sections.push(`
## TYPOGRAPHY
- Font Family: ${brand.typography.fontFamily}
${brand.typography.fontHeading ? `- Headings: ${brand.typography.fontHeading}` : ''}`)

  // Voice & Tone
  if (brand.voice.tone || brand.voice.attributes.length) {
    sections.push(`
## BRAND VOICE
- Tone: ${brand.voice.tone}
${brand.voice.scores ? `- Formality: ${brand.voice.scores.formality}/5
- Humor: ${brand.voice.scores.humor}/5
- Technical Depth: ${brand.voice.scores.technicalDepth}/5` : ''}
${brand.voice.attributes.length ? `- Attributes: ${brand.voice.attributes.join(', ')}` : ''}`)
  }

  // Key Messages
  if (brand.messaging.keyMessages.length) {
    sections.push(`
## KEY MESSAGES (weave these in naturally)
${brand.messaging.keyMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}`)
  }

  // Value Props
  if (brand.messaging.valuePropositions.length) {
    sections.push(`
## VALUE PROPOSITIONS
${brand.messaging.valuePropositions.map((v, i) => `${i + 1}. ${v}`).join('\n')}`)
  }

  if (brand.messaging.differentiators?.length) {
    sections.push(`
## DIFFERENTIATORS
${brand.messaging.differentiators.map((item, index) => `${index + 1}. ${item}`).join('\n')}`)
  }

  // Visual Style
  if (brand.visualStyle.theme || brand.visualStyle.corners) {
    sections.push(`
## VISUAL STYLE
${brand.visualStyle.theme ? `- Theme: ${brand.visualStyle.theme}` : ''}
${brand.visualStyle.corners ? `- Corners: ${brand.visualStyle.corners}` : ''}
${brand.visualStyle.shadows ? `- Shadows: ${brand.visualStyle.shadows}` : ''}
${brand.visualStyle.animations ? `- Animations: ${brand.visualStyle.animations}` : ''}`)
  }

  // Guidelines
  if (brand.guidelines.dos.length || brand.guidelines.donts.length) {
    sections.push(`
## BRAND GUIDELINES`)
    if (brand.guidelines.dos.length) {
      sections.push(`DO:
${brand.guidelines.dos.map(d => `✓ ${d}`).join('\n')}`)
    }
    if (brand.guidelines.donts.length) {
      sections.push(`DON'T:
${brand.guidelines.donts.map(d => `✗ ${d}`).join('\n')}`)
    }
  }

  if (brand.claims?.approved.length) {
    sections.push(`
## APPROVED CLAIMS
${brand.claims.approved.map((claim, index) => `${index + 1}. [${claim.category}] ${claim.text}`).join('\n')}`)
  }

  if (brand.claims?.risky.length) {
    sections.push(`
## DO NOT USE WITHOUT REVIEW
${brand.claims.risky.map((claim, index) => `${index + 1}. DO NOT USE [${claim.status} | ${claim.category}] ${claim.text}`).join('\n')}`)
  }

  return sections.join('\n')
}

function inferToneScores(
  tone: string,
  attributes: string[]
): { formality: number; humor: number; technicalDepth: number } {
  const haystack = `${tone} ${attributes.join(' ')}`.toLowerCase()

  const formality =
    /(formal|enterprise|executive|professional|serious)/.test(haystack) ? 4 :
    /(casual|friendly|playful|conversational)/.test(haystack) ? 2 :
    3

  const humor =
    /(funny|witty|playful|irreverent)/.test(haystack) ? 4 :
    /(serious|formal|technical)/.test(haystack) ? 1 :
    2

  const technicalDepth =
    /(technical|developer|engineering|precise|expert)/.test(haystack) ? 4 :
    /(simple|plain|accessible|approachable)/.test(haystack) ? 2 :
    3

  return { formality, humor, technicalDepth }
}

/**
 * Generate CSS variables from brand context
 */
export function generateBrandCSS(brand: BrandContext): string {
  return `
:root {
  --brand-primary: ${brand.colors.primary};
  --brand-secondary: ${brand.colors.secondary || brand.colors.primary};
  --brand-accent: ${brand.colors.accent || brand.colors.primary};
  --brand-background: ${brand.colors.background || '#0f0f0f'};
  --brand-text: ${brand.colors.text || '#ffffff'};
  --brand-font-family: "${brand.typography.fontFamily}", system-ui, sans-serif;
  --brand-font-heading: "${brand.typography.fontHeading || brand.typography.fontFamily}", system-ui, sans-serif;
}

body {
  font-family: var(--brand-font-family);
  background-color: var(--brand-background);
  color: var(--brand-text);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--brand-font-heading);
}

.text-primary { color: var(--brand-primary); }
.bg-primary { background-color: var(--brand-primary); }
.border-primary { border-color: var(--brand-primary); }

.text-secondary { color: var(--brand-secondary); }
.bg-secondary { background-color: var(--brand-secondary); }

.text-accent { color: var(--brand-accent); }
.bg-accent { background-color: var(--brand-accent); }
`
}

/**
 * Get font CDN link for a brand
 */
export function getBrandFontLink(brand: BrandContext): string {
  if (brand.typography.fontCdnUrl) {
    return brand.typography.fontCdnUrl
  }

  // Generate Google Fonts URL
  const fonts = [brand.typography.fontFamily]
  if (brand.typography.fontHeading && brand.typography.fontHeading !== brand.typography.fontFamily) {
    fonts.push(brand.typography.fontHeading)
  }

  const fontsParam = fonts
    .map((f) => `family=${f.replace(/\s+/g, '+')}:wght@400;500;600;700`)
    .join('&')

  return `https://fonts.googleapis.com/css2?${fontsParam}&display=swap`
}
