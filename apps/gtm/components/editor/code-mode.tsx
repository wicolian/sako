'use client'

import { useState, useCallback, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Copy, Check, RefreshCw } from 'lucide-react'
import type { WebsiteDesign, WebsiteSection } from '@/lib/website/ai-designer'

interface CodeModeProps {
  design: WebsiteDesign
  onUpdateDesign: (updates: Partial<WebsiteDesign>) => void
}

type CodeTab = 'html' | 'css' | 'json'

export function CodeMode({ design, onUpdateDesign }: CodeModeProps) {
  const [activeTab, setActiveTab] = useState<CodeTab>('html')
  const [copied, setCopied] = useState(false)

  // Generate HTML code
  const htmlCode = useMemo(() => {
    return generateFullHtml(design)
  }, [design])

  // Generate CSS code
  const cssCode = useMemo(() => {
    return generateCss(design.globalStyles)
  }, [design.globalStyles])

  // JSON representation
  const jsonCode = useMemo(() => {
    return JSON.stringify(design, null, 2)
  }, [design])

  const currentCode = activeTab === 'html' ? htmlCode : activeTab === 'css' ? cssCode : jsonCode

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(currentCode)
    setCopied(true)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }, [currentCode])

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!value) return

    if (activeTab === 'json') {
      try {
        const parsed = JSON.parse(value)
        onUpdateDesign(parsed)
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [activeTab, onUpdateDesign])

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CodeTab)}>
          <TabsList className="bg-transparent">
            <TabsTrigger value="html" className="text-xs data-[state=active]:bg-[#1e1e1e]">
              HTML
            </TabsTrigger>
            <TabsTrigger value="css" className="text-xs data-[state=active]:bg-[#1e1e1e]">
              CSS
            </TabsTrigger>
            <TabsTrigger value="json" className="text-xs data-[state=active]:bg-[#1e1e1e]">
              JSON
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-white"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1.5" />
            )}
            Copy
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={activeTab === 'json' ? 'json' : activeTab === 'css' ? 'css' : 'html'}
          value={currentCode}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            readOnly: activeTab !== 'json',
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 16 },
          }}
        />
      </div>
    </div>
  )
}

function generateFullHtml(design: WebsiteDesign): string {
  const { globalStyles, sections, seoMeta } = design

  const sectionsHtml = [...sections]
    .sort((a, b) => a.order - b.order)
    .map(section => generateSectionHtml(section, globalStyles))
    .join('\n\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${seoMeta.title || design.name}</title>
  <meta name="description" content="${seoMeta.description || ''}">
  ${seoMeta.keywords?.length ? `<meta name="keywords" content="${seoMeta.keywords.join(', ')}">` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${globalStyles.fontHeading.replace(' ', '+')}:wght@400;500;600;700&family=${globalStyles.fontBody.replace(' ', '+')}:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
${generateCss(globalStyles)}
  </style>
</head>
<body>
${sectionsHtml}
</body>
</html>`
}

function generateCss(globalStyles: WebsiteDesign['globalStyles']): string {
  const borderRadius = globalStyles.borderRadius === 'none' ? '0' 
    : globalStyles.borderRadius === 'small' ? '0.25rem'
    : globalStyles.borderRadius === 'medium' ? '0.5rem'
    : globalStyles.borderRadius === 'large' ? '0.75rem' : '9999px'

  return `    :root {
      --color-primary: ${globalStyles.primaryColor};
      --color-secondary: ${globalStyles.secondaryColor || globalStyles.primaryColor};
      --color-accent: ${globalStyles.accentColor || '#f59e0b'};
      --font-heading: '${globalStyles.fontHeading}', system-ui, sans-serif;
      --font-body: '${globalStyles.fontBody}', system-ui, sans-serif;
      --radius: ${borderRadius};
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: var(--font-body);
      line-height: 1.6;
      ${globalStyles.colorScheme === 'dark' ? `
      background-color: #0a0a0a;
      color: #fafafa;
      ` : `
      background-color: #ffffff;
      color: #0a0a0a;
      `}
    }
    
    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-heading);
      line-height: 1.2;
    }
    
    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.5rem;
      background-color: var(--color-primary);
      color: white;
      font-weight: 500;
      border-radius: var(--radius);
      border: none;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.2s;
    }
    
    .btn-primary:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }
    
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.5rem;
      background-color: transparent;
      color: var(--color-primary);
      font-weight: 500;
      border-radius: var(--radius);
      border: 1px solid var(--color-primary);
      cursor: pointer;
      transition: background-color 0.2s, color 0.2s;
    }
    
    .btn-secondary:hover {
      background-color: var(--color-primary);
      color: white;
    }`
}

function generateSectionHtml(section: WebsiteSection, globalStyles: WebsiteDesign['globalStyles']): string {
  const { type, content, styles } = section

  const bgClass = styles.background === 'dark' 
    ? 'bg-card/40 backdrop-blur-sm text-white' 
    : styles.background === 'light' 
    ? 'bg-muted/10' 
    : styles.background === 'gradient'
    ? 'bg-gradient-to-br from-indigo-50 to-purple-50'
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
      return `  <section class="${bgClass} ${spacingClass}">
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
      return `  <section class="${bgClass} ${spacingClass}">
    <div class="max-w-6xl mx-auto px-6">
      ${content.headline ? `<h2 class="text-3xl font-bold mb-4 ${alignClass}">${content.headline}</h2>` : ''}
      ${content.subheadline ? `<p class="text-muted-foreground mb-12 ${alignClass}">${content.subheadline}</p>` : ''}
      <div class="grid grid-cols-1 md:grid-cols-${styles.columns || 3} gap-8">
        ${(content.items || []).map(item => `
        <div class="p-6 rounded-xl bg-card shadow-sm border">
          ${item.icon ? `<div class="text-4xl mb-4">${item.icon}</div>` : ''}
          <h3 class="text-xl font-semibold mb-2">${item.title}</h3>
          <p class="text-muted-foreground">${item.description}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>`

    case 'cta':
      return `  <section class="${bgClass} ${spacingClass}">
    <div class="max-w-4xl mx-auto px-6 text-center">
      ${content.headline ? `<h2 class="text-3xl font-bold mb-4">${content.headline}</h2>` : ''}
      ${content.subheadline ? `<p class="text-xl text-muted-foreground mb-8">${content.subheadline}</p>` : ''}
      ${content.cta ? `<a href="${content.cta.link}" class="btn-primary">${content.cta.text}</a>` : ''}
    </div>
  </section>`

    default:
      return `  <section class="${bgClass} ${spacingClass}">
    <div class="max-w-6xl mx-auto px-6 ${alignClass}">
      ${content.headline ? `<h2 class="text-3xl font-bold mb-4">${content.headline}</h2>` : ''}
      ${content.description ? `<p class="text-muted-foreground">${content.description}</p>` : ''}
    </div>
  </section>`
  }
}
