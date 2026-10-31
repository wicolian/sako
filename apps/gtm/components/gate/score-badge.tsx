'use client'

/**
 * Score Badge - Visual compliance score (0-100)
 * 
 * Displays the overall compliance score with color coding:
 * - Green (80-100): Excellent compliance
 * - Yellow (50-79): Needs attention
 * - Red (0-49): High risk
 */

import { cn } from '@/lib/utils'

interface ScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function ScoreBadge({ 
  score, 
  size = 'md', 
  showLabel = true,
  className 
}: ScoreBadgeProps) {
  // Compliance score is inverse of risk score (100 - riskScore)
  const complianceScore = Math.max(0, Math.min(100, 100 - score))
  
  const getScoreColor = () => {
    if (complianceScore >= 80) return 'text-emerald-500'
    if (complianceScore >= 50) return 'text-amber-500'
    return 'text-red-500'
  }
  
  const getBackgroundColor = () => {
    if (complianceScore >= 80) return 'bg-emerald-500/10 border-emerald-500/20'
    if (complianceScore >= 50) return 'bg-amber-500/10 border-amber-500/20'
    return 'bg-red-500/10 border-red-500/20'
  }
  
  const getLabel = () => {
    if (complianceScore >= 80) return 'Excellent'
    if (complianceScore >= 50) return 'Needs Review'
    return 'High Risk'
  }
  
  const sizeClasses = {
    sm: 'w-16 h-16 text-xl',
    md: 'w-24 h-24 text-3xl',
    lg: 'w-32 h-32 text-4xl',
  }
  
  const labelSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }
  
  // Calculate stroke dashoffset for circular progress
  const radius = size === 'lg' ? 56 : size === 'md' ? 42 : 28
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (complianceScore / 100) * circumference
  
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className={cn(
        'relative flex items-center justify-center rounded-full border-2',
        getBackgroundColor(),
        sizeClasses[size]
      )}>
        {/* Circular progress background */}
        <svg 
          className="absolute inset-0 -rotate-90" 
          viewBox={`0 0 ${(radius + 8) * 2} ${(radius + 8) * 2}`}
        >
          {/* Background circle */}
          <circle
            cx={radius + 8}
            cy={radius + 8}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-muted/20"
          />
          {/* Progress circle */}
          <circle
            cx={radius + 8}
            cy={radius + 8}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={getScoreColor()}
            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          />
        </svg>
        
        {/* Score number */}
        <span className={cn('font-bold z-10', getScoreColor())}>
          {complianceScore}
        </span>
      </div>
      
      {showLabel && (
        <div className="text-center">
          <div className={cn('font-medium', getScoreColor(), labelSizeClasses[size])}>
            {getLabel()}
          </div>
          <div className={cn('text-muted-foreground', labelSizeClasses[size])}>
            Compliance Score
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Mini score badge for inline display
 */
export function MiniScoreBadge({ score }: { score: number }) {
  const complianceScore = Math.max(0, Math.min(100, 100 - score))
  
  const getColor = () => {
    if (complianceScore >= 80) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    if (complianceScore >= 50) return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    return 'bg-red-500/10 text-destructive border-red-500/20'
  }
  
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      getColor()
    )}>
      {complianceScore}
    </span>
  )
}
