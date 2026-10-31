'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  Sparkles,
  Loader2,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { WebsiteDesign } from '@/lib/website/ai-designer'

type ViewportSize = 'desktop' | 'tablet' | 'mobile'

type DesignDirection = 'auto' | 'bold' | 'minimal' | 'professional' | 'playful' | 'trust-first'

const DIRECTION_LABELS: Record<DesignDirection, string> = {
  auto: 'Auto (brand-matched)',
  bold: 'Bold & high contrast',
  minimal: 'Minimal & clean',
  professional: 'Professional & trusted',
  playful: 'Playful & energetic',
  'trust-first': 'Proof-heavy & trust-first',
}

const VIEWPORT_WIDTHS: Record<ViewportSize, string> = {
  desktop: 'w-full',
  tablet: 'max-w-[768px]',
  mobile: 'max-w-[375px]',
}

interface CampaignBuilderShellProps {
  /** Initial design including render_html and render_manifest. */
  design: WebsiteDesign
  /** Campaign ID, used to call the design API for regeneration. */
  campaignId: string
  /** Optional callback when the design is updated by a regeneration. */
  onDesignUpdate?: (design: WebsiteDesign) => void
  /** Tailwind height class for the root element. Defaults to h-screen. */
  className?: string
}

export function CampaignBuilderShell({
  design: initialDesign,
  campaignId,
  onDesignUpdate,
  className,
}: CampaignBuilderShellProps) {
  const [design, setDesign] = useState<WebsiteDesign>(initialDesign)
  const [viewport, setViewport] = useState<ViewportSize>('desktop')
  const [direction, setDirection] = useState<DesignDirection>('auto')
  const [isRegenerating, setIsRegenerating] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Keep iframe up to date when design changes
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    iframe.srcdoc = design.renderHtml || buildFallbackHtml(design)
  }, [design])

  const handleRegenerate = useCallback(
    async (nextDirection?: DesignDirection) => {
      const effectiveDirection = nextDirection ?? direction
      setIsRegenerating(true)
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/design`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ designDirection: effectiveDirection }),
        })

        if (!res.ok) {
          const body = (await res.json()) as { error?: string }
          throw new Error(body.error ?? 'Regeneration failed')
        }

        const data = (await res.json()) as { design: WebsiteDesign }
        setDesign(data.design)
        onDesignUpdate?.(data.design)
        toast.success('Landing page regenerated!')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Regeneration failed')
      } finally {
        setIsRegenerating(false)
      }
    },
    [campaignId, direction, onDesignUpdate],
  )

  const isLegacyBackfill = design.renderManifest?.isLegacyBackfill === true
  const hasCanonicalHtml = design.renderHtml && design.renderHtml.length > 0
  const claims = Array.isArray(design.renderManifest?.claims)
    ? (design.renderManifest.claims as string[])
    : []

  return (
    <TooltipProvider>
      <div className={cn('flex flex-col bg-background', className ?? 'h-screen')}>
        {/* ── Toolbar ─────────────────────────────────────────────── */}
        <div className="h-11 px-4 flex items-center gap-3 bg-card border-b shrink-0">
          {/* Left: campaign name + status badges */}
          <span className="text-sm font-medium truncate max-w-[220px] text-foreground">
            {design.name}
          </span>

          {design.editorMode === 'controlled' && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
              controlled
            </Badge>
          )}

          {isLegacyBackfill && !hasCanonicalHtml && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-amber-500 text-xs font-medium cursor-default">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Legacy preview
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                This page was built from legacy data. Regenerate to get the canonical high-fidelity version.
              </TooltipContent>
            </Tooltip>
          )}

          {hasCanonicalHtml && !isLegacyBackfill && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium cursor-default">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Canonical
                </span>
              </TooltipTrigger>
              <TooltipContent>Preview renders the exact generated output — identical to what will be exported and published.</TooltipContent>
            </Tooltip>
          )}

          {/* Center: viewport toggle */}
          <div className="ml-auto flex items-center bg-muted rounded-lg p-0.5">
            {(
              [
                { id: 'desktop', icon: Monitor, label: 'Desktop' },
                { id: 'tablet', icon: Tablet, label: 'Tablet' },
                { id: 'mobile', icon: Smartphone, label: 'Mobile' },
              ] as { id: ViewportSize; icon: typeof Monitor; label: string }[]
            ).map(({ id, icon: Icon, label }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewport === id ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setViewport(id)}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="w-px h-5 bg-border" />

          {/* Direction picker + Regenerate */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={isRegenerating}>
                <Sparkles className="h-3.5 w-3.5" />
                {DIRECTION_LABELS[direction].split(' ')[0]}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">Design direction</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.entries(DIRECTION_LABELS) as [DesignDirection, string][]).map(
                ([key, label]) => (
                  <DropdownMenuItem
                    key={key}
                    className={cn('text-xs', direction === key && 'bg-muted font-medium')}
                    onClick={() => {
                      setDirection(key)
                      void handleRegenerate(key)
                    }}
                  >
                    {label}
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => void handleRegenerate()}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {isRegenerating ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel: sections list */}
          <SectionsPanel design={design} onRegenerate={() => void handleRegenerate()} isRegenerating={isRegenerating} />

          {/* Canvas */}
          <div className="flex-1 overflow-auto flex items-start justify-center bg-muted/30 p-4">
            <div
              className={cn(
                'h-full transition-all duration-300 bg-white shadow-2xl rounded-lg overflow-hidden',
                VIEWPORT_WIDTHS[viewport],
              )}
            >
              {isRegenerating ? (
                <RegeneratingOverlay />
              ) : (
                <iframe
                  ref={iframeRef}
                  className="w-full h-full border-0"
                  title="Landing page preview"
                  // allow-scripts for any interactive elements (accordions, etc.)
                  // no allow-same-origin to prevent cookie/storage access
                  sandbox="allow-scripts"
                />
              )}
            </div>
          </div>

          {/* Right panel: manifest/claims info */}
          <ManifestPanel design={design} claims={claims} />
        </div>
      </div>
    </TooltipProvider>
  )
}

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────

function SectionsPanel({
  design,
  onRegenerate,
  isRegenerating,
}: {
  design: WebsiteDesign
  onRegenerate: () => void
  isRegenerating: boolean
}) {
  const isLegacy = design.renderManifest?.isLegacyBackfill === true
  const hasHtml = Boolean(design.renderHtml)

  return (
    <div className="w-52 bg-card border-r flex flex-col shrink-0">
      <div className="p-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Page Sections
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {design.sections.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No sections</p>
        )}
        {design.sections
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((section) => (
            <div
              key={section.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-foreground bg-muted/30 border border-transparent hover:border-border/50"
            >
              <span className="capitalize font-medium truncate">{section.type}</span>
              {section.content.headline && (
                <span className="text-muted-foreground truncate hidden xl:block">
                  — {section.content.headline}
                </span>
              )}
            </div>
          ))}
      </div>

      {(isLegacy || !hasHtml) && (
        <div className="p-3 border-t">
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-xs text-amber-700 dark:text-amber-400">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <p>
              {!hasHtml
                ? 'No canonical HTML yet. Regenerate to produce the fidelity-first preview.'
                : 'Backfilled from legacy data. Regenerate for the exact output.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full text-xs h-7 gap-1.5"
            onClick={onRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Regenerate now
          </Button>
        </div>
      )}
    </div>
  )
}

function ManifestPanel({
  design,
  claims,
}: {
  design: WebsiteDesign
  claims: string[]
}) {
  const manifest = design.renderManifest ?? {}
  const generatedAt =
    typeof manifest.generatedAt === 'string'
      ? new Date(manifest.generatedAt).toLocaleString()
      : null
  const direction =
    typeof manifest.designDirection === 'string' ? manifest.designDirection : null
  const templateRefs = Array.isArray(manifest.templateRefs)
    ? (manifest.templateRefs as string[])
    : []

  return (
    <div className="w-60 bg-card border-l flex flex-col shrink-0">
      <div className="p-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Generation info
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {generatedAt && (
          <InfoRow label="Generated" value={generatedAt} />
        )}
        {direction && (
          <InfoRow label="Direction" value={direction} />
        )}
        {templateRefs.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1">Templates used</p>
            <div className="space-y-0.5">
              {templateRefs.map((ref) => (
                <p key={ref} className="font-mono text-[10px] text-foreground/70 truncate">{ref}</p>
              ))}
            </div>
          </div>
        )}

        {claims.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1.5">Marketing claims ({claims.length})</p>
            <div className="space-y-1">
              {claims.slice(0, 6).map((claim, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-foreground/80">
                  <span className="shrink-0 w-3.5 h-3.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{claim}</span>
                </div>
              ))}
              {claims.length > 6 && (
                <p className="text-muted-foreground text-[10px]">+{claims.length - 6} more</p>
              )}
            </div>
          </div>
        )}

        {claims.length === 0 && !generatedAt && (
          <p className="text-muted-foreground text-center py-4">
            Generation metadata will appear here after the page is produced.
          </p>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground capitalize">{value}</p>
    </div>
  )
}

function RegeneratingOverlay() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 bg-muted/20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground font-medium">Generating your landing page…</p>
      <p className="text-xs text-muted-foreground/60 max-w-xs text-center">
        The template-aware pipeline is assembling brand tokens, design skeleton, and AI copy.
        This usually takes 10–20 seconds.
      </p>
    </div>
  )
}

/**
 * When render_html is empty (e.g., backfill from page_blocks with no HTML),
 * generate a minimal preview from the design sections so the canvas isn't blank.
 */
function buildFallbackHtml(design: WebsiteDesign): string {
  const { sections, seoMeta, globalStyles } = design

  const sectionHtml = sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const { content } = section
      return `
<section style="padding: 60px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
  ${content.headline ? `<h2 style="font-size: 1.75rem; font-weight: 700; margin: 0 0 12px; color: #0f172a;">${content.headline}</h2>` : ''}
  ${content.subheadline ? `<p style="font-size: 1.1rem; color: #475569; margin: 0 0 16px; max-width: 600px; margin-left: auto; margin-right: auto;">${content.subheadline}</p>` : ''}
  ${content.description && !content.subheadline ? `<p style="color: #64748b; max-width: 600px; margin: 0 auto 16px;">${content.description}</p>` : ''}
  ${
    content.cta
      ? `<a href="${content.cta.link}" style="display: inline-block; background: ${globalStyles.primaryColor}; color: #fff; padding: 12px 28px; border-radius: 8px; font-weight: 600; text-decoration: none;">${content.cta.text}</a>`
      : ''
  }
</section>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${seoMeta.title || design.name}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: ${globalStyles.fontBody}, system-ui, sans-serif; background: #fff; color: #0f172a; }
    h1, h2, h3 { font-family: ${globalStyles.fontHeading}, system-ui, sans-serif; }
  </style>
</head>
<body>
${sectionHtml}
</body>
</html>`
}
