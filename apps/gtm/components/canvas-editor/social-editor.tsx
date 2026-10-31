'use client'

/**
 * Social Post Editor
 *
 * Canvas editor wrapper with social-specific features:
 * - Platform dimension presets
 * - Character count
 * - Hashtag suggestions
 */

import { useState } from 'react'
import { CanvasEditor, type ExportFormat } from './canvas-editor'
import type { AssetDocument, ContentBlock } from '@/lib/assets/asset-document'
import type { BrandMemoryTokens } from '@/lib/templates/brand-assembler'
import { DIMENSION_PRESETS } from '@/lib/editor/dimension-presets'

interface SocialEditorProps {
  assetDocument: AssetDocument
  brandMemory?: BrandMemoryTokens
  onSave: (html: string, blocks: ContentBlock[]) => void
  onExport?: (format: ExportFormat) => void
}

export function SocialEditor({ assetDocument, brandMemory, onSave, onExport }: SocialEditorProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>(
    assetDocument.channel ?? 'linkedin'
  )

  const platforms = Object.entries(DIMENSION_PRESETS.social)

  // Extract text content for character count
  const textContent = assetDocument.blocks
    .filter((b) => b.type === 'body' || b.type === 'headline')
    .map((b) => b.content)
    .join(' ')
    .replace(/<[^>]+>/g, '')

  const charLimits: Record<string, number> = {
    linkedin: 3000,
    twitter: 280,
    instagram: 2200,
    facebook: 63206,
    tiktok: 2200,
  }

  return (
    <div className="flex flex-col h-full">
      {/* Platform selector bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-card/40 backdrop-blur-sm border-b border-border/50">
        <span className="text-xs text-muted-foreground mr-2">Platform:</span>
        {platforms.map(([key, preset]) => (
          <button
            key={key}
            onClick={() => setSelectedPlatform(key)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              selectedPlatform === key
                ? 'bg-blue-600 text-white'
                : 'bg-muted/50 text-muted-foreground hover:text-white'
            }`}
          >
            {preset.label.split(' ')[0]}
          </button>
        ))}

        {/* Character count */}
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`text-xs ${
              textContent.length > (charLimits[selectedPlatform] ?? 3000)
                ? 'text-red-400'
                : 'text-muted-foreground'
            }`}
          >
            {textContent.length} / {charLimits[selectedPlatform] ?? 3000}
          </span>
        </div>
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
