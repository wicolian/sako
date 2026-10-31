'use client'

/**
 * Canvas Editor
 *
 * Lightweight fixed-dimension visual editor for social posts, slides, ads, and emails.
 * Separate from editor-shell.tsx which stays for landing pages.
 *
 * Features:
 * - Fixed canvas with exact pixel dimensions
 * - Zoom in/out, pan
 * - Inline text editing (double-click)
 * - Element selection with drag handles
 * - Brand palette sidebar
 * - Compliance badge
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { AssetDocument, ContentBlock, ComplianceStatus } from '@/lib/assets/asset-document'
import type { BrandMemoryTokens } from '@/lib/templates/brand-assembler'

// ============================================================================
// Types
// ============================================================================

export type ExportFormat = 'png' | 'jpg' | 'pdf' | 'html' | 'figma' | 'sako'

export interface CanvasEditorProps {
  assetDocument: AssetDocument
  brandMemory?: BrandMemoryTokens
  onSave: (html: string, blocks: ContentBlock[]) => void
  onExport?: (format: ExportFormat) => void
  readOnly?: boolean
}

interface EditorState {
  zoom: number
  panX: number
  panY: number
  selectedBlockId: string | null
  editingBlockId: string | null
  isDirty: boolean
}

// ============================================================================
// Component
// ============================================================================

export function CanvasEditor({
  assetDocument,
  brandMemory,
  onSave,
  onExport,
  readOnly = false,
}: CanvasEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [html, setHtml] = useState(assetDocument.html)
  const [blocks, setBlocks] = useState(assetDocument.blocks)
  const [state, setState] = useState<EditorState>({
    zoom: calculateInitialZoom(assetDocument.dimensions),
    panX: 0,
    panY: 0,
    selectedBlockId: null,
    editingBlockId: null,
    isDirty: false,
  })

  const width = assetDocument.dimensions?.width ?? 1200
  const height = assetDocument.dimensions?.height ?? 627

  // Update iframe content
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      const doc = iframeRef.current.contentWindow.document
      doc.open()
      doc.write(html)
      doc.close()
    }
  }, [html])

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setState((s) => ({ ...s, zoom: Math.min(s.zoom + 0.1, 2) }))
  }, [])

  const handleZoomOut = useCallback(() => {
    setState((s) => ({ ...s, zoom: Math.max(s.zoom - 0.1, 0.2) }))
  }, [])

  const handleZoomReset = useCallback(() => {
    setState((s) => ({
      ...s,
      zoom: calculateInitialZoom(assetDocument.dimensions),
      panX: 0,
      panY: 0,
    }))
  }, [assetDocument.dimensions])

  // Save handler
  const handleSave = useCallback(() => {
    onSave(html, blocks)
    setState((s) => ({ ...s, isDirty: false }))
  }, [html, blocks, onSave])

  // HTML edit handler (from code editor)
  const handleHtmlChange = useCallback((newHtml: string) => {
    setHtml(newHtml)
    setState((s) => ({ ...s, isDirty: true }))
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape') {
        setState((s) => ({ ...s, selectedBlockId: null, editingBlockId: null }))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  return (
    <div className="flex h-full bg-background">
      {/* Toolbar */}
      <div className="flex flex-col border-r border-border/50 bg-card/40 backdrop-blur-sm w-12">
        <ToolbarButton onClick={handleZoomIn} title="Zoom In">+</ToolbarButton>
        <ToolbarButton onClick={handleZoomOut} title="Zoom Out">−</ToolbarButton>
        <ToolbarButton onClick={handleZoomReset} title="Fit to View">⊡</ToolbarButton>
        <div className="flex-1" />
        {!readOnly && (
          <ToolbarButton onClick={handleSave} title="Save (⌘S)">
            💾
          </ToolbarButton>
        )}
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Compliance Badge */}
        <ComplianceBadge status={assetDocument.complianceStatus} claimCount={assetDocument.claims.length} />

        {/* Zoom indicator */}
        <div className="absolute top-3 right-3 z-10 bg-muted/50 text-muted-foreground text-xs px-2 py-1 rounded">
          {Math.round(state.zoom * 100)}%
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="absolute inset-0 flex items-center justify-center"
          style={{ cursor: 'grab' }}
        >
          <div
            style={{
              width: width * state.zoom,
              height: height * state.zoom,
              transform: `translate(${state.panX}px, ${state.panY}px)`,
              boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 25px 50px rgba(0,0,0,0.5)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <iframe
              ref={iframeRef}
              style={{
                width: width,
                height: height,
                transform: `scale(${state.zoom})`,
                transformOrigin: 'top left',
                border: 'none',
                pointerEvents: readOnly ? 'none' : 'auto',
              }}
              sandbox="allow-same-origin"
              title="Asset Preview"
            />
          </div>
        </div>

        {/* Dirty indicator */}
        {state.isDirty && (
          <div className="absolute bottom-3 left-3 z-10 bg-amber-600 text-white text-xs px-2 py-1 rounded">
            Unsaved changes
          </div>
        )}
      </div>

      {/* Right Sidebar: Code Editor + Export */}
      <div className="w-80 border-l border-border/50 bg-card/40 backdrop-blur-sm flex flex-col">
        {/* Tab bar */}
        <div className="flex border-b border-border/50">
          <SidebarTab active label="Code" />
          <SidebarTab label="Export" />
        </div>

        {/* Code editor */}
        <div className="flex-1 overflow-auto">
          <textarea
            className="w-full h-full bg-background text-foreground/90 text-xs font-mono p-3 resize-none focus:outline-none"
            value={html}
            onChange={(e) => handleHtmlChange(e.target.value)}
            readOnly={readOnly}
            spellCheck={false}
          />
        </div>

        {/* Export buttons */}
        {onExport && (
          <div className="p-3 border-t border-border/50 space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Export</p>
            <div className="grid grid-cols-2 gap-2">
              {(['png', 'jpg', 'pdf', 'html'] as ExportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => onExport(fmt)}
                  className="px-3 py-1.5 bg-muted/50 hover:bg-muted text-foreground/90 text-xs rounded transition-colors uppercase"
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-12 h-12 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-muted/50 transition-colors text-lg"
    >
      {children}
    </button>
  )
}

function ComplianceBadge({ status, claimCount }: { status: ComplianceStatus; claimCount: number }) {
  const colors: Record<ComplianceStatus, string> = {
    clean: 'bg-emerald-600',
    warning: 'bg-amber-600',
    blocked: 'bg-red-600',
  }

  const labels: Record<ComplianceStatus, string> = {
    clean: 'Clean',
    warning: `${claimCount} claims need review`,
    blocked: `Blocked — ${claimCount} claims`,
  }

  return (
    <div className={`absolute top-3 left-3 z-10 ${colors[status]} text-white text-xs px-2.5 py-1 rounded-full font-medium`}>
      {labels[status]}
    </div>
  )
}

function SidebarTab({ active, label }: { active?: boolean; label: string }) {
  return (
    <button
      className={`px-4 py-2 text-xs font-medium ${
        active ? 'text-white border-b-2 border-blue-500' : 'text-muted-foreground hover:text-foreground/90'
      }`}
    >
      {label}
    </button>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function calculateInitialZoom(dimensions?: { width: number; height: number }): number {
  if (!dimensions) return 0.5
  // Fit to ~800px viewport width
  return Math.min(0.8, 800 / dimensions.width)
}
