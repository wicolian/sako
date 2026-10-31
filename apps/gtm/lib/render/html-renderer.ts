/**
 * HTML-to-Image Renderer (Satori + resvg-js)
 *
 * Fast serverless rendering for social posts, ads, and simple slides.
 * ~50ms per render, no browser binary needed.
 *
 * Limitations (Satori CSS):
 * - Flexbox only (no CSS Grid)
 * - Limited pseudo-elements
 * - No CSS animations
 * Design social/ad templates with these constraints in mind.
 *
 * For complex layouts or PDF, use pdf-renderer.ts (Playwright fallback).
 */

import satori, { type SatoriOptions } from 'satori'
import type { ReactElement, ReactNode } from 'react'

// Lazy-load resvg to avoid pulling in optional native bindings when the module is first loaded
// (campaign generate route imports social-generator → html-renderer; resvg fails to resolve in some runtimes)
async function getResvg(): Promise<typeof import('@resvg/resvg-js').Resvg> {
  // Use dynamic import with webpackIgnore to prevent build-time bundling
  const mod = await import(
    /* webpackIgnore: true */
    '@resvg/resvg-js'
  )
  return mod.Resvg
}

// ============================================================================
// Types
// ============================================================================

export interface RenderOptions {
  width: number
  height: number
  format?: 'png' | 'jpg' | 'svg'
  scale?: number
  fonts?: FontConfig[]
  backgroundColor?: string
  preferBrowser?: boolean
}

export interface FontConfig {
  name: string
  data: ArrayBuffer
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
  style?: 'normal' | 'italic'
}

export interface RenderResult {
  buffer: Buffer
  format: 'png' | 'jpg' | 'svg'
  width: number
  height: number
  fileSize: number
}

// ============================================================================
// Font loading
// ============================================================================

let defaultFontCache: ArrayBuffer | null = null

async function loadDefaultFont(): Promise<ArrayBuffer> {
  if (defaultFontCache) return defaultFontCache

  // Load Inter font from Google Fonts
  const response = await fetch(
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'
  )
  const css = await response.text()

  // Extract first font URL
  const urlMatch = css.match(/url\(([^)]+)\)/)
  if (urlMatch) {
    const fontResponse = await fetch(urlMatch[1])
    defaultFontCache = await fontResponse.arrayBuffer()
    return defaultFontCache
  }

  // Fallback: fetch directly from Google Fonts static CDN
  const fallbackResponse = await fetch(
    'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf'
  )
  defaultFontCache = await fallbackResponse.arrayBuffer()
  return defaultFontCache
}

export async function loadGoogleFont(
  family: string,
  weight: number = 400
): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`
  )
  const css = await response.text()
  const urlMatch = css.match(/url\(([^)]+)\)/)

  if (!urlMatch) {
    return loadDefaultFont()
  }

  const fontResponse = await fetch(urlMatch[1])
  return fontResponse.arrayBuffer()
}

// ============================================================================
// HTML to Satori JSX conversion
// ============================================================================

/**
 * Convert simple HTML to Satori-compatible JSX structure.
 * Satori uses React-like JSX objects, not actual HTML.
 */
function htmlToSatoriJsx(
  html: string,
  options: RenderOptions
): ReactNode {
  // For Satori, we build a JSX-like structure.
  // Since Satori supports a subset of HTML/CSS via its own renderer,
  // we create wrapper divs with inline styles extracted from the HTML.
  const { createElement: h } = require('react')

  // Parse basic inline styles and structure
  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: options.backgroundColor ?? '#0f172a',
        fontFamily: 'Inter',
        padding: '40px',
      },
    },
    h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      },
      // Use dangerouslySetInnerHTML equivalent for Satori
      // Satori actually renders children, not innerHTML
      children: parseHtmlToSatoriChildren(html, h),
    })
  )
}

function parseHtmlToSatoriChildren(
  html: string,
  h: typeof import('react').createElement
): ReactNode[] {
  const children: ReactNode[] = []

  // Extract text content between tags
  const parts = html
    .replace(/<style[\s\S]*?<\/style>/gi, '') // Remove style tags
    .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove script tags
    .replace(/<head[\s\S]*?<\/head>/gi, '') // Remove head
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .replace(/<\/?div[^>]*>/gi, '')

  // Extract headlines
  const h1Match = parts.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1Match) {
    children.push(
      h('div', {
        key: 'h1',
        style: {
          fontSize: '48px',
          fontWeight: 700,
          color: '#f8fafc',
          marginBottom: '16px',
          textAlign: 'center' as const,
          lineHeight: 1.2,
        },
      }, stripHtml(h1Match[1]))
    )
  }

  const h2Match = parts.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
  if (h2Match) {
    children.push(
      h('div', {
        key: 'h2',
        style: {
          fontSize: '32px',
          fontWeight: 600,
          color: '#e2e8f0',
          marginBottom: '12px',
          textAlign: 'center' as const,
        },
      }, stripHtml(h2Match[1]))
    )
  }

  // Extract paragraphs
  const pMatches = [...parts.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
  for (const [, content] of pMatches) {
    children.push(
      h('div', {
        key: `p-${children.length}`,
        style: {
          fontSize: '20px',
          color: '#cbd5e1',
          lineHeight: 1.6,
          marginBottom: '16px',
          textAlign: 'center' as const,
          maxWidth: '80%',
        },
      }, stripHtml(content))
    )
  }

  // Extract buttons/CTAs
  const btnMatches = [...parts.matchAll(/<(?:button|a)[^>]*>([\s\S]*?)<\/(?:button|a)>/gi)]
  for (const [, content] of btnMatches) {
    const text = stripHtml(content)
    if (text.length < 50) {
      children.push(
        h('div', {
          key: `btn-${children.length}`,
          style: {
            fontSize: '18px',
            fontWeight: 600,
            color: '#ffffff',
            backgroundColor: '#3b82f6',
            padding: '14px 32px',
            borderRadius: '8px',
            marginTop: '16px',
          },
        }, text)
      )
    }
  }

  // If no structured content found, show raw text
  if (children.length === 0) {
    const plainText = stripHtml(parts).trim()
    if (plainText) {
      children.push(
        h('div', {
          key: 'text',
          style: {
            fontSize: '24px',
            color: '#f8fafc',
            lineHeight: 1.5,
            textAlign: 'center' as const,
            whiteSpace: 'pre-wrap' as const,
          },
        }, plainText.slice(0, 500))
      )
    }
  }

  return children
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]+>/g, '').trim()
}

// ============================================================================
// Main render function
// ============================================================================

export async function renderHtmlToImage(
  html: string,
  options: RenderOptions
): Promise<RenderResult> {
  const {
    width,
    height,
    format = 'png',
    scale = 1,
    fonts = [],
    preferBrowser = shouldUseBrowserRenderer(html),
  } = options

  if (format === 'jpg' || preferBrowser) {
    const { renderHtmlToScreenshot } = await import('@/lib/render/pdf-renderer')
    const screenshot = await renderHtmlToScreenshot(html, {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
      format: format === 'jpg' ? 'jpg' : 'png',
      quality: format === 'jpg' ? 90 : undefined,
    })
    return {
      buffer: screenshot.buffer,
      format: screenshot.format,
      width: screenshot.width,
      height: screenshot.height,
      fileSize: screenshot.fileSize,
    }
  }

  // Load fonts
  const fontConfigs: SatoriOptions['fonts'] = []

  if (fonts.length > 0) {
    for (const font of fonts) {
      fontConfigs.push({
        name: font.name,
        data: font.data,
        weight: font.weight,
        style: font.style ?? 'normal',
      })
    }
  } else {
    // Load default Inter font
    const interData = await loadDefaultFont()
    fontConfigs.push({
      name: 'Inter',
      data: interData,
      weight: 400,
      style: 'normal' as const,
    })
  }

  // Build JSX tree from HTML
  const jsx = htmlToSatoriJsx(html, options)

  // Render to SVG via Satori
  const svg = await satori(jsx as ReactElement, {
    width,
    height,
    fonts: fontConfigs,
  })

  if (format === 'svg') {
    const buffer = Buffer.from(svg)
    return { buffer, format: 'svg', width, height, fileSize: buffer.length }
  }

  // Convert SVG to PNG via resvg-js (lazy-loaded so route load doesn't fail when optional native binding is missing)
  try {
    const Resvg = await getResvg()
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width' as const, value: width * scale },
    })
    const pngData = resvg.render()
    const buffer = Buffer.from(pngData.asPng())
    return {
      buffer,
      format: 'png',
      width: width * scale,
      height: height * scale,
      fileSize: buffer.length,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('resvg') || msg.includes('resolve')) {
      throw new Error(
        'PNG rendering unavailable: optional dependency @resvg/resvg-js failed to load. Run: bun add @resvg/resvg-js-darwin-arm64'
        + (process.platform !== 'darwin' || process.arch !== 'arm64' ? ' (or the package for your platform)' : '')
      )
    }
    throw err
  }
}

function shouldUseBrowserRenderer(html: string): boolean {
  return (
    /<style[\s>]/i.test(html) ||
    /oklch|color-mix|container-type|clip-path|backdrop-filter|position:\s*absolute/i.test(html)
  )
}

// ============================================================================
// Batch rendering
// ============================================================================

export async function renderMultiple(
  items: Array<{ html: string; options: RenderOptions }>
): Promise<RenderResult[]> {
  return Promise.all(items.map(({ html, options }) => renderHtmlToImage(html, options)))
}
