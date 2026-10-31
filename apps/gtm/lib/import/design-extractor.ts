/**
 * Design Token Extractor (Jan 2026)
 * 
 * Extracts colors, fonts, spacing, and other design tokens
 * from HTML and CSS for brand analysis.
 */

import { JSDOM } from 'jsdom';

export interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    allColors: string[];
    /** True if we found colors in CSS/meta; false means we used fallbacks */
    extractedFromPage: boolean;
  };
  typography: {
    fontFamily: string;
    fontHeading: string;
    fontSizes: string[];
    fontWeights: string[];
    fontUrl?: string;
    lineHeights: string[];
    /** True if we found font in CSS/meta */
    extractedFromPage: boolean;
  };
  spacing: {
    unit: number;
    scale: number[];
  };
  corners: 'sharp' | 'rounded' | 'pill';
  shadows: 'none' | 'subtle' | 'medium' | 'strong';
  layout: {
    maxWidth: string;
    containerPadding: string;
  };
}

interface ColorCount {
  color: string;
  count: number;
  isBackground: boolean;
  isText: boolean;
  luminance: number;
}

// Common font stacks to identify generic fonts
const GENERIC_FONTS = [
  'system-ui', 'sans-serif', 'serif', 'monospace', 
  '-apple-system', 'BlinkMacSystemFont', 'Segoe UI',
  'Roboto', 'Helvetica', 'Arial', 'Georgia', 'Times New Roman',
];

// Google Fonts domain patterns
const GOOGLE_FONTS_PATTERN = /fonts\.googleapis\.com\/css2?\?family=([^&"']+)/;

/**
 * Extract design tokens from HTML and optional CSS
 * Uses meta theme-color and CSS custom properties when full CSS isn't available (e.g. SPAs).
 */
export function extractDesignTokens(html: string, css?: string): DesignTokens {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  // Collect all CSS from style tags and inline styles
  const allCss = collectAllCss(doc, css);
  
  // Extract colors (includes meta theme-color and CSS variables)
  const colors = extractColors(doc, allCss);
  
  // Extract typography
  const typography = extractTypography(doc, allCss);
  
  // Extract spacing
  const spacing = extractSpacing(allCss);
  
  // Detect corner style
  const corners = detectCornerStyle(allCss);
  
  // Detect shadow style
  const shadows = detectShadowStyle(allCss);
  
  // Extract layout info
  const layout = extractLayout(allCss);
  
  return {
    colors,
    typography,
    spacing,
    corners,
    shadows,
    layout,
  };
}

/**
 * Collect all CSS from the document
 */
function collectAllCss(doc: Document, additionalCss?: string): string {
  const cssParts: string[] = [];
  
  // Style tags
  doc.querySelectorAll('style').forEach(style => {
    cssParts.push(style.textContent || '');
  });
  
  // Inline styles
  doc.querySelectorAll('[style]').forEach(el => {
    cssParts.push(`.inline { ${el.getAttribute('style')} }`);
  });
  
  if (additionalCss) {
    cssParts.push(additionalCss);
  }
  
  return cssParts.join('\n');
}

/**
 * Get theme color from meta tags (works for SPAs with minimal CSS)
 */
function getThemeColorFromMeta(doc: Document): string | null {
  const themeColor = doc.querySelector('meta[name="theme-color"]')?.getAttribute('content');
  if (themeColor && /^#([0-9a-fA-F]{3,8})$/.test(themeColor.trim())) {
    return normalizeHexColor(themeColor.trim());
  }
  const tileColor = doc.querySelector('meta[name="msapplication-TileColor"]')?.getAttribute('content');
  if (tileColor && /^#([0-9a-fA-F]{3,8})$/.test(tileColor.trim())) {
    return normalizeHexColor(tileColor.trim());
  }
  return null;
}

/**
 * Extract CSS custom property colors (e.g. --primary, --color-primary, --accent)
 */
function extractCssVariableColors(css: string): Map<string, string> {
  const colors = new Map<string, string>();
  // Match --name: value; where name suggests a brand/primary color
  const varPattern = /--(?:primary|accent|brand|color-primary|color-accent|main|brand-primary|foreground|background)(?:-[a-z0-9-]+)?\s*:\s*([^;]+);/gi;
  let match;
  while ((match = varPattern.exec(css)) !== null) {
    const value = match[1].trim();
    const hex = parseColorValue(value);
    if (hex && !isGrayScale(hex)) {
      colors.set(match[0].toLowerCase(), hex);
    }
  }
  return colors;
}

function parseColorValue(value: string): string | null {
  const hexMatch = value.match(/#([0-9a-fA-F]{3,8})\b/);
  if (hexMatch) return normalizeHexColor(hexMatch[0]);
  const rgbMatch = value.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
  }
  return null;
}

/**
 * Extract and analyze colors
 */
function extractColors(doc: Document, css: string): DesignTokens['colors'] {
  const colorCounts: Map<string, ColorCount> = new Map();
  let foundInPage = false;

  // 1. Meta theme-color (SPA-friendly)
  const metaTheme = getThemeColorFromMeta(doc);
  if (metaTheme) {
    addColorCount(colorCounts, metaTheme, ' ', 0);
    foundInPage = true;
  }

  // 2. CSS custom properties (Tailwind, design systems)
  const varColors = extractCssVariableColors(css);
  varColors.forEach((hex) => {
    addColorCount(colorCounts, hex, ' ', 0);
    foundInPage = true;
  });

  // 3. Hex colors from CSS
  const hexPattern = /#([0-9a-fA-F]{3,8})\b/g;
  let match;
  while ((match = hexPattern.exec(css)) !== null) {
    const color = normalizeHexColor(match[0]);
    if (color && !isGrayScale(color)) {
      addColorCount(colorCounts, color, css, match.index);
      foundInPage = true;
    }
  }

  // 4. RGB colors
  const rgbPattern = /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/g;
  while ((match = rgbPattern.exec(css)) !== null) {
    const color = rgbToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
    if (!isGrayScale(color)) {
      addColorCount(colorCounts, color, css, match.index);
      foundInPage = true;
    }
  }

  // Sort colors by frequency
  const sortedColors = Array.from(colorCounts.values())
    .sort((a, b) => b.count - a.count);

  // Prefer meta theme as primary when we have little else (SPA case)
  let primary = findPrimaryColor(sortedColors);
  let secondary = findSecondaryColor(sortedColors, primary);
  let accent = findAccentColor(sortedColors, primary, secondary);
  const background = findBackgroundColor(sortedColors, css);
  const text = findTextColor(sortedColors, css);

  if (metaTheme && sortedColors.length <= 1 && !isGrayScale(metaTheme)) {
    primary = metaTheme;
    secondary = darkenColor(primary, 15);
    accent = primary;
  }

  return {
    primary,
    secondary,
    accent,
    background,
    text,
    allColors: sortedColors.map(c => c.color).slice(0, 20),
    extractedFromPage: foundInPage && sortedColors.length > 0,
  };
}

/**
 * Add color to count map with context
 */
function addColorCount(
  counts: Map<string, ColorCount>,
  color: string,
  css: string,
  index: number
): void {
  // Look at surrounding CSS to determine if it's background or text
  const context = css.slice(Math.max(0, index - 50), index + 50);
  const isBackground = /background/i.test(context);
  const isText = /color(?!:)|font/i.test(context) && !isBackground;
  
  const existing = counts.get(color);
  if (existing) {
    existing.count++;
    existing.isBackground = existing.isBackground || isBackground;
    existing.isText = existing.isText || isText;
  } else {
    counts.set(color, {
      color,
      count: 1,
      isBackground,
      isText,
      luminance: getLuminance(color),
    });
  }
}

/**
 * Normalize hex color to 6-digit format
 */
function normalizeHexColor(hex: string): string {
  hex = hex.replace('#', '');
  
  // Expand 3-digit hex
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  
  // Take first 6 characters (ignore alpha)
  hex = hex.slice(0, 6);
  
  return '#' + hex.toLowerCase();
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.min(255, Math.max(0, x)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Check if color is grayscale
 */
function isGrayScale(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // Allow some variance for near-grays
  const variance = Math.max(r, g, b) - Math.min(r, g, b);
  return variance < 15;
}

/**
 * Calculate relative luminance
 */
function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const [rs, gs, bs] = [r, g, b].map(c => 
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Find primary color (most used non-background color)
 */
function findPrimaryColor(colors: ColorCount[]): string {
  // Look for colors that are used frequently and not too light/dark
  for (const c of colors) {
    if (c.luminance > 0.1 && c.luminance < 0.9 && c.count >= 2) {
      return c.color;
    }
  }
  return colors[0]?.color || '#3b82f6'; // Default blue
}

/**
 * Find secondary color (different from primary)
 */
function findSecondaryColor(colors: ColorCount[], primary: string): string {
  for (const c of colors) {
    if (c.color !== primary && c.luminance > 0.1 && c.luminance < 0.9) {
      // Check color distance
      if (getColorDistance(c.color, primary) > 50) {
        return c.color;
      }
    }
  }
  return darkenColor(primary, 20);
}

/**
 * Find accent color (contrasting, vibrant)
 */
function findAccentColor(colors: ColorCount[], primary: string, secondary: string): string {
  for (const c of colors) {
    if (c.color !== primary && c.color !== secondary) {
      // Look for vibrant colors
      const saturation = getColorSaturation(c.color);
      if (saturation > 50 && c.luminance > 0.2 && c.luminance < 0.8) {
        return c.color;
      }
    }
  }
  return '#f59e0b'; // Default amber
}

/**
 * Find background color
 */
function findBackgroundColor(colors: ColorCount[], css: string): string {
  // Check for explicit background colors
  for (const c of colors) {
    if (c.isBackground && (c.luminance > 0.9 || c.luminance < 0.1)) {
      return c.color;
    }
  }
  
  // Default based on overall style
  const darkMode = css.includes('dark') || 
    colors.some(c => c.isBackground && c.luminance < 0.2);
  
  return darkMode ? '#0f0f0f' : '#ffffff';
}

/**
 * Find text color
 */
function findTextColor(colors: ColorCount[], css: string): string {
  for (const c of colors) {
    if (c.isText && (c.luminance > 0.8 || c.luminance < 0.2)) {
      return c.color;
    }
  }
  
  // Default based on background
  const darkMode = css.includes('dark');
  return darkMode ? '#ffffff' : '#1f2937';
}

/**
 * Get color distance (simple Euclidean in RGB space)
 */
function getColorDistance(hex1: string, hex2: string): number {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  
  return Math.sqrt(
    Math.pow(r2 - r1, 2) + 
    Math.pow(g2 - g1, 2) + 
    Math.pow(b2 - b1, 2)
  );
}

/**
 * Get color saturation
 */
function getColorSaturation(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  
  if (max === min) return 0;
  
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

/**
 * Darken a color by percentage
 */
function darkenColor(hex: string, percent: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - (255 * percent / 100));
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - (255 * percent / 100));
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - (255 * percent / 100));
  
  return rgbToHex(Math.round(r), Math.round(g), Math.round(b));
}

/**
 * Extract typography information
 */
function extractTypography(doc: Document, css: string): DesignTokens['typography'] {
  // Find Google Fonts URL
  let fontUrl: string | undefined;
  const googleFontsMatch = css.match(GOOGLE_FONTS_PATTERN);
  if (googleFontsMatch) {
    fontUrl = `https://fonts.googleapis.com/css2?family=${googleFontsMatch[1]}`;
  }
  
  // Also check link tags
  doc.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => {
    fontUrl = link.getAttribute('href') || fontUrl;
  });
  
  // Extract font families
  const fontFamilyPattern = /font-family\s*:\s*['"]?([^;'"]+)/gi;
  const fonts: string[] = [];
  let match;
  
  while ((match = fontFamilyPattern.exec(css)) !== null) {
    const fontList = match[1].split(',').map(f => f.trim().replace(/['"]/g, ''));
    fontList.forEach(font => {
      if (!GENERIC_FONTS.includes(font) && !fonts.includes(font)) {
        fonts.push(font);
      }
    });
  }
  
  // Extract font sizes
  const fontSizePattern = /font-size\s*:\s*([\d.]+(?:px|rem|em|%))/gi;
  const fontSizes: Set<string> = new Set();
  
  while ((match = fontSizePattern.exec(css)) !== null) {
    fontSizes.add(match[1]);
  }
  
  // Extract font weights
  const fontWeightPattern = /font-weight\s*:\s*(\d{3}|bold|normal|lighter|bolder)/gi;
  const fontWeights: Set<string> = new Set();
  
  while ((match = fontWeightPattern.exec(css)) !== null) {
    fontWeights.add(match[1]);
  }
  
  // Extract line heights
  const lineHeightPattern = /line-height\s*:\s*([\d.]+(?:px|rem|em|%)?)/gi;
  const lineHeights: Set<string> = new Set();
  
  while ((match = lineHeightPattern.exec(css)) !== null) {
    lineHeights.add(match[1]);
  }
  
  // Determine primary font and heading font; avoid fake defaults when nothing found
  const fontDetected = fonts.length > 0;
  const fontFamily = fonts[0] || 'Not detected';
  const fontHeading = fonts.length > 1 ? fonts[1] : fonts[0] || 'Not detected';

  return {
    fontFamily,
    fontHeading,
    fontSizes: Array.from(fontSizes).slice(0, 10),
    fontWeights: Array.from(fontWeights),
    fontUrl,
    lineHeights: Array.from(lineHeights).slice(0, 5),
    extractedFromPage: fontDetected,
  };
}

/**
 * Extract spacing patterns
 */
function extractSpacing(css: string): DesignTokens['spacing'] {
  const spacingPattern = /(?:padding|margin|gap)\s*:\s*([\d.]+)px/gi;
  const spacings: number[] = [];
  let match;
  
  while ((match = spacingPattern.exec(css)) !== null) {
    const value = parseFloat(match[1]);
    if (value > 0 && value < 200) {
      spacings.push(value);
    }
  }
  
  // Find common base unit (likely 4 or 8)
  const gcd = findGcd(spacings.filter(s => s % 4 === 0 || s % 8 === 0));
  const unit = gcd >= 4 ? gcd : 8;
  
  // Find scale multipliers
  const scale = [...new Set(spacings.map(s => s / unit).filter(s => s === Math.floor(s)))].sort((a, b) => a - b);
  
  return {
    unit,
    scale: scale.slice(0, 10),
  };
}

/**
 * Find GCD of an array of numbers
 */
function findGcd(numbers: number[]): number {
  if (numbers.length === 0) return 8;
  
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  return numbers.reduce((acc, n) => gcd(acc, Math.round(n)));
}

/**
 * Detect corner style (sharp, rounded, pill)
 */
function detectCornerStyle(css: string): DesignTokens['corners'] {
  const radiusPattern = /border-radius\s*:\s*([\d.]+)(px|rem|em|%)?/gi;
  const radii: number[] = [];
  let match;
  
  while ((match = radiusPattern.exec(css)) !== null) {
    let value = parseFloat(match[1]);
    // Convert to px approximation
    if (match[2] === 'rem' || match[2] === 'em') {
      value *= 16;
    } else if (match[2] === '%') {
      value = value > 40 ? 999 : value; // Treat high % as pill
    }
    radii.push(value);
  }
  
  if (radii.length === 0) return 'sharp';
  
  const avgRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
  const maxRadius = Math.max(...radii);
  
  if (maxRadius > 50 || radii.some(r => r >= 9999)) {
    return 'pill';
  } else if (avgRadius > 4) {
    return 'rounded';
  }
  
  return 'sharp';
}

/**
 * Detect shadow style
 */
function detectShadowStyle(css: string): DesignTokens['shadows'] {
  const shadowPattern = /box-shadow\s*:\s*([^;]+)/gi;
  const shadows: string[] = [];
  let match;
  
  while ((match = shadowPattern.exec(css)) !== null) {
    if (!match[1].includes('none')) {
      shadows.push(match[1]);
    }
  }
  
  if (shadows.length === 0) return 'none';
  
  // Analyze shadow intensity
  let totalIntensity = 0;
  shadows.forEach(shadow => {
    // Look at blur radius and spread
    const parts = shadow.match(/(\d+)px/g);
    if (parts && parts.length >= 3) {
      const blur = parseInt(parts[2]) || 0;
      totalIntensity += blur;
    }
  });
  
  const avgIntensity = totalIntensity / shadows.length;
  
  if (avgIntensity > 20) return 'strong';
  if (avgIntensity > 8) return 'medium';
  if (avgIntensity > 0) return 'subtle';
  
  return 'none';
}

/**
 * Extract layout information
 */
function extractLayout(css: string): DesignTokens['layout'] {
  // Find max-width patterns
  const maxWidthPattern = /max-width\s*:\s*([\d.]+)(px|rem|em)/gi;
  const maxWidths: number[] = [];
  let match;
  
  while ((match = maxWidthPattern.exec(css)) !== null) {
    let value = parseFloat(match[1]);
    if (match[2] === 'rem' || match[2] === 'em') {
      value *= 16;
    }
    if (value > 800 && value < 2000) {
      maxWidths.push(value);
    }
  }
  
  // Find padding patterns for containers
  const paddingPattern = /padding\s*:\s*[\d.]+(?:px|rem|em)\s+([\d.]+)(px|rem|em)/gi;
  const paddings: number[] = [];
  
  while ((match = paddingPattern.exec(css)) !== null) {
    let value = parseFloat(match[1]);
    if (match[2] === 'rem' || match[2] === 'em') {
      value *= 16;
    }
    if (value >= 16 && value <= 128) {
      paddings.push(value);
    }
  }
  
  const maxWidth = maxWidths.length > 0 
    ? `${Math.round(maxWidths.reduce((a, b) => a + b) / maxWidths.length)}px`
    : '1280px';
  
  const containerPadding = paddings.length > 0
    ? `${Math.round(paddings.reduce((a, b) => a + b) / paddings.length)}px`
    : '24px';
  
  return {
    maxWidth,
    containerPadding,
  };
}
