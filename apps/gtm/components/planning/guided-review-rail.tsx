"use client"

import type { ReviewActionId, ReviewSignal } from "@/lib/planning/types"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const ACTION_LABELS: Record<ReviewActionId, string> = {
  "make-product-clearer": "Make product clearer",
  "increase-proof": "Increase proof",
  "reduce-ornament": "Reduce ornament",
  "tighten-hierarchy": "Tighten hierarchy",
  "shift-trust": "Shift toward trust",
  "shift-product": "Shift toward product",
  "shift-editorial": "Shift toward editorial",
  "shift-technical": "Shift toward technical",
  "shift-conversion": "Shift toward conversion",
}

interface GuidedReviewRailProps {
  signals: ReviewSignal[]
  actions?: ReviewActionId[]
  loadingAction?: ReviewActionId | null
  onAction?: (action: ReviewActionId) => void
}

export function GuidedReviewRail({
  signals,
  actions = [],
  loadingAction,
  onAction,
}: GuidedReviewRailProps) {
  if (signals.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Guided review
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Taste and proof checks surface targeted improvements instead of vague regen cycles.
          </p>
        </div>
        <Badge variant="outline" className="bg-background">
          Advisory
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {signals.map((signal) => (
          <div key={signal.key} className="rounded-lg border border-border/50 bg-background/70 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">{signal.label}</span>
              <span className="text-xs font-semibold text-muted-foreground">{signal.score}/100</span>
            </div>
            <Progress value={signal.score} className="h-2" />
            <p className="text-xs text-muted-foreground leading-relaxed">{signal.summary}</p>
          </div>
        ))}
      </div>

      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action}
              type="button"
              variant="outline"
              size="sm"
              disabled={!onAction || loadingAction === action}
              onClick={() => onAction?.(action)}
            >
              {ACTION_LABELS[action]}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
