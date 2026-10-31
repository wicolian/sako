'use client'

import { useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { WebsiteDesign } from '@/lib/website/ai-designer'
import type { ViewportSize } from './editor-shell'

interface PreviewModeProps {
  design: WebsiteDesign
  viewport: ViewportSize
}

const VIEWPORT_WIDTHS: Record<ViewportSize, string> = {
  desktop: 'w-full',
  tablet: 'max-w-[768px]',
  mobile: 'max-w-[375px]',
}

export function PreviewMode({ design, viewport }: PreviewModeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const generateHtml = useCallback(() => {
    const { globalStyles, sections, seoMeta } = design

    // Generate CSS from global styles
    const cssVars = `
      :root {
        --primary: ${globalStyles.primaryColor};
        --secondary: ${globalStyles.secondaryColor || globalStyles.primaryColor};
        --accent: ${globalStyles.accentColor || '#f59e0b'};
        --font-heading: ${globalStyles.fontHeading}, system-ui, sans-serif;
        --font-body: ${globalStyles.fontBody}, system-ui, sans-serif;
        --radius: ${globalStyles.borderRadius === 'none' ? '0' : 
          globalStyles.borderRadius === 'small' ? '0.25rem' :
          globalStyles.borderRadius === 'medium' ? '0.5rem' :
          globalStyles.borderRadius === 'large' ? '0.75rem' : '9999px'};
      }
    `

    // Generate HTML for each section
    const sectionsHtml = sections
      .sort((a, b) => a.order - b.order)
      .map(section => generateSectionHtml(section))
      .join('\n')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${seoMeta.title || design.name}</title>
  <meta name="description" content="${seoMeta.description || ''}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    ${cssVars}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: var(--font-body); 
      ${globalStyles.colorScheme === 'dark' ? 'background: #0a0a0a; color: #fafafa;' : 'background: #ffffff; color: #0a0a0a;'}
    }
    h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }
    .btn-primary {
      background: var(--primary);
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius);
      font-weight: 500;
      transition: opacity 0.2s;
    }
    .btn-primary:hover { opacity: 0.9; }
    .btn-secondary {
      background: transparent;
      border: 1px solid var(--primary);
      color: var(--primary);
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius);
      font-weight: 500;
      transition: background 0.2s;
    }
    .btn-secondary:hover { background: var(--primary); color: white; }
  </style>
</head>
<body>
${sectionsHtml}
</body>
</html>`
  }, [design])

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = generateHtml()
    }
  }, [generateHtml])

  return (
    <div className="h-full flex items-start justify-center overflow-auto p-4 bg-muted/50">
      <div className={cn(
        'h-full transition-all duration-300 bg-background shadow-2xl rounded-lg overflow-hidden',
        VIEWPORT_WIDTHS[viewport]
      )}>
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          title="Preview"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  )
}

function generateSectionHtml(section: import('@/lib/website/ai-designer').WebsiteSection): string {
  const { type, content, styles } = section
  
  const bgClass = styles.background === 'dark' 
    ? 'bg-card/40 backdrop-blur-sm text-white' 
    : styles.background === 'light' 
    ? 'bg-muted/10' 
    : styles.background === 'gradient'
    ? 'bg-gradient-to-br from-primary/10 to-secondary/10'
    : 'bg-card'

  const spacingClass = styles.spacing === 'compact' 
    ? 'py-12' 
    : styles.spacing === 'spacious' 
    ? 'py-24' 
    : 'py-16'

  const alignClass = styles.alignment === 'left' 
    ? 'text-left' 
    : styles.alignment === 'right' 
    ? 'text-right' 
    : 'text-center'

  switch (type) {
    case 'hero':
      return `
<section class="${bgClass} ${spacingClass}">
  <div class="max-w-6xl mx-auto px-6 ${alignClass}">
    ${content.headline ? `<h1 class="text-5xl font-bold mb-6 leading-tight">${content.headline}</h1>` : ''}
    ${content.subheadline ? `<p class="text-xl text-muted-foreground mb-8 max-w-2xl ${styles.alignment === 'center' ? 'mx-auto' : ''}">${content.subheadline}</p>` : ''}
    <div class="flex gap-4 ${styles.alignment === 'center' ? 'justify-center' : ''}">
      ${content.cta ? `<a href="${content.cta.link}" class="btn-primary">${content.cta.text}</a>` : ''}
      ${content.secondaryCta ? `<a href="${content.secondaryCta.link}" class="btn-secondary">${content.secondaryCta.text}</a>` : ''}
    </div>
  </div>
</section>`

    case 'features':
      const cols = styles.columns || 3
      return `
<section class="${bgClass} ${spacingClass}">
  <div class="max-w-6xl mx-auto px-6">
    ${content.headline ? `<h2 class="text-3xl font-bold mb-4 ${alignClass}">${content.headline}</h2>` : ''}
    ${content.subheadline ? `<p class="text-muted-foreground mb-12 ${alignClass}">${content.subheadline}</p>` : ''}
    <div class="grid grid-cols-1 md:grid-cols-${cols} gap-8">
      ${(content.items || []).map(item => `
        <div class="p-6 rounded-xl bg-card shadow-sm">
          ${item.icon ? `<div class="text-4xl mb-4">${item.icon}</div>` : ''}
          <h3 class="text-xl font-semibold mb-2">${item.title}</h3>
          <p class="text-muted-foreground">${item.description}</p>
        </div>
      `).join('')}
    </div>
  </div>
</section>`

    case 'testimonials':
      return `
<section class="${bgClass} ${spacingClass}">
  <div class="max-w-6xl mx-auto px-6">
    ${content.headline ? `<h2 class="text-3xl font-bold mb-12 ${alignClass}">${content.headline}</h2>` : ''}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      ${(content.items || []).map(item => `
        <div class="p-6 rounded-xl bg-card shadow-sm">
          <p class="text-muted-foreground mb-4 italic">"${item.description}"</p>
          <p class="font-semibold">${item.title}</p>
        </div>
      `).join('')}
    </div>
  </div>
</section>`

    case 'cta':
      return `
<section class="${bgClass} ${spacingClass}">
  <div class="max-w-4xl mx-auto px-6 text-center">
    ${content.headline ? `<h2 class="text-3xl font-bold mb-4">${content.headline}</h2>` : ''}
    ${content.subheadline ? `<p class="text-xl text-muted-foreground mb-8">${content.subheadline}</p>` : ''}
    ${content.cta ? `<a href="${content.cta.link}" class="btn-primary inline-block">${content.cta.text}</a>` : ''}
  </div>
</section>`

    case 'pricing':
      return `
<section class="${bgClass} ${spacingClass}">
  <div class="max-w-6xl mx-auto px-6">
    ${content.headline ? `<h2 class="text-3xl font-bold mb-12 ${alignClass}">${content.headline}</h2>` : ''}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      ${(content.items || []).map((item, i) => `
        <div class="p-8 rounded-xl ${i === 1 ? 'bg-primary text-white scale-105' : 'bg-card '} shadow-lg">
          <h3 class="text-2xl font-bold mb-2">${item.title}</h3>
          <p class="${i === 1 ? 'text-white/80' : 'text-muted-foreground '} mb-6">${item.description}</p>
          <a href="${item.link || '#'}" class="${i === 1 ? 'btn-secondary !border-white !text-white hover:!bg-card hover:!text-primary' : 'btn-primary'} block text-center">Get Started</a>
        </div>
      `).join('')}
    </div>
  </div>
</section>`

    case 'faq':
      return `
<section class="${bgClass} ${spacingClass}">
  <div class="max-w-3xl mx-auto px-6">
    ${content.headline ? `<h2 class="text-3xl font-bold mb-12 ${alignClass}">${content.headline}</h2>` : ''}
    <div class="space-y-4">
      ${(content.items || []).map(item => `
        <details class="p-4 rounded-lg bg-card shadow-sm group">
          <summary class="font-semibold cursor-pointer list-none flex justify-between items-center">
            ${item.title}
            <span class="transform group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <p class="mt-4 text-muted-foreground">${item.description}</p>
        </details>
      `).join('')}
    </div>
  </div>
</section>`

    case 'stats':
      return `
<section class="${bgClass} ${spacingClass}">
  <div class="max-w-6xl mx-auto px-6">
    ${content.headline ? `<h2 class="text-3xl font-bold mb-12 ${alignClass}">${content.headline}</h2>` : ''}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
      ${(content.items || []).map(item => `
        <div>
          <p class="text-4xl font-bold text-primary mb-2">${item.title}</p>
          <p class="text-muted-foreground">${item.description}</p>
        </div>
      `).join('')}
    </div>
  </div>
</section>`

    case 'logos':
      return `
<section class="${bgClass} ${spacingClass}">
  <div class="max-w-6xl mx-auto px-6">
    ${content.headline ? `<p class="text-sm text-muted-foreground mb-8 ${alignClass} uppercase tracking-wider">${content.headline}</p>` : ''}
    <div class="flex flex-wrap justify-center items-center gap-12 opacity-60">
      ${(content.items || []).map(item => `
        <div class="text-2xl font-bold text-muted-foreground">${item.title}</div>
      `).join('')}
    </div>
  </div>
</section>`

    default:
      return `
<section class="${bgClass} ${spacingClass}">
  <div class="max-w-6xl mx-auto px-6 ${alignClass}">
    ${content.headline ? `<h2 class="text-3xl font-bold mb-4">${content.headline}</h2>` : ''}
    ${content.description ? `<p class="text-muted-foreground">${content.description}</p>` : ''}
  </div>
</section>`
  }
}
