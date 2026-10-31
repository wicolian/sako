/**
 * PDF Renderer (Playwright fallback)
 *
 * For complex layouts (landing pages, multi-slide decks) where Satori
 * CSS limits are too restrictive. Uses Playwright's headless Chromium.
 *
 * Slower (~2s vs ~50ms for Satori) but supports full CSS.
 */

// ============================================================================
// Types
// ============================================================================

export interface PdfRenderOptions {
  width?: number
  height?: number
  format?: 'A4' | 'Letter' | 'custom'
  landscape?: boolean
  margin?: {
    top?: string
    right?: string
    bottom?: string
    left?: string
  }
  scale?: number
  printBackground?: boolean
}

export interface ScreenshotOptions {
  width: number
  height: number
  format?: 'png' | 'jpg'
  quality?: number
  fullPage?: boolean
  scale?: number
}

export interface PdfResult {
  buffer: Buffer
  pageCount: number
  fileSize: number
}

export interface ScreenshotResult {
  buffer: Buffer
  format: 'png' | 'jpg'
  width: number
  height: number
  fileSize: number
}

// ============================================================================
// Playwright browser management
// ============================================================================

let browserPromise: Promise<import('playwright').Browser> | null = null

async function getBrowser(): Promise<import('playwright').Browser> {
  if (browserPromise) return browserPromise

  browserPromise = (async () => {
    const { chromium } = await import('playwright')
    return chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  })()

  return browserPromise
}

// ============================================================================
// PDF rendering
// ============================================================================

export async function renderHtmlToPdf(
  html: string,
  options: PdfRenderOptions = {}
): Promise<PdfResult> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    await page.setContent(html, { waitUntil: 'networkidle' })

    // Wait for fonts to load
    await page.waitForTimeout(500)

    const pdfOptions: Record<string, unknown> = {
      printBackground: options.printBackground ?? true,
      scale: options.scale ?? 1,
    }

    if (options.format === 'custom' && options.width && options.height) {
      pdfOptions.width = `${options.width}px`
      pdfOptions.height = `${options.height}px`
    } else {
      pdfOptions.format = options.format ?? 'A4'
      pdfOptions.landscape = options.landscape ?? false
    }

    if (options.margin) {
      pdfOptions.margin = options.margin
    }

    const buffer = await page.pdf(pdfOptions)

    // Rough page count estimation
    const pageCount = Math.max(1, Math.ceil(buffer.length / 50000))

    return {
      buffer: Buffer.from(buffer),
      pageCount,
      fileSize: buffer.length,
    }
  } finally {
    await page.close()
  }
}

// ============================================================================
// Screenshot rendering
// ============================================================================

export async function renderHtmlToScreenshot(
  html: string,
  options: ScreenshotOptions
): Promise<ScreenshotResult> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    await page.setViewportSize({
      width: options.width,
      height: options.height,
    })

    await page.setContent(html, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    const screenshotFormat = options.format === 'jpg' ? 'jpeg' : 'png'
    const buffer = await page.screenshot({
      type: screenshotFormat,
      quality: screenshotFormat === 'jpeg' ? (options.quality ?? 90) : undefined,
      fullPage: options.fullPage ?? false,
    })

    return {
      buffer: Buffer.from(buffer),
      format: options.format ?? 'png',
      width: options.width * (options.scale ?? 1),
      height: options.height * (options.scale ?? 1),
      fileSize: buffer.length,
    }
  } finally {
    await page.close()
  }
}

// ============================================================================
// Multi-slide deck PDF
// ============================================================================

export async function renderDeckToPdf(
  slideHtmls: string[],
  options?: {
    width?: number
    height?: number
    brandCSS?: string
  }
): Promise<PdfResult> {
  const width = options?.width ?? 1920
  const height = options?.height ?? 1080

  // Combine slides into single HTML with page breaks
  const combinedHtml = `<!DOCTYPE html>
<html><head>
<style>
  @page { size: ${width}px ${height}px; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .slide {
    width: ${width}px;
    height: ${height}px;
    page-break-after: always;
    overflow: hidden;
  }
  .slide:last-child { page-break-after: auto; }
  ${options?.brandCSS ?? ''}
</style>
</head><body>
${slideHtmls.map((html, i) => `<div class="slide" data-slide="${i + 1}">${html}</div>`).join('\n')}
</body></html>`

  return renderHtmlToPdf(combinedHtml, {
    format: 'custom',
    width,
    height,
    printBackground: true,
  })
}

// ============================================================================
// Cleanup
// ============================================================================

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise
    await browser.close()
    browserPromise = null
  }
}
