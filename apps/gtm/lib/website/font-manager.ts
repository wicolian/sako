/**
 * Typography / Font Manager
 * 
 * Font detection and global management:
 * - Google Fonts integration
 * - Font pairing presets
 * - Global font changes by text type
 */

// ============================================================================
// Types
// ============================================================================

export interface FontFamily {
  name: string
  category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace'
  weights: number[]
  isVariable?: boolean
  googleFontsUrl?: string
}

export interface FontPairing {
  id: string
  name: string
  description: string
  heading: string
  body: string
  accent?: string
  preview?: string
}

export interface TypographyScale {
  hero: FontStyle
  h1: FontStyle
  h2: FontStyle
  h3: FontStyle
  h4: FontStyle
  body: FontStyle
  small: FontStyle
  caption: FontStyle
}

export interface FontStyle {
  fontFamily: string
  fontSize: string
  fontWeight: number
  lineHeight: number
  letterSpacing: string
}

// ============================================================================
// Popular Google Fonts
// ============================================================================

export const GOOGLE_FONTS: FontFamily[] = [
  // Sans-serif
  { name: 'Inter', category: 'sans-serif', weights: [400, 500, 600, 700], isVariable: true },
  { name: 'Roboto', category: 'sans-serif', weights: [400, 500, 700] },
  { name: 'Open Sans', category: 'sans-serif', weights: [400, 500, 600, 700] },
  { name: 'Lato', category: 'sans-serif', weights: [400, 700, 900] },
  { name: 'Montserrat', category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { name: 'Poppins', category: 'sans-serif', weights: [400, 500, 600, 700] },
  { name: 'DM Sans', category: 'sans-serif', weights: [400, 500, 700] },
  { name: 'Space Grotesk', category: 'sans-serif', weights: [400, 500, 600, 700] },
  { name: 'Plus Jakarta Sans', category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { name: 'Outfit', category: 'sans-serif', weights: [400, 500, 600, 700] },
  
  // Serif
  { name: 'Playfair Display', category: 'serif', weights: [400, 500, 600, 700] },
  { name: 'Lora', category: 'serif', weights: [400, 500, 600, 700] },
  { name: 'Merriweather', category: 'serif', weights: [400, 700, 900] },
  { name: 'Source Serif Pro', category: 'serif', weights: [400, 600, 700] },
  { name: 'Crimson Text', category: 'serif', weights: [400, 600, 700] },
  { name: 'DM Serif Display', category: 'serif', weights: [400] },
  { name: 'Cormorant', category: 'serif', weights: [400, 500, 600, 700] },
  
  // Display
  { name: 'Bebas Neue', category: 'display', weights: [400] },
  { name: 'Abril Fatface', category: 'display', weights: [400] },
  { name: 'Archivo Black', category: 'display', weights: [400] },
  { name: 'Righteous', category: 'display', weights: [400] },
  
  // Monospace
  { name: 'JetBrains Mono', category: 'monospace', weights: [400, 500, 700] },
  { name: 'Fira Code', category: 'monospace', weights: [400, 500, 700] },
  { name: 'Source Code Pro', category: 'monospace', weights: [400, 500, 700] },
]

// ============================================================================
// Font Pairings
// ============================================================================

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: 'modern-tech',
    name: 'Modern Tech',
    description: 'Clean and contemporary for SaaS and tech products',
    heading: 'Inter',
    body: 'Inter',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Elegant serif for editorial and luxury brands',
    heading: 'Playfair Display',
    body: 'Lato',
  },
  {
    id: 'startup',
    name: 'Startup',
    description: 'Friendly and approachable for startups',
    heading: 'Poppins',
    body: 'Open Sans',
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Professional and trustworthy for enterprise',
    heading: 'Montserrat',
    body: 'Roboto',
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Bold and expressive for creative agencies',
    heading: 'Space Grotesk',
    body: 'DM Sans',
  },
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'Sophisticated serif pairing',
    heading: 'Cormorant',
    body: 'Lora',
  },
  {
    id: 'bold',
    name: 'Bold Statement',
    description: 'High impact for landing pages',
    heading: 'Bebas Neue',
    body: 'Inter',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple and refined',
    heading: 'Outfit',
    body: 'Outfit',
  },
  {
    id: 'dynamic',
    name: 'Dynamic',
    description: 'Modern with personality',
    heading: 'Plus Jakarta Sans',
    body: 'Inter',
  },
]

// ============================================================================
// Typography Scale Presets
// ============================================================================

export const TYPOGRAPHY_SCALES: Record<string, TypographyScale> = {
  default: {
    hero: { fontFamily: 'heading', fontSize: '4rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' },
    h1: { fontFamily: 'heading', fontSize: '3rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.01em' },
    h2: { fontFamily: 'heading', fontSize: '2.25rem', fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.01em' },
    h3: { fontFamily: 'heading', fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.4, letterSpacing: '0' },
    h4: { fontFamily: 'heading', fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4, letterSpacing: '0' },
    body: { fontFamily: 'body', fontSize: '1rem', fontWeight: 400, lineHeight: 1.6, letterSpacing: '0' },
    small: { fontFamily: 'body', fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5, letterSpacing: '0' },
    caption: { fontFamily: 'body', fontSize: '0.75rem', fontWeight: 400, lineHeight: 1.4, letterSpacing: '0.02em' },
  },
  compact: {
    hero: { fontFamily: 'heading', fontSize: '3rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' },
    h1: { fontFamily: 'heading', fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.01em' },
    h2: { fontFamily: 'heading', fontSize: '2rem', fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.01em' },
    h3: { fontFamily: 'heading', fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.4, letterSpacing: '0' },
    h4: { fontFamily: 'heading', fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4, letterSpacing: '0' },
    body: { fontFamily: 'body', fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.6, letterSpacing: '0' },
    small: { fontFamily: 'body', fontSize: '0.8125rem', fontWeight: 400, lineHeight: 1.5, letterSpacing: '0' },
    caption: { fontFamily: 'body', fontSize: '0.6875rem', fontWeight: 400, lineHeight: 1.4, letterSpacing: '0.02em' },
  },
  spacious: {
    hero: { fontFamily: 'heading', fontSize: '5rem', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.03em' },
    h1: { fontFamily: 'heading', fontSize: '3.5rem', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em' },
    h2: { fontFamily: 'heading', fontSize: '2.5rem', fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.01em' },
    h3: { fontFamily: 'heading', fontSize: '1.75rem', fontWeight: 600, lineHeight: 1.35, letterSpacing: '0' },
    h4: { fontFamily: 'heading', fontSize: '1.375rem', fontWeight: 600, lineHeight: 1.4, letterSpacing: '0' },
    body: { fontFamily: 'body', fontSize: '1.125rem', fontWeight: 400, lineHeight: 1.7, letterSpacing: '0' },
    small: { fontFamily: 'body', fontSize: '1rem', fontWeight: 400, lineHeight: 1.6, letterSpacing: '0' },
    caption: { fontFamily: 'body', fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5, letterSpacing: '0.01em' },
  },
}

// ============================================================================
// Font Manager Functions
// ============================================================================

/**
 * Generate Google Fonts URL for multiple fonts
 */
export function generateGoogleFontsUrl(fonts: string[]): string {
  const fontParams = fonts.map(font => {
    const fontData = GOOGLE_FONTS.find(f => f.name === font)
    if (!fontData) return null
    
    const familyName = font.replace(/ /g, '+')
    const weights = fontData.weights.join(';')
    return `family=${familyName}:wght@${weights}`
  }).filter(Boolean)
  
  if (fontParams.length === 0) return ''
  
  return `https://fonts.googleapis.com/css2?${fontParams.join('&')}&display=swap`
}

/**
 * Generate CSS variables for typography
 */
export function generateTypographyCSS(
  pairing: FontPairing,
  scale: TypographyScale = TYPOGRAPHY_SCALES.default
): string {
  const headingFont = pairing.heading
  const bodyFont = pairing.body
  
  let css = `:root {\n`
  css += `  --font-heading: '${headingFont}', system-ui, sans-serif;\n`
  css += `  --font-body: '${bodyFont}', system-ui, sans-serif;\n`
  
  for (const [key, style] of Object.entries(scale)) {
    const prefix = `--typography-${key}`
    const fontFamily = style.fontFamily === 'heading' ? 'var(--font-heading)' : 'var(--font-body)'
    
    css += `  ${prefix}-font-family: ${fontFamily};\n`
    css += `  ${prefix}-font-size: ${style.fontSize};\n`
    css += `  ${prefix}-font-weight: ${style.fontWeight};\n`
    css += `  ${prefix}-line-height: ${style.lineHeight};\n`
    css += `  ${prefix}-letter-spacing: ${style.letterSpacing};\n`
  }
  
  css += `}\n`
  
  return css
}

/**
 * Get font by name
 */
export function getFont(name: string): FontFamily | undefined {
  return GOOGLE_FONTS.find(f => f.name === name)
}

/**
 * Get pairing by ID
 */
export function getPairing(id: string): FontPairing | undefined {
  return FONT_PAIRINGS.find(p => p.id === id)
}

/**
 * Get fonts by category
 */
export function getFontsByCategory(category: FontFamily['category']): FontFamily[] {
  return GOOGLE_FONTS.filter(f => f.category === category)
}

/**
 * Search fonts by name
 */
export function searchFonts(query: string): FontFamily[] {
  const lowerQuery = query.toLowerCase()
  return GOOGLE_FONTS.filter(f => 
    f.name.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Detect fonts used in a design
 */
export function detectFontsInDesign(design: { sections: Array<{ styles?: { fontFamily?: string } }> }): string[] {
  const fonts = new Set<string>()
  
  for (const section of design.sections) {
    if (section.styles?.fontFamily) {
      fonts.add(section.styles.fontFamily)
    }
  }
  
  return Array.from(fonts)
}
