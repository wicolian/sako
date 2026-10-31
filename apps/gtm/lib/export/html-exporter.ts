/**
 * HTML Exporter
 * 
 * Converts WebsiteDesign to self-contained static HTML files
 * - Generates responsive HTML with embedded CSS
 * - Includes all fonts and assets
 * - Ready for download or deployment
 */

import type { WebsiteDesign, WebsiteSection } from '@/lib/website/ai-designer'
import { generateCss, generateCssVariables } from './css-generator'

export interface ExportOptions {
  minify?: boolean
  includeAnalytics?: boolean
  analyticsId?: string
  customHead?: string
  customBody?: string
}

/**
 * Export a design to a self-contained HTML file
 */
export function exportToHtml(design: WebsiteDesign, options: ExportOptions = {}): string {
  const { globalStyles, sections, seoMeta, name } = design
  const { minify = false, includeAnalytics, analyticsId, customHead, customBody } = options

  const sortedSections = [...sections].sort((a, b) => a.order - b.order)
  const sectionsHtml = sortedSections.map(s => generateSectionHtml(s, globalStyles)).join('\n\n')

  const cssVariables = generateCssVariables(globalStyles)
  const css = generateCss(globalStyles)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(seoMeta.title || name)}</title>
  <meta name="description" content="${escapeHtml(seoMeta.description || '')}">
  ${seoMeta.keywords?.length ? `<meta name="keywords" content="${escapeHtml(seoMeta.keywords.join(', '))}">` : ''}
  
  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(seoMeta.title || name)}">
  <meta property="og:description" content="${escapeHtml(seoMeta.description || '')}">
  <meta property="og:type" content="website">
  ${seoMeta.ogImage ? `<meta property="og:image" content="${escapeHtml(seoMeta.ogImage)}">` : ''}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(seoMeta.title || name)}">
  <meta name="twitter:description" content="${escapeHtml(seoMeta.description || '')}">
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(globalStyles.fontHeading || 'Inter')}:wght@400;500;600;700&family=${encodeURIComponent(globalStyles.fontBody || 'Inter')}:wght@400;500;600&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS (for utility classes) -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- Custom Styles -->
  <style>
${cssVariables}

${css}
  </style>
  
  ${customHead || ''}
  
  ${includeAnalytics && analyticsId ? `
  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(analyticsId)}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${escapeHtml(analyticsId)}');
  </script>
  ` : ''}
</head>
<body>
${sectionsHtml}
${customBody || ''}
</body>
</html>`

  return minify ? minifyHtml(html) : html
}

/**
 * Generate HTML for a single section
 */
export function generateSectionHtml(section: WebsiteSection, globalStyles: WebsiteDesign['globalStyles']): string {
  const { type, content, styles } = section

  const bgClass = getBackgroundClass(styles.background)
  const spacingClass = getSpacingClass(styles.spacing)
  const alignClass = getAlignmentClass(styles.alignment)

  switch (type) {
    case 'hero':
      return `  <section class="${bgClass} ${spacingClass}">
    <div class="max-w-6xl mx-auto px-6 ${alignClass}">
      ${content.headline ? `<h1 class="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">${escapeHtml(content.headline)}</h1>` : ''}
      ${content.subheadline ? `<p class="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl ${styles.alignment === 'center' ? 'mx-auto' : ''}">${escapeHtml(content.subheadline)}</p>` : ''}
      <div class="flex flex-col sm:flex-row gap-4 ${styles.alignment === 'center' ? 'justify-center' : ''}">
        ${content.cta ? `<a href="${escapeHtml(content.cta.link)}" class="btn-primary">${escapeHtml(content.cta.text)}</a>` : ''}
        ${content.secondaryCta ? `<a href="${escapeHtml(content.secondaryCta.link)}" class="btn-secondary">${escapeHtml(content.secondaryCta.text)}</a>` : ''}
      </div>
    </div>
  </section>`

    case 'features':
      const cols = styles.columns || 3
      return `  <section class="${bgClass} ${spacingClass}">
    <div class="max-w-6xl mx-auto px-6">
      ${content.headline ? `<h2 class="text-3xl md:text-4xl font-bold mb-4 ${alignClass}">${escapeHtml(content.headline)}</h2>` : ''}
      ${content.subheadline ? `<p class="text-muted-foreground mb-12 ${alignClass} max-w-3xl ${styles.alignment === 'center' ? 'mx-auto' : ''}">${escapeHtml(content.subheadline)}</p>` : ''}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${cols} gap-8">
        ${(content.items || []).map(item => `
        <div class="p-6 rounded-xl bg-card shadow-sm border border-border/50 hover:shadow-md transition-shadow">
          ${item.icon ? `<div class="text-4xl mb-4">${item.icon}</div>` : ''}
          <h3 class="text-xl font-semibold mb-2">${escapeHtml(item.title)}</h3>
          <p class="text-muted-foreground">${escapeHtml(item.description)}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>`

    case 'testimonials':
      return `  <section class="${bgClass} ${spacingClass}">
    <div class="max-w-6xl mx-auto px-6">
      ${content.headline ? `<h2 class="text-3xl md:text-4xl font-bold mb-12 ${alignClass}">${escapeHtml(content.headline)}</h2>` : ''}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        ${(content.items || []).map(item => `
        <div class="p-6 rounded-xl bg-card shadow-sm border border-border/50">
          <p class="text-muted-foreground mb-4 italic">"${escapeHtml(item.description)}"</p>
          <p class="font-semibold">${escapeHtml(item.title)}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>`

    case 'pricing':
      return `  <section class="${bgClass} ${spacingClass}">
    <div class="max-w-6xl mx-auto px-6">
      ${content.headline ? `<h2 class="text-3xl md:text-4xl font-bold mb-4 ${alignClass}">${escapeHtml(content.headline)}</h2>` : ''}
      ${content.subheadline ? `<p class="text-muted-foreground mb-12 ${alignClass}">${escapeHtml(content.subheadline)}</p>` : ''}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        ${(content.items || []).map((item, i) => `
        <div class="p-8 rounded-xl ${i === 1 ? 'bg-primary text-white scale-105 shadow-xl' : 'bg-card shadow-lg border border-border/50 '}">
          <h3 class="text-2xl font-bold mb-2">${escapeHtml(item.title)}</h3>
          <p class="${i === 1 ? 'text-white/80' : 'text-muted-foreground '} mb-6">${escapeHtml(item.description)}</p>
          <a href="${escapeHtml(item.link || '#')}" class="${i === 1 ? 'btn-secondary !border-white !text-white hover:!bg-card hover:!text-primary' : 'btn-primary'} block text-center">Get Started</a>
        </div>`).join('')}
      </div>
    </div>
  </section>`

    case 'cta':
      return `  <section class="${bgClass} ${spacingClass}">
    <div class="max-w-4xl mx-auto px-6 text-center">
      ${content.headline ? `<h2 class="text-3xl md:text-4xl font-bold mb-4">${escapeHtml(content.headline)}</h2>` : ''}
      ${content.subheadline ? `<p class="text-lg md:text-xl text-muted-foreground mb-8">${escapeHtml(content.subheadline)}</p>` : ''}
      ${content.cta ? `<a href="${escapeHtml(content.cta.link)}" class="btn-primary inline-block">${escapeHtml(content.cta.text)}</a>` : ''}
    </div>
  </section>`

    case 'faq':
      return `  <section class="${bgClass} ${spacingClass}">
    <div class="max-w-3xl mx-auto px-6">
      ${content.headline ? `<h2 class="text-3xl md:text-4xl font-bold mb-12 ${alignClass}">${escapeHtml(content.headline)}</h2>` : ''}
      <div class="space-y-4">
        ${(content.items || []).map(item => `
        <details class="p-4 rounded-lg bg-card shadow-sm border border-border/50 group">
          <summary class="font-semibold cursor-pointer list-none flex justify-between items-center">
            ${escapeHtml(item.title)}
            <svg class="w-5 h-5 transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </summary>
          <p class="mt-4 text-muted-foreground">${escapeHtml(item.description)}</p>
        </details>`).join('')}
      </div>
    </div>
  </section>`

    case 'stats':
      return `  <section class="${bgClass} ${spacingClass}">
    <div class="max-w-6xl mx-auto px-6">
      ${content.headline ? `<h2 class="text-3xl md:text-4xl font-bold mb-12 ${alignClass}">${escapeHtml(content.headline)}</h2>` : ''}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        ${(content.items || []).map(item => `
        <div>
          <p class="text-4xl md:text-5xl font-bold mb-2 text-primary">${escapeHtml(item.title)}</p>
          <p class="text-muted-foreground">${escapeHtml(item.description)}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>`

    case 'logos':
      return `  <section class="${bgClass} ${spacingClass}">
    <div class="max-w-6xl mx-auto px-6">
      ${content.headline ? `<p class="text-sm text-muted-foreground mb-8 ${alignClass} uppercase tracking-wider">${escapeHtml(content.headline)}</p>` : ''}
      <div class="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-60">
        ${(content.items || []).map(item => `
        <div class="text-xl md:text-2xl font-bold text-gray-400">${escapeHtml(item.title)}</div>`).join('')}
      </div>
    </div>
  </section>`

    default:
      return `  <section class="${bgClass} ${spacingClass}">
    <div class="max-w-6xl mx-auto px-6 ${alignClass}">
      ${content.headline ? `<h2 class="text-3xl md:text-4xl font-bold mb-4">${escapeHtml(content.headline)}</h2>` : ''}
      ${content.description ? `<p class="text-muted-foreground">${escapeHtml(content.description)}</p>` : ''}
    </div>
  </section>`
  }
}

// Helper functions
function getBackgroundClass(background: string): string {
  switch (background) {
    case 'dark': return 'bg-gray-900 text-white'
    case 'light': return 'bg-muted/50'
    case 'gradient': return 'bg-gradient-to-br from-primary/5 to-secondary/5'
    default: return 'bg-card'
  }
}

function getSpacingClass(spacing: string): string {
  switch (spacing) {
    case 'compact': return 'py-12 md:py-16'
    case 'spacious': return 'py-20 md:py-32'
    default: return 'py-16 md:py-24'
  }
}

function getAlignmentClass(alignment: string): string {
  switch (alignment) {
    case 'left': return 'text-left'
    case 'right': return 'text-right'
    default: return 'text-center'
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function minifyHtml(html: string): string {
  return html
    .replace(/\n\s*/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
