/**
 * Design Archetype Selector
 *
 * Maps a BrandContext to a DesignArchetype that drives all generator layout decisions.
 * Pure TypeScript module — no I/O, no async, no external dependencies.
 */

import type { BrandContext } from '@/lib/ai/brand-context'

export type LandingPageArchetype =
  | 'product-led'   // PLG SaaS, dev tools — demo-forward, dark-friendly
  | 'trust-forward' // Enterprise, fintech, health — proof/metrics first
  | 'conversion'    // B2B mid-market — pain→solution, urgency
  | 'storytelling'  // Agencies, creative, consumer — editorial feel
  | 'developer'     // APIs, infra, open source — terminal aesthetic

export type EmailStyle =
  | 'near-plain'    // Cold outreach — nearly plain text, one link
  | 'light-branded' // Nurture — brand accent, minimal structure
  | 'full-branded'  // Announcement/launch — full header, image, CTA button

export type SocialVisualStyle =
  | 'minimal'    // Whitespace, muted palette, thin type
  | 'bold'       // High contrast, oversized type
  | 'editorial'  // Magazine asymmetry, mixed sizes
  | 'technical'  // Monospace accents, code-style blocks

export type DeckStyle =
  | 'clean-dark'  // Dark bg, bright accents, minimal decoration
  | 'clean-light' // White bg, brand accents, professional
  | 'editorial'   // Mixed layouts, editorial type hierarchy

export type SpacingDensity = 'compact' | 'moderate' | 'spacious'

export type CornerStyle = 'sharp' | 'soft' | 'rounded' | 'pill'

export type DesignDirection =
  | 'auto'
  | 'trust'
  | 'product'
  | 'editorial'
  | 'technical'
  | 'conversion'

export type MotionPolicy = 'none' | 'subtle' | 'semantic'

export type BackgroundTreatment = 'plain' | 'tinted' | 'split-tone' | 'editorial-wash'

export type ProofDensity = 'low' | 'medium' | 'high'

export type IconTreatment = 'none' | 'line' | 'solid' | 'badge'

export type OrnamentLevel = 'none' | 'restrained' | 'expressive'

export interface DesignArchetype {
  landingPage: LandingPageArchetype
  emailStyle: {
    cold: EmailStyle
    nurture: EmailStyle
    announcement: EmailStyle
  }
  socialVisual: SocialVisualStyle
  deck: DeckStyle
  spacingDensity: SpacingDensity
  corners: CornerStyle
  prefersDark: boolean
  borderRadius: string
  spacingUnit: number
  motionPolicy: MotionPolicy
  backgroundTreatment: BackgroundTreatment
  proofDensity: ProofDensity
  iconTreatment: IconTreatment
  ornamentLevel: OrnamentLevel
  direction: Exclude<DesignDirection, 'auto'>
  source: 'brand' | 'override' | 'neutral-fallback'
  reasoning: string
}

/**
 * Selects landing page archetype based on industry, technical depth, and theme.
 */
export function selectLandingPageArchetype(
  industry: string,
  technicalDepth: number,
  theme: string,
): LandingPageArchetype {
  if (
    technicalDepth >= 4 ||
    /\b(api|developer|devtool|infrastructure|infra|open.?source|cli|sdk|platform)\b/.test(industry)
  ) {
    return 'developer'
  }

  if (
    /\b(fintech|finance|banking|insurance|healthcare|health|medical|legal|compliance|security)\b/.test(
      industry,
    )
  ) {
    return 'trust-forward'
  }

  if (
    /\b(agency|creative|design|studio|brand|fashion|consumer|lifestyle|media|art)\b/.test(industry)
  ) {
    return 'storytelling'
  }

  if (
    /\b(saas|software|startup|product|plg|growth)\b/.test(industry) &&
    technicalDepth >= 3
  ) {
    return 'product-led'
  }

  return 'conversion'
}

/**
 * Selects social visual style based on industry, theme, and formality.
 */
export function selectSocialVisualStyle(
  industry: string,
  theme: string,
  formality: number,
): SocialVisualStyle {
  if (/\b(api|developer|devtool|infrastructure|infra|cli|sdk)\b/.test(industry)) {
    return 'technical'
  }

  if (/\b(agency|creative|design|studio|brand|media|fashion)\b/.test(industry)) {
    return 'editorial'
  }

  if (formality >= 4) {
    return 'minimal'
  }

  return 'bold'
}

/**
 * Selects corner style based on corner preference, industry, and formality.
 */
export function selectCornerStyle(
  corners: string,
  industry: string,
  formality: number,
): CornerStyle {
  if (
    corners === 'sharp' ||
    /\b(legal|banking|finance|government)\b/.test(industry)
  ) {
    return 'sharp'
  }

  if (corners === 'pill') {
    return 'pill'
  }

  if (formality >= 4) {
    return 'soft'
  }

  if (formality <= 2) {
    return 'rounded'
  }

  return 'soft'
}

/**
 * Converts a CornerStyle to a CSS border-radius value.
 */
export function cornerStyleToRadius(style: CornerStyle): string {
  switch (style) {
    case 'sharp':
      return '2px'
    case 'soft':
      return '6px'
    case 'rounded':
      return '12px'
    case 'pill':
      return '9999px'
  }
}

function mapDirectionToLandingPageArchetype(
  direction: Exclude<DesignDirection, 'auto'>,
): LandingPageArchetype {
  switch (direction) {
    case 'trust':
      return 'trust-forward'
    case 'product':
      return 'product-led'
    case 'editorial':
      return 'storytelling'
    case 'technical':
      return 'developer'
    case 'conversion':
      return 'conversion'
  }
}

function landingPageArchetypeToDirection(
  landingPage: LandingPageArchetype,
): Exclude<DesignDirection, 'auto'> {
  switch (landingPage) {
    case 'trust-forward':
      return 'trust'
    case 'product-led':
      return 'product'
    case 'storytelling':
      return 'editorial'
    case 'developer':
      return 'technical'
    case 'conversion':
      return 'conversion'
  }
}

/**
 * Maps a BrandContext to a DesignArchetype.
 * Deterministic — same input always produces same output.
 */
export function selectDesignArchetype(
  brand: BrandContext,
  direction: DesignDirection = 'auto',
): DesignArchetype {
  const industry = (brand.industry ?? '').toLowerCase()
  const theme = (brand.visualStyle.theme ?? '').toLowerCase()
  const corners = (brand.visualStyle.corners ?? '').toLowerCase()
  const formality = brand.voice.scores?.formality ?? 3
  const technicalDepth = brand.voice.scores?.technicalDepth ?? 2

  const inferredLandingPage = selectLandingPageArchetype(industry, technicalDepth, theme)
  const landingPage =
    direction === 'auto' ? inferredLandingPage : mapDirectionToLandingPageArchetype(direction)
  const resolvedDirection =
    direction === 'auto' ? landingPageArchetypeToDirection(landingPage) : direction

  const emailStyle: DesignArchetype['emailStyle'] = {
    cold: 'near-plain',
    nurture: formality >= 4 ? 'light-branded' : 'near-plain',
    announcement: 'full-branded',
  }

  const socialVisual = selectSocialVisualStyle(industry, theme, formality)

  const deck: DeckStyle =
    theme === 'dark' ? 'clean-dark' :
    formality >= 4 ? 'clean-light' :
    'editorial'

  const spacingDensity: SpacingDensity =
    formality <= 2 ? 'compact' :
    formality >= 4 ? 'spacious' :
    'moderate'

  const spacingUnit =
    spacingDensity === 'compact' ? 8 :
    spacingDensity === 'spacious' ? 16 :
    12

  const cornerStyle = selectCornerStyle(corners, industry, formality)
  const borderRadius = cornerStyleToRadius(cornerStyle)

  const prefersDark =
    theme === 'dark' || landingPage === 'developer' || landingPage === 'product-led'
  const source =
    direction !== 'auto'
      ? 'override'
      : brand.name === 'Neutral Brand'
      ? 'neutral-fallback'
      : 'brand'

  const motionPolicy: MotionPolicy =
    landingPage === 'storytelling' ? 'semantic' :
    landingPage === 'product-led' ? 'subtle' :
    'none'

  const backgroundTreatment: BackgroundTreatment =
    landingPage === 'storytelling' ? 'editorial-wash' :
    landingPage === 'product-led' ? 'split-tone' :
    landingPage === 'developer' ? 'plain' :
    'tinted'

  const proofDensity: ProofDensity =
    landingPage === 'trust-forward' ? 'high' :
    landingPage === 'conversion' || landingPage === 'product-led' ? 'medium' :
    'low'

  const iconTreatment: IconTreatment =
    landingPage === 'developer' ? 'line' :
    landingPage === 'trust-forward' ? 'badge' :
    landingPage === 'storytelling' ? 'none' :
    'solid'

  const ornamentLevel: OrnamentLevel =
    landingPage === 'storytelling' ? 'expressive' :
    landingPage === 'product-led' ? 'restrained' :
    'none'

  const reasoning =
    `industry=${industry || 'unknown'}, theme=${theme || 'default'}, formality=${formality}/5, technicalDepth=${technicalDepth}/5, direction=${resolvedDirection}, source=${source}, → archetype=${landingPage}`

  return {
    landingPage,
    emailStyle,
    socialVisual,
    deck,
    spacingDensity,
    corners: cornerStyle,
    prefersDark,
    borderRadius,
    spacingUnit,
    motionPolicy,
    backgroundTreatment,
    proofDensity,
    iconTreatment,
    ornamentLevel,
    direction: resolvedDirection,
    source,
    reasoning,
  }
}
