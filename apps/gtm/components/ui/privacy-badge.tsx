'use client'

/**
 * Privacy Badge Component
 * 
 * User-facing privacy messaging:
 * - Data privacy indicators
 * - Security badges
 * - Compliance information
 */

import { Shield, Lock, Eye, EyeOff, CheckCircle2, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ============================================================================
// Privacy Badge Types
// ============================================================================

export type PrivacyLevel = 'private' | 'workspace' | 'public'
export type SecurityLevel = 'standard' | 'enhanced' | 'enterprise'

interface PrivacyBadgeProps {
  level: PrivacyLevel
  showLabel?: boolean
  className?: string
}

interface SecurityBadgeProps {
  level: SecurityLevel
  showLabel?: boolean
  className?: string
}

interface DataPrivacyInfoProps {
  className?: string
}

// ============================================================================
// Privacy Badge Component
// ============================================================================

export function PrivacyBadge({ level, showLabel = true, className }: PrivacyBadgeProps) {
  const config = {
    private: {
      icon: Lock,
      label: 'Private',
      description: 'Only you can see this',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-950/30',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
    },
    workspace: {
      icon: Eye,
      label: 'Workspace',
      description: 'Visible to workspace members',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10 ',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    public: {
      icon: EyeOff,
      label: 'Public',
      description: 'Anyone with the link can view',
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10 ',
      borderColor: 'border-amber-200 dark:border-amber-800',
    },
  }

  const { icon: Icon, label, description, color, bgColor, borderColor } = config[level]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              bgColor,
              borderColor,
              color,
              'cursor-help',
              className
            )}
          >
            <Icon className="h-3 w-3 mr-1" />
            {showLabel && label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// Security Badge Component
// ============================================================================

export function SecurityBadge({ level, showLabel = true, className }: SecurityBadgeProps) {
  const config = {
    standard: {
      icon: Shield,
      label: 'Secure',
      description: '256-bit encryption',
      color: 'text-slate-600',
      bgColor: 'bg-slate-100 dark:bg-card/40 backdrop-blur-sm/30',
    },
    enhanced: {
      icon: Shield,
      label: 'Enhanced',
      description: '256-bit encryption + 2FA available',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10 ',
    },
    enterprise: {
      icon: Shield,
      label: 'Enterprise',
      description: 'SOC2 + SSO + Advanced controls',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-950/30',
    },
  }

  const { icon: Icon, label, description, color, bgColor } = config[level]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(bgColor, color, 'cursor-help', className)}
          >
            <Icon className="h-3 w-3 mr-1" />
            {showLabel && label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// Data Privacy Info Component
// ============================================================================

export function DataPrivacyInfo({ className }: DataPrivacyInfoProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-auto p-1 text-muted-foreground hover:text-foreground', className)}
        >
          <Info className="h-4 w-4 mr-1" />
          <span className="text-xs">Your data is private</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Data Privacy Promise</h4>
          
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Never shared</p>
                <p className="text-xs text-muted-foreground">
                  Your brand data is never shared with third parties
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Never used for training</p>
                <p className="text-xs text-muted-foreground">
                  We don't use your content to train AI models
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">256-bit encryption</p>
                <p className="text-xs text-muted-foreground">
                  All data encrypted in transit and at rest
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">You own your data</p>
                <p className="text-xs text-muted-foreground">
                  Export or delete anytime
                </p>
              </div>
            </div>
          </div>
          
          <div className="pt-2 border-t">
            <a 
              href="/privacy" 
              className="text-xs text-primary hover:underline"
            >
              Read our full privacy policy →
            </a>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ============================================================================
// Privacy Banner Component
// ============================================================================

interface PrivacyBannerProps {
  className?: string
}

export function PrivacyBanner({ className }: PrivacyBannerProps) {
  return (
    <div className={cn(
      'flex items-center justify-center gap-6 py-3 px-4 bg-muted/50 border-b text-sm',
      className
    )}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Lock className="h-4 w-4 text-emerald-500" />
        <span>Your data stays private</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Shield className="h-4 w-4 text-blue-500" />
        <span>256-bit encryption</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <EyeOff className="h-4 w-4 text-purple-500" />
        <span>Never used for AI training</span>
      </div>
    </div>
  )
}

// ============================================================================
// Compliance Badges
// ============================================================================

export function ComplianceBadges({ className }: { className?: string }) {
  const badges = [
    { id: 'gdpr', label: 'GDPR', color: 'bg-blue-500/10 text-blue-500' },
    { id: 'ccpa', label: 'CCPA', color: 'bg-emerald-100 text-emerald-700' },
    { id: 'soc2', label: 'SOC2', color: 'bg-purple-100 text-purple-700' },
  ]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {badges.map(badge => (
        <Badge
          key={badge.id}
          variant="outline"
          className={cn('text-xs font-medium', badge.color)}
        >
          {badge.label}
        </Badge>
      ))}
    </div>
  )
}
