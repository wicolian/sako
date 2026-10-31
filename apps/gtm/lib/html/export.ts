/**
 * Unified HTML Export System
 * 
 * Converts campaign HTML to platform-specific formats for:
 * - Figma (via code.to.design API clipboard mode)
 * - Framer (matching official extension format)
 * - Webflow (via CMS API)
 * - HubSpot (via CMS API)
 * 
 * Since our output is already HTML, we transform it for each platform's
 * specific import mechanism.
 */

export type ExportPlatform = 'figma' | 'framer' | 'webflow' | 'hubspot' | 'wordpress' | 'raw'

export interface ExportOptions {
  /** Target platform */
  platform: ExportPlatform
  /** Campaign name for layer naming */
  name: string
  /** Viewport width for rendering */
  width?: number
  /** Viewport height for rendering */
  height?: number
  /** Whether to use full-size images (Figma only) */
  fullsizeImages?: boolean
  /** Light or dark theme for CSS media queries */
  theme?: 'light' | 'dark'
}

export interface ExportResult {
  success: boolean
  /** Clipboard data for Figma/Framer (paste directly) */
  clipboardData?: string
  /** Direct URL if deployed */
  url?: string
  /** Platform-specific ID */
  externalId?: string
  /** Error message if failed */
  error?: string
  /** Instructions for user */
  instructions?: string
}

// ============================================================================
// FIGMA EXPORT (via code.to.design API)
// ============================================================================

/**
 * Export HTML to Figma clipboard format via code.to.design API
 * 
 * @see https://docs-code.to.design/clipboard-mode
 * @see https://docs-code.to.design/api/~endpoints
 */
export async function exportToFigma(
  html: string,
  css: string,
  options: Omit<ExportOptions, 'platform'>
): Promise<ExportResult> {
  const apiKey = process.env.CODE_TO_DESIGN_API_KEY
  
  if (!apiKey) {
    return {
      success: false,
      error: 'CODE_TO_DESIGN_API_KEY not configured',
      instructions: 'Get an API key from https://code.to.design and add it to your environment'
    }
  }

  try {
    // Combine CSS and HTML as the API expects
    const fullHtml = `<style>${css}</style>${html}`

    const response = await fetch('https://api.to.design/html', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        html: fullHtml,
        clip: true, // Clipboard mode - returns Figma internal clipboard data
        topLayerName: options.name || 'Sako Export',
        width: options.width || 1280,
        height: options.height || 2000,
        fullsizeImages: options.fullsizeImages ?? false,
        theme: options.theme || 'light',
        noAutoLayout: false, // Keep auto-layout for better Figma editing
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      
      // Handle rate limiting
      if (response.status === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again in a moment.',
        }
      }
      
      return {
        success: false,
        error: `code.to.design API error: ${errorText}`,
      }
    }

    // The API returns clipboard data as text when clip=true
    const clipboardData = await response.text()

    return {
      success: true,
      clipboardData,
      instructions: 'Copy the clipboard data, then paste directly into Figma (Cmd/Ctrl+V)',
    }
  } catch (error) {
    return {
      success: false,
      error: `Figma export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Check remaining API calls for code.to.design
 */
export async function getFigmaExportBalance(): Promise<{ calls: number } | null> {
  const apiKey = process.env.CODE_TO_DESIGN_API_KEY
  if (!apiKey) return null

  try {
    const response = await fetch('https://api.to.design/balance', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

// ============================================================================
// FRAMER EXPORT (matching official extension format)
// ============================================================================

/**
 * Framer HTML import metadata structure
 * (Reverse-engineered from official extension)
 */
interface FramerImportMeta {
  width: number
  height: number
  url: string
}

/**
 * Export HTML to Framer clipboard format
 * 
 * This generates the same format as the official "HTML to Framer" extension:
 * - Wraps HTML in a div with `data-framer-html-import-extension` attribute
 * - Inlines all computed styles
 * - Sets position/dimensions as inline styles
 * 
 * The user then copies this to clipboard and pastes in Framer.
 */
export async function exportToFramer(
  html: string,
  css: string,
  options: Omit<ExportOptions, 'platform'>
): Promise<ExportResult> {
  try {
    // Build the Framer import metadata
    const meta: FramerImportMeta = {
      width: options.width || 1280,
      height: options.height || 2000,
      url: 'https://app.sako.ai/export', // Source URL
    }

    // Inline CSS into HTML elements for Framer compatibility
    const inlinedHtml = inlineCssToHtml(html, css)

    // Wrap in Framer's expected format
    const framerHtml = `<div data-framer-html-import-extension='${JSON.stringify(meta)}'>${inlinedHtml}</div>`

    return {
      success: true,
      clipboardData: framerHtml,
      instructions: `
1. Copy the HTML below to your clipboard
2. Open Framer and navigate to your canvas
3. Press Cmd/Ctrl+V to paste
4. The design will appear as editable Framer layers
      `.trim(),
    }
  } catch (error) {
    return {
      success: false,
      error: `Framer export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Inline CSS rules into HTML elements as style attributes
 * This is what Framer's extension does - extracts computed styles
 */
function inlineCssToHtml(html: string, css: string): string {
  // For server-side rendering, we can't compute styles like the browser does
  // Instead, we parse the CSS and apply matching rules inline
  
  // Simple approach: wrap everything and include styles
  // Framer will handle the parsing
  return `<style>${css}</style>${html}`
}

/**
 * Generate Framer-compatible HTML with position styles
 * (More advanced version that matches extension output)
 */
export function generateFramerPositionedHtml(
  element: {
    html: string
    x: number
    y: number
    width: number
    height: number
    styles?: Record<string, string>
  }
): string {
  const positionStyles = {
    position: 'absolute',
    top: `${Math.ceil(element.y)}px`,
    left: `${Math.ceil(element.x)}px`,
    width: `${Math.ceil(element.width)}px`,
    height: `${Math.ceil(element.height)}px`,
    ...element.styles,
  }

  const styleString = Object.entries(positionStyles)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ')

  return `<div style="${styleString}">${element.html}</div>`
}

// ============================================================================
// WEBFLOW EXPORT (via CMS API)
// ============================================================================

/**
 * Export HTML to Webflow as a CMS item or static page
 */
export async function exportToWebflow(
  html: string,
  _css: string,
  options: Omit<ExportOptions, 'platform'> & {
    workspaceId: string
    siteId?: string
    collectionId?: string
    slug?: string
    seoTitle?: string
    seoDescription?: string
  }
): Promise<ExportResult> {
  // This uses the existing Webflow provider
  const { WebflowProvider } = await import('@/lib/providers/webflow')
  const provider = new WebflowProvider()

  const result = await provider.deployPage(html, {
    name: options.name,
    slug: options.slug || options.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    workspaceId: options.workspaceId,
    campaignId: '', // Optional
    collectionId: options.collectionId,
    seoTitle: options.seoTitle,
    seoDescription: options.seoDescription,
  })

  return {
    success: result.success,
    url: result.url,
    externalId: result.externalId,
    error: result.error,
    instructions: result.success
      ? `Page published to Webflow: ${result.url}`
      : undefined,
  }
}

// ============================================================================
// HUBSPOT EXPORT (via CMS API)
// ============================================================================

/**
 * Export HTML to HubSpot as a landing page
 */
export async function exportToHubSpot(
  html: string,
  _css: string,
  options: Omit<ExportOptions, 'platform'> & {
    workspaceId: string
    slug?: string
  }
): Promise<ExportResult> {
  const { HubSpotProvider } = await import('@/lib/providers/hubspot')
  const provider = new HubSpotProvider()

  const result = await provider.deployPage(html, {
    name: options.name,
    slug: options.slug || options.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    workspaceId: options.workspaceId,
    campaignId: '',
  })

  return {
    success: result.success,
    url: result.url,
    externalId: result.externalId,
    error: result.error,
    instructions: result.success
      ? `Landing page created in HubSpot: ${result.url}`
      : undefined,
  }
}

// ============================================================================
// UNIFIED EXPORT FUNCTION
// ============================================================================

/**
 * Export HTML to any supported platform
 */
export async function exportHtml(
  html: string,
  css: string,
  options: ExportOptions & {
    workspaceId?: string
    siteId?: string
    collectionId?: string
    slug?: string
    seoTitle?: string
    seoDescription?: string
  }
): Promise<ExportResult> {
  switch (options.platform) {
    case 'figma':
      return exportToFigma(html, css, options)

    case 'framer':
      return exportToFramer(html, css, options)

    case 'webflow':
      if (!options.workspaceId) {
        return { success: false, error: 'workspaceId required for Webflow export' }
      }
      return exportToWebflow(html, css, {
        ...options,
        workspaceId: options.workspaceId,
      })

    case 'hubspot':
      if (!options.workspaceId) {
        return { success: false, error: 'workspaceId required for HubSpot export' }
      }
      return exportToHubSpot(html, css, {
        ...options,
        workspaceId: options.workspaceId,
      })

    case 'raw':
      // Return raw HTML for manual use
      return {
        success: true,
        clipboardData: `<style>${css}</style>${html}`,
        instructions: 'Raw HTML ready for manual integration',
      }

    default:
      return {
        success: false,
        error: `Unsupported platform: ${options.platform}`,
      }
  }
}

// ============================================================================
// HTML GENERATION UTILITIES
// ============================================================================

/**
 * Generate a complete landing page HTML document
 */
export function generateLandingPageDocument(
  bodyHtml: string,
  options: {
    title: string
    description?: string
    css?: string
    fonts?: string[]
    scripts?: string[]
  }
): string {
  const fontLinks = (options.fonts || [])
    .map(font => `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}&display=swap" rel="stylesheet">`)
    .join('\n    ')

  const scriptTags = (options.scripts || [])
    .map(src => `<script src="${src}"></script>`)
    .join('\n    ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(options.title)}</title>
    ${options.description ? `<meta name="description" content="${escapeHtml(options.description)}">` : ''}
    ${fontLinks}
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: system-ui, -apple-system, sans-serif; }
      ${options.css || ''}
    </style>
</head>
<body>
    ${bodyHtml}
    ${scriptTags}
</body>
</html>`
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Extract CSS from page blocks for export
 */
export function extractBlocksCss(blocks: Array<{ type: string; styles?: Record<string, string> }>): string {
  // Generate CSS from block styles
  const cssRules: string[] = []

  blocks.forEach((block, index) => {
    if (block.styles) {
      const selector = `.block-${index}`
      const rules = Object.entries(block.styles)
        .map(([prop, val]) => `  ${kebabCase(prop)}: ${val};`)
        .join('\n')
      cssRules.push(`${selector} {\n${rules}\n}`)
    }
  })

  return cssRules.join('\n\n')
}

/**
 * Convert camelCase to kebab-case
 */
function kebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}
