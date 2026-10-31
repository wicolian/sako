'use client'

import { useCallback, useEffect, useRef } from 'react'

import { exportToHtml } from '@/lib/export/html-exporter'
import { cn } from '@/lib/utils'
import type { WebsiteDesign } from '@/lib/website/ai-designer'

import type { ViewportSize } from './editor-shell'
import { OpenUiPreviewMode } from './openui-preview-mode'

interface PreviewModeProps {
  design: WebsiteDesign
  viewport: ViewportSize
  previewEngine?: 'html' | 'openui'
}

const VIEWPORT_WIDTHS: Record<ViewportSize, string> = {
  desktop: 'w-full',
  tablet: 'max-w-[768px]',
  mobile: 'max-w-[375px]',
}

export function PreviewMode({ design, viewport, previewEngine = 'html' }: PreviewModeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const generateHtml = useCallback(() => exportToHtml(design), [design])

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = generateHtml()
    }
  }, [generateHtml])

  if (previewEngine === 'openui') {
    return <OpenUiPreviewMode design={design} viewport={viewport} />
  }

  return (
    <div className="flex h-full items-start justify-center overflow-auto bg-muted/50 p-4">
      <div
        className={cn(
          'h-full overflow-hidden rounded-lg bg-background shadow-2xl transition-all duration-300',
          VIEWPORT_WIDTHS[viewport],
        )}
      >
        <iframe
          ref={iframeRef}
          className="h-full w-full border-0"
          title="Preview"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  )
}
