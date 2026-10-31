'use client'

/**
 * Export Panel
 *
 * Unified export interface for all asset types.
 * - Download as PNG/JPG/PDF/HTML
 * - Copy to Figma (via existing figma-exporter)
 * - Send to Sako (gated to Sako subscription users)
 */

import { useState } from 'react'
import type { AssetDocument } from '@/lib/assets/asset-document'

type ExportFormat = 'png' | 'jpg' | 'pdf' | 'html' | 'figma' | 'sako'

interface ExportPanelProps {
  assetDocument: AssetDocument
  isSakoSubscriber?: boolean
  onExport: (format: ExportFormat) => Promise<void>
}

export function ExportPanel({ assetDocument, isSakoSubscriber = false, onExport }: ExportPanelProps) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isBlocked = assetDocument.complianceStatus === 'blocked'
  const blockedClaims = assetDocument.claims.filter(
    (c) => c.riskScore >= 70 && c.status !== 'verified' && c.status !== 'overridden'
  )

  const handleExport = async (format: ExportFormat) => {
    if (isBlocked) return
    setExporting(format)
    setError(null)
    try {
      await onExport(format)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Export Asset</h3>

      {/* Compliance gate */}
      {isBlocked && (
        <div className="p-3 bg-red-900/20 border border-red-800/30 rounded-lg">
          <p className="text-xs text-red-400 font-medium mb-1">
            Export blocked — {blockedClaims.length} unresolved high-risk claim{blockedClaims.length > 1 ? 's' : ''}
          </p>
          <ul className="text-xs text-red-400/70 space-y-1">
            {blockedClaims.slice(0, 3).map((claim) => (
              <li key={claim.id} className="truncate">
                &bull; {claim.text}
              </li>
            ))}
          </ul>
          <p className="text-xs text-red-400/60 mt-2">
            Fix claims, link evidence, or accept rewrites before exporting.
          </p>
        </div>
      )}

      {/* Download formats */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">Download</p>
        <div className="grid grid-cols-2 gap-2">
          {(['png', 'jpg', 'pdf', 'html'] as ExportFormat[]).map((format) => (
            <button
              key={format}
              onClick={() => handleExport(format)}
              disabled={isBlocked || exporting !== null}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isBlocked
                  ? 'bg-muted/50 text-muted-foreground/80 cursor-not-allowed'
                  : 'bg-muted/50 text-foreground/90 hover:bg-muted hover:text-white'
              }`}
            >
              {exporting === format ? 'Exporting...' : format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Integrations */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">Integrations</p>
        <div className="space-y-2">
          <button
            onClick={() => handleExport('figma')}
            disabled={isBlocked || exporting !== null}
            className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left flex items-center gap-2 ${
              isBlocked
                ? 'bg-muted/50 text-muted-foreground/80 cursor-not-allowed'
                : 'bg-muted/50 text-foreground/90 hover:bg-muted hover:text-white'
            }`}
          >
            <span>Copy to Figma</span>
          </button>

          {isSakoSubscriber && (
            <button
              onClick={() => handleExport('sako')}
              disabled={isBlocked || exporting !== null}
              className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left flex items-center gap-2 ${
                isBlocked
                  ? 'bg-muted/50 text-muted-foreground/80 cursor-not-allowed'
                  : 'bg-purple-900/50 text-purple-300 hover:bg-purple-900/70 hover:text-purple-200 border border-purple-800/30'
              }`}
            >
              <span>Send to Sako</span>
              <span className="text-xs text-purple-500">Pro</span>
            </button>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-2 bg-red-900/20 border border-red-800/30 rounded text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
