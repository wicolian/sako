/**
 * Visual QA Heuristics
 *
 * Scores generated HTML on design quality dimensions to prevent
 * "generic as fuck" output. Implements generate → score → auto-fix loop.
 *
 * Quality dimensions:
 * 1. Contrast ratio (WCAG AA ≥ 4.5:1)
 * 2. Typography hierarchy (h1 > 32px, proper scale)
 * 3. Spacing rhythm (consistent base unit)
 * 4. CTA prominence
 * 5. Density (not too cramped or sparse)
 * 6. Alignment (proper grid/flex, no float)
 */

// ============================================================================
// Types
// ============================================================================

export interface QualityScore {
  overall: number // 0-1
  dimensions: {
    contrast: number
    typography: number
    spacing: number
    ctaProminence: number
    density: number
    alignment: number
    brandFit: number
    restraint: number
  }
  issues: QualityIssue[]
  passed: boolean // true if >= 0.7
}

export interface QualityIssue {
  category:
    | 'contrast'
    | 'typography'
    | 'spacing'
    | 'hierarchy'
    | 'density'
    | 'alignment'
    | 'cta'
    | 'brand-fit'
    | 'restraint'
  severity: 'error' | 'warning' | 'info'
  message: string
  element?: string
  suggestion?: string
  autoFixable?: boolean
}

// ============================================================================
// Main scoring function
// ============================================================================

export function scoreDesignQuality(html: string, css?: string): QualityScore {
  const fullContent = css ? `${css}\n${html}` : html
  const issues: QualityIssue[] = []

  // 1. Contrast analysis
  const contrastScore = scoreContrast(fullContent, issues)

  // 2. Typography hierarchy
  const typographyScore = scoreTypography(html, fullContent, issues)

  // 3. Spacing rhythm
  const spacingScore = scoreSpacing(fullContent, issues)

  // 4. CTA prominence
  const ctaScore = scoreCTAProminence(html, fullContent, issues)

  // 5. Density
  const densityScore = scoreDensity(html, issues)

  // 6. Alignment
  const alignmentScore = scoreAlignment(fullContent, issues)

  // 7. Brand fit
  const brandFitScore = scoreBrandFit(fullContent, issues)

  // 8. Restraint
  const restraintScore = scoreRestraint(fullContent, issues)

  // Weighted average
  const overall =
    contrastScore * 0.17 +
    typographyScore * 0.17 +
    spacingScore * 0.15 +
    ctaScore * 0.16 +
    densityScore * 0.1 +
    alignmentScore * 0.1 +
    brandFitScore * 0.08 +
    restraintScore * 0.07

  return {
    overall,
    dimensions: {
      contrast: contrastScore,
      typography: typographyScore,
      spacing: spacingScore,
      ctaProminence: ctaScore,
      density: densityScore,
      alignment: alignmentScore,
      brandFit: brandFitScore,
      restraint: restraintScore,
    },
    issues,
    passed: overall >= 0.7,
  }
}

// ============================================================================
// Contrast scoring
// ============================================================================

function scoreContrast(content: string, issues: QualityIssue[]): number {
  let score = 0.8 // default reasonable

  // Check for low-contrast patterns
  const lightOnLight = /color:\s*#[fFeEdDcC][fFeEdDcC][\s\S]*background[\s\S]*#[fFeEdDcC][fFeEdDcC]/
  const darkOnDark = /color:\s*#[0-3][0-3][\s\S]*background[\s\S]*#[0-3][0-3]/

  if (lightOnLight.test(content)) {
    score -= 0.3
    issues.push({
      category: 'contrast',
      severity: 'error',
      message: 'Light text on light background detected — contrast ratio likely below 4.5:1',
      suggestion: 'Darken text color or lighten background for WCAG AA compliance',
      autoFixable: true,
    })
  }

  if (darkOnDark.test(content)) {
    score -= 0.3
    issues.push({
      category: 'contrast',
      severity: 'error',
      message: 'Dark text on dark background detected',
      suggestion: 'Lighten text color or darken background',
      autoFixable: true,
    })
  }

  // Check for brand CSS variables (good pattern)
  if (content.includes('var(--brand-text)') && (content.includes('var(--brand-background)') || content.includes('var(--brand-bg)'))) {
    score = Math.max(score, 0.85)
  }

  return Math.max(0, Math.min(1, score))
}

// ============================================================================
// Typography scoring
// ============================================================================

function scoreTypography(html: string, content: string, issues: QualityIssue[]): number {
  let score = 0.5

  // Check for h1 presence
  const hasH1 = /<h1/i.test(html)
  if (hasH1) {
    score += 0.2
  } else {
    issues.push({
      category: 'typography',
      severity: 'warning',
      message: 'No h1 element found — page lacks clear heading hierarchy',
      suggestion: 'Add a prominent h1 headline',
    })
  }

  // Check h1 size ≥ 32px
  const h1SizeMatch = content.match(/h1[^{]*\{[^}]*font-size:\s*(\d+)/i)
  if (h1SizeMatch) {
    const h1Size = parseInt(h1SizeMatch[1], 10)
    if (h1Size >= 32) {
      score += 0.15
    } else {
      issues.push({
        category: 'typography',
        severity: 'warning',
        message: `h1 font-size is ${h1Size}px — should be at least 32px for visual hierarchy`,
        suggestion: 'Increase h1 font-size to 36px or larger',
        autoFixable: true,
      })
    }
  } else if (hasH1) {
    // No explicit size but h1 exists — assume browser default (32px)
    score += 0.1
  }

  // Check for font-family declaration
  if (content.includes('font-family')) {
    score += 0.1
  }

  // Check for proper heading hierarchy (h1 > h2 > h3)
  const hasH2 = /<h2/i.test(html)
  const hasH3 = /<h3/i.test(html)
  if (hasH1 && hasH2) score += 0.05
  if (hasH2 && hasH3) score += 0.05

  return Math.max(0, Math.min(1, score))
}

// ============================================================================
// Spacing scoring
// ============================================================================

function scoreSpacing(content: string, issues: QualityIssue[]): number {
  let score = 0.6

  // Check for consistent spacing (8px base unit)
  const paddingValues = [...content.matchAll(/padding[^:]*:\s*(\d+)px/gi)]
    .map((m) => parseInt(m[1], 10))
  const marginValues = [...content.matchAll(/margin[^:]*:\s*(\d+)px/gi)]
    .map((m) => parseInt(m[1], 10))
  const gapValues = [...content.matchAll(/gap:\s*(\d+)px/gi)]
    .map((m) => parseInt(m[1], 10))

  const allSpacing = [...paddingValues, ...marginValues, ...gapValues]

  if (allSpacing.length > 0) {
    // Check if values follow 8px grid
    const on8Grid = allSpacing.filter((v) => v % 8 === 0 || v % 4 === 0).length
    const gridRatio = on8Grid / allSpacing.length
    score += gridRatio * 0.3

    if (gridRatio < 0.5) {
      issues.push({
        category: 'spacing',
        severity: 'info',
        message: 'Spacing values don\'t follow a consistent base unit',
        suggestion: 'Align spacing to 4px or 8px grid for visual rhythm',
      })
    }
  }

  // Check for adequate padding (not too tight)
  if (paddingValues.length > 0 && Math.max(...paddingValues) >= 24) {
    score += 0.1
  }

  return Math.max(0, Math.min(1, score))
}

// ============================================================================
// CTA prominence scoring
// ============================================================================

function scoreCTAProminence(html: string, content: string, issues: QualityIssue[]): number {
  let score = 0.3

  // Check for CTA button/link
  const hasButton = /<button/i.test(html)
  const hasLink = /<a[^>]*class/i.test(html)
  const hasCTA = hasButton || hasLink

  if (!hasCTA) {
    issues.push({
      category: 'cta',
      severity: 'warning',
      message: 'No CTA button or prominent link found',
      suggestion: 'Add a clear call-to-action button',
    })
    return 0.2
  }

  score += 0.3

  // Check CTA styling (background color, padding, border-radius)
  if (content.includes('background') && (hasButton || hasLink)) {
    score += 0.2
  }

  // Check for hover states
  if (content.includes(':hover')) {
    score += 0.1
  }

  // Check padding on buttons
  const btnPadding = content.match(/button[^{]*\{[^}]*padding:\s*(\d+)/i)
  if (btnPadding && parseInt(btnPadding[1], 10) >= 12) {
    score += 0.1
  }

  return Math.max(0, Math.min(1, score))
}

// ============================================================================
// Density scoring
// ============================================================================

function scoreDensity(html: string, issues: QualityIssue[]): number {
  // Count text content vs whitespace/structure
  const textContent = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  const htmlLength = html.length
  const textRatio = textContent.length / Math.max(htmlLength, 1)

  let score = 0.7

  // Too dense (too much text relative to structure)
  if (textRatio > 0.4) {
    score -= 0.2
    issues.push({
      category: 'density',
      severity: 'info',
      message: 'Content appears very text-heavy — may look cramped',
      suggestion: 'Add more whitespace, break content into smaller blocks',
    })
  }

  // Too sparse (almost no text)
  if (textRatio < 0.05 && textContent.length > 0) {
    score -= 0.1
    issues.push({
      category: 'density',
      severity: 'info',
      message: 'Very little content relative to structure',
      suggestion: 'Ensure meaningful content is present',
    })
  }

  // Check for reasonable section count
  const sectionCount = (html.match(/<section|<div[^>]*class/gi) ?? []).length
  if (sectionCount >= 3 && sectionCount <= 12) {
    score += 0.1
  }

  return Math.max(0, Math.min(1, score))
}

// ============================================================================
// Alignment scoring
// ============================================================================

function scoreAlignment(content: string, issues: QualityIssue[]): number {
  let score = 0.7

  // Penalize float layouts
  if (content.includes('float:') && !content.includes('clear:')) {
    score -= 0.3
    issues.push({
      category: 'alignment',
      severity: 'warning',
      message: 'Float-based layout detected — prone to alignment issues',
      suggestion: 'Use flexbox or grid instead of float',
      autoFixable: true,
    })
  }

  // Reward flexbox/grid
  if (content.includes('display: flex') || content.includes('display:flex')) {
    score += 0.15
  }
  if (content.includes('display: grid') || content.includes('display:grid')) {
    score += 0.15
  }

  // Check for consistent text alignment
  const alignments = [...content.matchAll(/text-align:\s*(\w+)/gi)].map((m) => m[1])
  const uniqueAlignments = new Set(alignments)
  if (uniqueAlignments.size <= 2) {
    score += 0.05
  }

  return Math.max(0, Math.min(1, score))
}

function scoreBrandFit(content: string, issues: QualityIssue[]): number {
  let score = 0.55

  if (content.includes('var(--brand-primary)') || content.includes('var(--brand-bg)')) {
    score += 0.2
  }

  if (content.includes('font-family')) {
    score += 0.1
  }

  const genericBrowserChrome = /(w-3 h-3 rounded-full bg-(red|amber|yellow|green)-|window controls|browser bar)/i
  if (genericBrowserChrome.test(content)) {
    score -= 0.2
    issues.push({
      category: 'brand-fit',
      severity: 'warning',
      message: 'Fake browser or dashboard chrome detected',
      suggestion: 'Use real product proof or simple framing instead of generic app-window decoration',
    })
  }

  if (/proof|testimonial|trusted|case study|customer/i.test(content)) {
    score += 0.1
  }

  return Math.max(0, Math.min(1, score))
}

function scoreRestraint(content: string, issues: QualityIssue[]): number {
  let score = 0.8

  const checks: Array<{
    pattern: RegExp
    penalty: number
    message: string
    severity: QualityIssue['severity']
  }> = [
    {
      pattern: /gradient/gi,
      penalty: 0.08,
      message: 'Gradient-heavy styling detected',
      severity: 'info',
    },
    {
      pattern: /hover:scale|scale\(|translateY\(-?\d|rotate\(/gi,
      penalty: 0.15,
      message: 'Decorative hover or transform effects detected',
      severity: 'warning',
    },
    {
      pattern: /backdrop-filter|backdrop-blur|glass/gi,
      penalty: 0.14,
      message: 'Glassmorphism or heavy blur detected',
      severity: 'warning',
    },
    {
      pattern: /emoji|["'](?:Launch|Proof|Tips)["'].*[^\x00-\x7F]|🚀|✨|🎯|💬|💰|❓|📊/g,
      penalty: 0.12,
      message: 'Emoji or novelty icon treatment detected',
      severity: 'warning',
    },
    {
      pattern: /cursor|mousemove|IntersectionObserver|scroll-behavior|parallax/gi,
      penalty: 0.12,
      message: 'Decorative motion hooks detected',
      severity: 'warning',
    },
  ]

  for (const check of checks) {
    const matches = content.match(check.pattern)
    if (!matches || matches.length === 0) continue

    score -= check.penalty * Math.min(matches.length, 3)
    issues.push({
      category: 'restraint',
      severity: check.severity,
      message: check.message,
      suggestion: 'Remove decorative UI effects and keep only brand-supporting treatment',
      autoFixable: /hover|translateY|backdrop-filter|backdrop-blur|IntersectionObserver/.test(
        check.pattern.source,
      ),
    })
  }

  const accentColors = new Set(
    [...content.matchAll(/#[0-9a-fA-F]{6}\b/g)]
      .map((match) => match[0].toLowerCase())
      .filter((color) => !['#ffffff', '#111111', '#0f172a', '#f8fafc'].includes(color)),
  )

  if (accentColors.size > 4) {
    score -= 0.12
    issues.push({
      category: 'restraint',
      severity: 'warning',
      message: 'Too many unrelated accent colors detected',
      suggestion: 'Reduce the palette to one primary accent and a restrained neutral system',
    })
  }

  return Math.max(0, Math.min(1, score))
}

// ============================================================================
// Auto-fix
// ============================================================================

export function autoFixIssues(html: string, issues: QualityIssue[]): string {
  let result = html

  for (const issue of issues) {
    if (!issue.autoFixable) continue

    switch (issue.category) {
      case 'contrast':
        // Ensure text has sufficient contrast by adding explicit colors
        if (issue.message.includes('Light text on light')) {
          result = result.replace(
            /(<body[^>]*style="[^"]*)(color:\s*#[fFeEdDcC][fFeEdDcC][fFeEdDcC]+)/,
            '$1color: #1f2937'
          )
        }
        break

      case 'typography':
        // Fix small h1
        if (issue.message.includes('font-size')) {
          result = result.replace(
            /(h1[^{]*\{[^}]*font-size:\s*)\d+(px)/i,
            '$136$2'
          )
        }
        break

      case 'alignment':
        // Replace float with flex
        if (issue.message.includes('Float')) {
          result = result.replace(/float:\s*left/gi, 'display: flex')
          result = result.replace(/float:\s*right/gi, 'display: flex; justify-content: flex-end')
        }
        break

      case 'restraint':
        result = result.replace(/hover:scale-\[[^\]]+\]/gi, '')
        result = result.replace(/hover:scale-\d+/gi, '')
        result = result.replace(/transform:\s*translateY\([^;]+\);?/gi, '')
        result = result.replace(/backdrop-filter:\s*blur\([^;]+\);?/gi, '')
        result = result.replace(/backdrop-blur-[\w/.-]+/gi, '')
        break
    }
  }

  return result
}

// ============================================================================
// Best-of-N selection
// ============================================================================

export function selectBestVariant(
  variants: Array<{ html: string; score?: QualityScore }>
): { html: string; score: QualityScore; index: number } {
  const scored = variants.map((v, i) => ({
    html: v.html,
    score: v.score ?? scoreDesignQuality(v.html),
    index: i,
  }))

  scored.sort((a, b) => b.score.overall - a.score.overall)
  return scored[0]
}
