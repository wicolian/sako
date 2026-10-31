'use client'

/**
 * Asset Editor Client Component
 *
 * Routes to the correct editor based on asset type.
 */

import { useCallback } from 'react'
import type { AssetDocument, ContentBlock } from '@/lib/assets/asset-document'
import type { BrandMemoryTokens } from '@/lib/templates/brand-assembler'
import { CanvasEditor, type ExportFormat } from '@/components/canvas-editor/canvas-editor'
import { SocialEditor } from '@/components/canvas-editor/social-editor'
import { SlideEditor } from '@/components/canvas-editor/slide-editor'
import { EmailEditor } from '@/components/canvas-editor/email-editor'
import { AdEditor } from '@/components/canvas-editor/ad-editor'

interface Props {
  assetDocument: AssetDocument
  brandMemory: BrandMemoryTokens | null
  assetType: string
}

export function AssetEditorClient({ assetDocument, brandMemory, assetType }: Props) {
  const handleSave = useCallback(
    async (html: string, blocks: ContentBlock[]) => {
      await fetch(`/api/assets/${assetDocument.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, blocks }),
      })
    },
    [assetDocument.id]
  )

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (format === 'figma') {
        // Copy to Figma clipboard
        const res = await fetch('/api/export/figma', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: assetDocument.html, dimensions: assetDocument.dimensions }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.clipboardData) {
            await navigator.clipboard.writeText(JSON.stringify(data.clipboardData))
          }
        }
        return
      }

      if (format === 'sako') {
        await fetch(`/api/composer/documents/${assetDocument.id}/send-to-sako`, {
          method: 'POST',
        })
        return
      }

      // Download render
      const res = await fetch(`/api/assets/${assetDocument.id}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${assetDocument.title ?? 'asset'}.${format}`
        a.click()
        URL.revokeObjectURL(url)
      }
    },
    [assetDocument]
  )

  const editorProps = {
    assetDocument,
    brandMemory: brandMemory ?? undefined,
    onSave: handleSave,
    onExport: handleExport,
  }

  switch (assetType) {
    case 'social':
      return <SocialEditor {...editorProps} />
    case 'deck':
      return <SlideEditor {...editorProps} />
    case 'email':
      return <EmailEditor {...editorProps} />
    case 'ad':
      return <AdEditor {...editorProps} />
    default:
      return <CanvasEditor {...editorProps} />
  }
}
