'use client'

/**
 * Ad Editor
 *
 * Canvas editor wrapper with ad-specific features:
 * - Multi-dimension presets (Facebook Feed, Google Display, etc.)
 * - Copy length limits per format
 */

import { useState } from 'react'
import { CanvasEditor, type ExportFormat } from './canvas-editor'
import type { AssetDocument, ContentBlock } from '@/lib/assets/asset-document'
import type { BrandMemoryTokens } from '@/lib/templates/brand-assembler'
import { DIMENSION_PRESETS } from '@/lib/editor/dimension-presets'

interface AdEditorProps {
  assetDocument: AssetDocument
  brandMemory?: BrandMemoryTokens
  onSave: (html: string, blocks: ContentBlock[]) => void
  onExport?: (format: ExportFormat) => void
}

export function AdEditor({ assetDocument, brandMemory, onSave, onExport }: AdEditorProps) {
  const [selectedSize, setSelectedSize] = useState('facebook_feed')

  const adSizes = Object.entries(DIMENSION_PRESETS.ad)

  return (
    <div className="flex flex-col h-full">
      {/* Size selector bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-card/40 backdrop-blur-sm border-b border-border/50 overflow-x-auto">
        <span className="text-xs text-muted-foreground mr-1 shrink-0">Size:</span>
        {adSizes.map(([key, preset]) => (
          <button
            key={key}
            onClick={() => setSelectedSize(key)}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors whitespace-nowrap ${
              selectedSize === key
                ? 'bg-blue-600 text-white'
                : 'bg-muted/50 text-muted-foreground hover:text-white'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Canvas editor */}
      <div className="flex-1">
        <CanvasEditor
          assetDocument={assetDocument}
          brandMemory={brandMemory}
          onSave={onSave}
          onExport={onExport}
        />
      </div>
    </div>
  )
}
