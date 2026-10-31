"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, ShieldAlert, ShieldX, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface ClaimHighlightProps {
  claimId: string
  riskLevel: 'safe' | 'needs_evidence' | 'risky' | 'blocked'
  category: string
  isFabricated: boolean
  suggestedRewrite?: string
  evidenceStatus: string
  children: React.ReactNode
  onClaimClick?: (claimId: string) => void
}

const RISK_STYLES = {
  safe: {
    underline: "decoration-emerald-500",
    hoverBg: "hover:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: CheckCircle2,
    label: "Safe",
  },
  needs_evidence: {
    underline: "decoration-amber-500",
    hoverBg: "hover:bg-amber-500/10",
    text: "text-amber-500 ",
    icon: Info,
    label: "Needs Evidence",
  },
  risky: {
    underline: "decoration-orange-500",
    hoverBg: "hover:bg-orange-500/10",
    text: "text-orange-700 dark:text-orange-400",
    icon: AlertCircle,
    label: "Risky",
  },
  blocked: {
    underline: "decoration-red-500",
    hoverBg: "hover:bg-red-500/10",
    text: "text-destructive ",
    icon: ShieldX,
    label: "Blocked",
  },
}

export function ClaimHighlight({
  claimId,
  riskLevel,
  category,
  isFabricated,
  suggestedRewrite,
  evidenceStatus,
  children,
  onClaimClick,
}: ClaimHighlightProps) {
  const styles = RISK_STYLES[riskLevel]
  const Icon = isFabricated ? ShieldAlert : styles.icon

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            onClick={() => onClaimClick?.(claimId)}
            className={cn(
              "relative inline cursor-pointer transition-colors duration-150 ease-in-out",
              "underline underline-offset-4 decoration-2",
              isFabricated ? "decoration-dashed decoration-blue-500 hover:bg-blue-500/10" : cn(styles.underline, styles.hoverBg),
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary/50",
              "active:opacity-80 rounded-[2px]"
            )}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClaimClick?.(claimId)
              }
            }}
          >
            {children}
            {isFabricated && (
              <span className="ml-1 inline-flex items-center text-[10px] font-mono font-medium text-blue-500 bg-blue-500/10 px-1 py-0.5 rounded align-middle relative -top-0.5">
                NEW
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent 
          sideOffset={8}
          className="w-72 p-4 shadow-xl border-border/50 bg-background/95 backdrop-blur-sm"
        >
          <div className="flex items-start gap-3">
            <div className={cn("mt-0.5 shrink-0", isFabricated ? "text-blue-500" : styles.text)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className={cn("font-semibold text-sm", isFabricated ? "text-blue-500" : styles.text)}>
                  {isFabricated ? "AI Generated Claim" : styles.label}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                  {category}
                </span>
              </div>
              
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Evidence: </span>
                {evidenceStatus}
              </div>

              {suggestedRewrite && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Suggested Rewrite</div>
                  <div className="text-xs italic text-foreground bg-muted/50 p-2 rounded-md">
                    "{suggestedRewrite}"
                  </div>
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
