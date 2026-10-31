'use client'

/**
 * Slide/Deck Editor
 *
 * Canvas editor wrapper with deck-specific features:
 * - Slide navigation (prev/next/thumbnails)
 * - Speaker notes panel
 * - 16:9 canvas (1920x1080)
 */

import { useState, useCallback } from 'react'
import { CanvasEditor, type ExportFormat } from './canvas-editor'
import type { AssetDocument, ContentBlock } from '@/lib/assets/asset-document'
import type { BrandMemoryTokens } from '@/lib/templates/brand-assembler'

interface SlideEditorProps {
  assetDocument: AssetDocument
  brandMemory?: BrandMemoryTokens
  onSave: (html: string, blocks: ContentBlock[]) => void
  onExport?: (format: ExportFormat) => void
}

export function SlideEditor({ assetDocument, brandMemory, onSave, onExport }: SlideEditorProps) {
  const slides = assetDocument.blocks
  const [currentSlide, setCurrentSlide] = useState(0)

  const handlePrev = useCallback(() => {
    setCurrentSlide((s) => Math.max(0, s - 1))
  }, [])

  const handleNext = useCallback(() => {
    setCurrentSlide((s) => Math.min(slides.length - 1, s + 1))
  }, [slides.length])

  // Create a single-slide AssetDocument for the current slide
  const currentSlideDoc: AssetDocument = {
    ...assetDocument,
    html: slides[currentSlide]?.content ?? assetDocument.html,
    blocks: slides[currentSlide] ? [slides[currentSlide]] : [],
  }

  return (
    <div className="flex flex-col h-full">
      {/* Slide navigation bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-card/40 backdrop-blur-sm border-b border-border/50">
        <button
          onClick={handlePrev}
          disabled={currentSlide === 0}
          className="px-2 py-1 text-xs bg-muted/50 text-muted-foreground rounded hover:text-white disabled:opacity-30"
        >
          ← Prev
        </button>

        <span className="text-xs text-foreground/90 font-medium">
          Slide {currentSlide + 1} of {slides.length}
        </span>

        <button
          onClick={handleNext}
          disabled={currentSlide >= slides.length - 1}
          className="px-2 py-1 text-xs bg-muted/50 text-muted-foreground rounded hover:text-white disabled:opacity-30"
        >
          Next →
        </button>

        {/* Slide thumbnails */}
        <div className="ml-4 flex gap-1 overflow-x-auto">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`w-8 h-5 rounded text-[9px] flex items-center justify-center transition-colors ${
                i === currentSlide
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="ml-auto text-xs text-muted-foreground">
          16:9 · 1920×1080
        </div>
      </div>

      {/* Canvas editor */}
      <div className="flex-1">
        <CanvasEditor
          assetDocument={currentSlideDoc}
          brandMemory={brandMemory}
          onSave={onSave}
          onExport={onExport}
        />
      </div>
    </div>
  )
}
