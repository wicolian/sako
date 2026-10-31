"use client"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ScoreBadgeProps {
  score: number
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  className?: string
}

/**
 * Risk score visualization component
 * Displays a score from 0-100 with color-coded progress bar
 * 
 * Score interpretation:
 * - 0-25: Low risk (green)
 * - 25-50: Low-Medium risk (yellow-green)
 * - 50-75: Medium risk (amber)
 * - 75-100: High risk (red)
 */
export function ScoreBadge({
  score,
  size = "md",
  showLabel = true,
  className,
}: ScoreBadgeProps) {
  // Clamp score between 0-100
  const clampedScore = Math.max(0, Math.min(100, score))

  // Determine color and label based on score
  const getScoreConfig = (s: number) => {
    if (s >= 75) {
      return {
        color: "bg-red-500",
        textColor: "text-destructive",
        label: "High Risk",
        description: "Immediate attention required",
      }
    }
    if (s >= 50) {
      return {
        color: "bg-amber-500",
        textColor: "text-amber-500",
        label: "Medium Risk",
        description: "Review recommended",
      }
    }
    if (s >= 25) {
      return {
        color: "bg-yellow-500",
        textColor: "text-amber-500",
        label: "Low-Medium Risk",
        description: "Monitor periodically",
      }
    }
    return {
      color: "bg-emerald-500",
      textColor: "text-emerald-600",
      label: "Low Risk",
      description: "Approved for use",
    }
  }

  const config = getScoreConfig(clampedScore)

  const sizeConfig = {
    sm: {
      barWidth: "w-12",
      barHeight: "h-1",
      textSize: "text-xs",
    },
    md: {
      barWidth: "w-16",
      barHeight: "h-1.5",
      textSize: "text-sm",
    },
    lg: {
      barWidth: "w-24",
      barHeight: "h-2",
      textSize: "text-base",
    },
  }

  const { barWidth, barHeight, textSize } = sizeConfig[size]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2", className)}>
            {/* Progress bar */}
            <div
              className={cn(
                "rounded-full overflow-hidden bg-muted shrink-0",
                barWidth,
                barHeight
              )}
              role="progressbar"
              aria-valuenow={clampedScore}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Risk score: ${clampedScore} out of 100`}
            >
              <div
                className={cn("h-full rounded-full transition-all duration-300", config.color)}
                style={{ width: `${clampedScore}%` }}
              />
            </div>

            {/* Score number */}
            <span
              className={cn(
                "font-medium tabular-nums shrink-0",
                textSize,
                config.textColor
              )}
            >
              {clampedScore}
            </span>

            {/* Label */}
            {showLabel && (
              <span
                className={cn(
                  "hidden sm:inline-block shrink-0",
                  textSize,
                  config.textColor
                )}
              >
                {config.label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            <p className="text-xs text-muted-foreground">Risk score: {clampedScore}/100</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Compliance score badge (inverse of risk)
 * Higher score = better compliance
 */
export function ComplianceBadge({
  score,
  size = "md",
  showLabel = true,
  className,
}: ScoreBadgeProps) {
  // Convert compliance score to risk (inverse)
  const riskScore = 100 - Math.max(0, Math.min(100, score))
  
  const getComplianceConfig = (s: number) => {
    if (s >= 90) {
      return {
        color: "bg-emerald-500",
        textColor: "text-emerald-600",
        label: "A",
        description: "Excellent compliance",
      }
    }
    if (s >= 80) {
      return {
        color: "bg-emerald-400",
        textColor: "text-emerald-600",
        label: "B",
        description: "Good compliance",
      }
    }
    if (s >= 70) {
      return {
        color: "bg-amber-500",
        textColor: "text-amber-500",
        label: "C",
        description: "Acceptable compliance",
      }
    }
    if (s >= 60) {
      return {
        color: "bg-orange-500",
        textColor: "text-orange-600",
        label: "D",
        description: "Needs improvement",
      }
    }
    return {
      color: "bg-red-500",
      textColor: "text-destructive",
      label: "F",
      description: "High risk - review required",
    }
  }

  const config = getComplianceConfig(score)

  const sizeConfig = {
    sm: {
      barWidth: "w-12",
      barHeight: "h-1",
      badgeSize: "h-5 px-1.5 text-[10px]",
    },
    md: {
      barWidth: "w-16",
      barHeight: "h-1.5",
      badgeSize: "h-6 px-2 text-xs",
    },
    lg: {
      barWidth: "w-24",
      barHeight: "h-2",
      badgeSize: "h-7 px-2.5 text-sm",
    },
  }

  const { barWidth, barHeight, badgeSize } = sizeConfig[size]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2", className)}>
            {/* Progress bar */}
            <div
              className={cn(
                "rounded-full overflow-hidden bg-muted shrink-0",
                barWidth,
                barHeight
              )}
              role="progressbar"
              aria-valuenow={score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Compliance score: ${score} out of 100`}
            >
              <div
                className={cn("h-full rounded-full transition-all duration-300", config.color)}
                style={{ width: `${score}%` }}
              />
            </div>

            {/* Grade badge */}
            <div
              className={cn(
                "inline-flex items-center justify-center rounded font-semibold shrink-0",
                badgeSize,
                config.textColor.replace("text-", "bg-").replace("600", "100")
              )}
            >
              {config.label}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="space-y-1">
            <p className="font-medium">Grade {config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            <p className="text-xs text-muted-foreground">Score: {score}/100</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Status badge for claims with icon and color
 */
interface StatusBadgeProps {
  status: "draft" | "needs_proof" | "blocked" | "ready_review" | "approved" | "rejected"
  size?: "sm" | "md"
  className?: string
}

export function ClaimStatusBadge({ status, size = "md", className }: StatusBadgeProps) {
  const config = {
    draft: {
      label: "Draft",
      color: "bg-muted/20 text-muted-foreground border-border/50",
      dotColor: "bg-muted",
    },
    needs_proof: {
      label: "Needs Evidence",
      color: "bg-amber-50 text-amber-500 border-amber-200",
      dotColor: "bg-amber-500",
    },
    blocked: {
      label: "Blocked",
      color: "bg-red-50 text-destructive border-red-200",
      dotColor: "bg-red-500",
    },
    ready_review: {
      label: "Ready for Review",
      color: "bg-blue-50 text-blue-500 border-blue-200",
      dotColor: "bg-blue-500",
    },
    approved: {
      label: "Approved",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dotColor: "bg-emerald-500",
    },
    rejected: {
      label: "Rejected",
      color: "bg-red-50 text-destructive border-red-200",
      dotColor: "bg-red-500",
    },
  }

  const { label, color, dotColor } = config[status]
  const sizeClasses = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        sizeClasses,
        color,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
      {label}
    </span>
  )
}
