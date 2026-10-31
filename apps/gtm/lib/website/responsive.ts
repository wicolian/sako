/**
 * Responsive Breakpoints System
 * 
 * Handles responsive design with:
 * - Standard breakpoints (mobile, tablet, desktop, wide)
 * - Per-breakpoint style overrides
 * - Preview modes
 */

// ============================================================================
// Types
// ============================================================================

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide'

export interface BreakpointConfig {
  id: Breakpoint
  name: string
  label: string
  width: number
  icon: string
  description: string
}

export interface ResponsiveValue<T> {
  mobile?: T
  tablet?: T
  desktop?: T
  wide?: T
}

export interface ResponsiveStyles {
  padding?: ResponsiveValue<string>
  margin?: ResponsiveValue<string>
  fontSize?: ResponsiveValue<string>
  columns?: ResponsiveValue<number>
  gap?: ResponsiveValue<string>
  display?: ResponsiveValue<'block' | 'flex' | 'grid' | 'none'>
  flexDirection?: ResponsiveValue<'row' | 'column'>
  textAlign?: ResponsiveValue<'left' | 'center' | 'right'>
  width?: ResponsiveValue<string>
  height?: ResponsiveValue<string>
  visibility?: ResponsiveValue<'visible' | 'hidden'>
}

// ============================================================================
// Breakpoint Configuration
// ============================================================================

export const BREAKPOINTS: BreakpointConfig[] = [
  {
    id: 'mobile',
    name: 'Mobile',
    label: 'SM',
    width: 375,
    icon: 'smartphone',
    description: 'Phones (375px)',
  },
  {
    id: 'tablet',
    name: 'Tablet',
    label: 'MD',
    width: 768,
    icon: 'tablet',
    description: 'Tablets (768px)',
  },
  {
    id: 'desktop',
    name: 'Desktop',
    label: 'LG',
    width: 1024,
    icon: 'monitor',
    description: 'Laptops (1024px)',
  },
  {
    id: 'wide',
    name: 'Wide',
    label: 'XL',
    width: 1440,
    icon: 'monitor',
    description: 'Large monitors (1440px)',
  },
]

export const BREAKPOINT_MAP: Record<Breakpoint, BreakpointConfig> = {
  mobile: BREAKPOINTS[0],
  tablet: BREAKPOINTS[1],
  desktop: BREAKPOINTS[2],
  wide: BREAKPOINTS[3],
}

// ============================================================================
// Responsive Utilities
// ============================================================================

/**
 * Get value for a specific breakpoint
 * Falls back to larger breakpoints if not defined
 */
export function getResponsiveValue<T>(
  value: ResponsiveValue<T> | T | undefined,
  breakpoint: Breakpoint
): T | undefined {
  // If it's a simple value, return it
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'object' || !('mobile' in value || 'tablet' in value || 'desktop' in value || 'wide' in value)) {
    return value as T
  }

  const responsive = value as ResponsiveValue<T>

  // Get the value with fallback to larger breakpoints
  const order: Breakpoint[] = ['mobile', 'tablet', 'desktop', 'wide']
  const startIndex = order.indexOf(breakpoint)

  for (let i = startIndex; i >= 0; i--) {
    const bp = order[i]
    if (responsive[bp] !== undefined) {
      return responsive[bp]
    }
  }

  // If nothing found, try going up
  for (let i = startIndex + 1; i < order.length; i++) {
    const bp = order[i]
    if (responsive[bp] !== undefined) {
      return responsive[bp]
    }
  }

  return undefined
}

/**
 * Create CSS media query for breakpoint
 */
export function createMediaQuery(breakpoint: Breakpoint): string {
  const config = BREAKPOINT_MAP[breakpoint]
  const nextBreakpoint = getNextBreakpoint(breakpoint)

  if (breakpoint === 'mobile') {
    return `@media (max-width: ${BREAKPOINT_MAP.tablet.width - 1}px)`
  }

  if (!nextBreakpoint) {
    return `@media (min-width: ${config.width}px)`
  }

  return `@media (min-width: ${config.width}px) and (max-width: ${BREAKPOINT_MAP[nextBreakpoint].width - 1}px)`
}

/**
 * Get the next larger breakpoint
 */
function getNextBreakpoint(breakpoint: Breakpoint): Breakpoint | null {
  const order: Breakpoint[] = ['mobile', 'tablet', 'desktop', 'wide']
  const index = order.indexOf(breakpoint)
  if (index === -1 || index === order.length - 1) return null
  return order[index + 1]
}

/**
 * Generate CSS from responsive styles
 */
export function generateResponsiveCSS(
  selector: string,
  styles: ResponsiveStyles
): string {
  const cssBlocks: string[] = []

  // Generate CSS for each breakpoint
  for (const bp of BREAKPOINTS) {
    const properties: string[] = []

    for (const [key, value] of Object.entries(styles)) {
      const responsiveValue = getResponsiveValue(value, bp.id)
      if (responsiveValue !== undefined) {
        const cssProperty = camelToKebab(key)
        properties.push(`  ${cssProperty}: ${responsiveValue};`)
      }
    }

    if (properties.length > 0) {
      const mediaQuery = createMediaQuery(bp.id)
      cssBlocks.push(`${mediaQuery} {\n  ${selector} {\n${properties.join('\n')}\n  }\n}`)
    }
  }

  return cssBlocks.join('\n\n')
}

/**
 * Convert camelCase to kebab-case
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * Check if current viewport matches a breakpoint
 */
export function isBreakpoint(breakpoint: Breakpoint): boolean {
  if (typeof window === 'undefined') return breakpoint === 'desktop'

  const width = window.innerWidth
  const config = BREAKPOINT_MAP[breakpoint]
  const nextBp = getNextBreakpoint(breakpoint)

  if (breakpoint === 'mobile') {
    return width < BREAKPOINT_MAP.tablet.width
  }

  if (!nextBp) {
    return width >= config.width
  }

  return width >= config.width && width < BREAKPOINT_MAP[nextBp].width
}

/**
 * Get current breakpoint from viewport
 */
export function getCurrentBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop'

  const width = window.innerWidth

  if (width < BREAKPOINT_MAP.tablet.width) return 'mobile'
  if (width < BREAKPOINT_MAP.desktop.width) return 'tablet'
  if (width < BREAKPOINT_MAP.wide.width) return 'desktop'
  return 'wide'
}

// ============================================================================
// Default Responsive Values
// ============================================================================

export const DEFAULT_SPACING: ResponsiveValue<string> = {
  mobile: '16px',
  tablet: '24px',
  desktop: '32px',
  wide: '48px',
}

export const DEFAULT_CONTAINER_WIDTH: ResponsiveValue<string> = {
  mobile: '100%',
  tablet: '720px',
  desktop: '960px',
  wide: '1200px',
}

export const DEFAULT_COLUMNS: ResponsiveValue<number> = {
  mobile: 1,
  tablet: 2,
  desktop: 3,
  wide: 4,
}

export const DEFAULT_FONT_SIZES = {
  hero: {
    mobile: '32px',
    tablet: '40px',
    desktop: '56px',
    wide: '64px',
  } as ResponsiveValue<string>,
  heading: {
    mobile: '24px',
    tablet: '28px',
    desktop: '32px',
    wide: '36px',
  } as ResponsiveValue<string>,
  subheading: {
    mobile: '18px',
    tablet: '20px',
    desktop: '22px',
    wide: '24px',
  } as ResponsiveValue<string>,
  body: {
    mobile: '14px',
    tablet: '15px',
    desktop: '16px',
    wide: '16px',
  } as ResponsiveValue<string>,
}
