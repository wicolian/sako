'use client'

/**
 * Email Editor
 *
 * Canvas editor wrapper with email-specific features:
 * - 600px width constraint
 * - Email-safe HTML warnings
 * - Subject line and preheader fields
 */

import { useState } from 'react'
import { CanvasEditor, type ExportFormat } from './canvas-editor'
import type { AssetDocument, ContentBlock } from '@/lib/assets/asset-document'
import type { BrandMemoryTokens } from '@/lib/templates/brand-assembler'

interface EmailEditorProps {
  assetDocument: AssetDocument
  brandMemory?: BrandMemoryTokens
  onSave: (html: string, blocks: ContentBlock[]) => void
  onExport?: (format: ExportFormat) => void
}

export function EmailEditor({ assetDocument, brandMemory, onSave, onExport }: EmailEditorProps) {
  const [subject, setSubject] = useState(assetDocument.title ?? '')
  const [preheader, setPreheader] = useState(assetDocument.description ?? '')

  // Check for email-unsafe patterns
  const warnings: string[] = []
  if (assetDocument.html.includes('display: flex') || assetDocument.html.includes('display:flex')) {
    warnings.push('Flexbox detected — may not render in all email clients')
  }
  if (assetDocument.html.includes('display: grid') || assetDocument.html.includes('display:grid')) {
    warnings.push('CSS Grid detected — not supported in most email clients')
  }
  if (assetDocument.html.includes('position: absolute') || assetDocument.html.includes('position:absolute')) {
    warnings.push('Absolute positioning — may break in email clients')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Email metadata bar */}
      <div className="px-4 py-3 bg-card/40 backdrop-blur-sm border-b border-border/50 space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground w-16">Subject:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 bg-muted/50 text-foreground text-sm px-3 py-1.5 rounded border border-border/50 focus:outline-none focus:border-blue-500"
            placeholder="Email subject line"
          />
          <span className="text-xs text-muted-foreground">{subject.length}/50</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground w-16">Preview:</label>
          <input
            type="text"
            value={preheader}
            onChange={(e) => setPreheader(e.target.value)}
            className="flex-1 bg-muted/50 text-foreground text-sm px-3 py-1.5 rounded border border-border/50 focus:outline-none focus:border-blue-500"
            placeholder="Preheader text"
          />
        </div>

        {/* Email safety warnings */}
        {warnings.length > 0 && (
          <div className="flex items-start gap-2 p-2 bg-amber-900/20 border border-amber-800/30 rounded">
            <span className="text-amber-500 text-xs">⚠</span>
            <div className="text-xs text-amber-400 space-y-0.5">
              {warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          600px width · Table-based layout recommended for email clients
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
