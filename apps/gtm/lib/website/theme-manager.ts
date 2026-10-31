/**
 * Theme Manager
 * 
 * Generates light/dark mode color variants and manages theme switching
 */

export interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  background: string
  foreground: string
  card: string
  cardForeground: string
  border: string
  muted: string
  mutedForeground: string
}

export interface Theme {
  name: string
  light: ThemeColors
  dark: ThemeColors
}

/**
 * Generate dark mode colors from light mode colors
 */
export function generateDarkTheme(lightColors: Partial<ThemeColors>): ThemeColors {
  const primary = lightColors.primary || '#6366f1'
  const secondary = lightColors.secondary || primary
  const accent = lightColors.accent || '#f59e0b'

  // Adjust brightness for dark mode
  const primaryDark = adjustColorForDarkMode(primary)
  const secondaryDark = adjustColorForDarkMode(secondary)
  const accentDark = adjustColorForDarkMode(accent)

  return {
    primary: primaryDark,
    secondary: secondaryDark,
    accent: accentDark,
    background: '#0a0a0a',
    foreground: '#fafafa',
    card: '#171717',
    cardForeground: '#fafafa',
    border: '#262626',
    muted: '#262626',
    mutedForeground: '#a1a1aa',
  }
}

/**
 * Generate light mode colors from a primary color
 */
export function generateLightTheme(primaryColor: string, secondaryColor?: string, accentColor?: string): ThemeColors {
  return {
    primary: primaryColor,
    secondary: secondaryColor || primaryColor,
    accent: accentColor || '#f59e0b',
    background: '#ffffff',
    foreground: '#0a0a0a',
    card: '#ffffff',
    cardForeground: '#0a0a0a',
    border: '#e5e7eb',
    muted: '#f4f4f5',
    mutedForeground: '#71717a',
  }
}

/**
 * Generate a complete theme with both light and dark variants
 */
export function generateTheme(name: string, primaryColor: string, secondaryColor?: string, accentColor?: string): Theme {
  const light = generateLightTheme(primaryColor, secondaryColor, accentColor)
  const dark = generateDarkTheme({ primary: primaryColor, secondary: secondaryColor, accent: accentColor })

  return {
    name,
    light,
    dark,
  }
}

/**
 * Adjust a color for dark mode (increase brightness if too dark)
 */
function adjustColorForDarkMode(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255

  // If the color is too dark, lighten it for dark mode
  if (luminance < 0.3) {
    return lightenColor(hex, 20)
  }

  return hex
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null
}

/**
 * Lighten a color by a percentage
 */
function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const r = Math.min(255, rgb.r + Math.round((255 - rgb.r) * (percent / 100)))
  const g = Math.min(255, rgb.g + Math.round((255 - rgb.g) * (percent / 100)))
  const b = Math.min(255, rgb.b + Math.round((255 - rgb.b) * (percent / 100)))

  return rgbToHex(r, g, b)
}

/**
 * Darken a color by a percentage
 */
export function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const r = Math.max(0, Math.round(rgb.r * (1 - percent / 100)))
  const g = Math.max(0, Math.round(rgb.g * (1 - percent / 100)))
  const b = Math.max(0, Math.round(rgb.b * (1 - percent / 100)))

  return rgbToHex(r, g, b)
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

/**
 * Generate CSS custom properties for a theme
 */
export function generateThemeCss(theme: Theme, mode: 'light' | 'dark'): string {
  const colors = mode === 'dark' ? theme.dark : theme.light

  return `
    --color-primary: ${colors.primary};
    --color-secondary: ${colors.secondary};
    --color-accent: ${colors.accent};
    --color-background: ${colors.background};
    --color-foreground: ${colors.foreground};
    --color-card: ${colors.card};
    --color-card-foreground: ${colors.cardForeground};
    --color-border: ${colors.border};
    --color-muted: ${colors.muted};
    --color-muted-foreground: ${colors.mutedForeground};
  `
}

/**
 * Generate full CSS with both themes
 */
export function generateFullThemeCss(theme: Theme): string {
  return `
/* Light mode (default) */
:root {
  ${generateThemeCss(theme, 'light')}
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    ${generateThemeCss(theme, 'dark')}
  }
}

/* Manual dark mode toggle */
[data-theme="dark"] {
  ${generateThemeCss(theme, 'dark')}
}

[data-theme="light"] {
  ${generateThemeCss(theme, 'light')}
}
`
}

/**
 * Pre-defined theme presets
 */
export const THEME_PRESETS: Theme[] = [
  generateTheme('Indigo', '#6366f1', '#8b5cf6', '#f59e0b'),
  generateTheme('Emerald', '#10b981', '#14b8a6', '#f59e0b'),
  generateTheme('Rose', '#f43f5e', '#ec4899', '#f59e0b'),
  generateTheme('Blue', '#3b82f6', '#0ea5e9', '#f59e0b'),
  generateTheme('Orange', '#f97316', '#fb923c', '#6366f1'),
  generateTheme('Purple', '#a855f7', '#8b5cf6', '#f59e0b'),
  generateTheme('Teal', '#14b8a6', '#06b6d4', '#f59e0b'),
  generateTheme('Slate', '#64748b', '#475569', '#f59e0b'),
]

/**
 * Get a theme preset by name
 */
export function getThemePreset(name: string): Theme | undefined {
  return THEME_PRESETS.find(t => t.name.toLowerCase() === name.toLowerCase())
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1)
  const rgb2 = hexToRgb(hex2)
  
  if (!rgb1 || !rgb2) return 1

  const l1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b)
  const l2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const sRGB = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2]
}

/**
 * Check if a color has sufficient contrast for accessibility (WCAG AA)
 */
export function hasAccessibleContrast(foreground: string, background: string, level: 'AA' | 'AAA' = 'AA'): boolean {
  const ratio = getContrastRatio(foreground, background)
  return level === 'AAA' ? ratio >= 7 : ratio >= 4.5
}
