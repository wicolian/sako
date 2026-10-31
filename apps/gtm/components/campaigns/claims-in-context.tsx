'use client'

import { useState, useEffect } from 'react'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  Link2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'

// ============================================================================
// Types
// ============================================================================

export interface Claim {
  id: string
  text: string
  status: 'approved' | 'pending' | 'review' | 'rejected' | 'blocked'
  tier: 'A' | 'B' | 'C'
  category?: string
  evidence?: Evidence[]
  source?: string
  detectedAt?: string
  reviewedAt?: string
  reviewedBy?: string
  notes?: string
}

export interface Evidence {
  id: string
  type: 'clinical_trial' | 'regulatory' | 'internal' | 'third_party' | 'testimonial'
  title: string
  url?: string
  dateAdded: string
  strength: 'strong' | 'moderate' | 'weak'
}

interface ClaimsInContextProps {
  campaignId: string
  claims: Claim[]
  onRefresh?: () => void
  onClaimAction?: (claimId: string, action: 'approve' | 'reject' | 'request_evidence') => Promise<void>
  isLoading?: boolean
  className?: string
}

// ============================================================================
// Status Config
// ============================================================================

const STATUS_CONFIG = {
  approved: {
    icon: ShieldCheck,
    label: 'Approved',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  pending: {
    icon: Clock,
    label: 'Pending Review',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-500/10 text-amber-500',
  },
  review: {
    icon: Shield,
    label: 'In Review',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-500/10 text-blue-500',
  },
  rejected: {
    icon: ShieldX,
    label: 'Rejected',
    color: 'text-red-500',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-destructive/10 text-destructive',
  },
  blocked: {
    icon: ShieldAlert,
    label: 'Blocked',
    color: 'text-destructive',
    bg: 'bg-red-50',
    border: 'border-red-300',
    badge: 'bg-destructive/10 text-red-800',
  },
}

const TIER_CONFIG = {
  A: { label: 'Tier A', color: 'bg-emerald-500', description: 'Strong evidence' },
  B: { label: 'Tier B', color: 'bg-amber-500', description: 'Moderate evidence' },
  C: { label: 'Tier C', color: 'bg-red-500', description: 'Weak/no evidence' },
}

const EVIDENCE_TYPE_LABELS = {
  clinical_trial: 'Clinical Trial',
  regulatory: 'Regulatory',
  internal: 'Internal Study',
  third_party: 'Third Party',
  testimonial: 'Testimonial',
}

// ============================================================================
// Claim Item Component
// ============================================================================

interface ClaimItemProps {
  claim: Claim
  onAction?: (action: 'approve' | 'reject' | 'request_evidence') => Promise<void>
}

function ClaimItem({ claim, onAction }: ClaimItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isActioning, setIsActioning] = useState(false)
  const { toast } = useToast()

  const status = STATUS_CONFIG[claim.status]
  const tier = TIER_CONFIG[claim.tier]
  const StatusIcon = status.icon

  const handleAction = async (action: 'approve' | 'reject' | 'request_evidence') => {
    if (!onAction) return
    setIsActioning(true)
    try {
      await onAction(action)
      toast({
        title: action === 'approve' ? 'Claim approved' : 
               action === 'reject' ? 'Claim rejected' : 
               'Evidence requested',
      })
    } catch (error) {
      toast({
        title: 'Action failed',
        description: 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setIsActioning(false)
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn(
        "border rounded-lg transition-all",
        status.border,
        isOpen && "shadow-sm"
      )}>
        <CollapsibleTrigger className="w-full">
          <div className={cn(
            "flex items-start gap-3 p-4",
            status.bg,
            "hover:bg-opacity-75 transition-colors"
          )}>
            {/* Status Icon */}
            <StatusIcon className={cn("h-5 w-5 mt-0.5 shrink-0", status.color)} />

            {/* Content */}
            <div className="flex-1 text-left">
              <p className="text-sm font-medium line-clamp-2">{claim.text}</p>
              
              <div className="flex items-center gap-2 mt-2">
                <Badge className={status.badge} variant="secondary">
                  {status.label}
                </Badge>
                <Badge className={cn("text-white text-xs", tier.color)}>
                  {tier.label}
                </Badge>
                {claim.category && (
                  <Badge variant="outline" className="text-xs">
                    {claim.category}
                  </Badge>
                )}
              </div>
            </div>

            {/* Expand Icon */}
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t">
            {/* Evidence Section */}
            {claim.evidence && claim.evidence.length > 0 ? (
              <div className="pt-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Evidence ({claim.evidence.length})
                </h4>
                <div className="space-y-2">
                  {claim.evidence.map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {EVIDENCE_TYPE_LABELS[ev.type]}
                        </Badge>
                        <span className="text-sm truncate max-w-[200px]">{ev.title}</span>
                      </div>
                      {ev.url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={ev.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pt-4 text-center text-sm text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                No evidence linked to this claim
              </div>
            )}

            {/* Notes */}
            {claim.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">Notes: {claim.notes}</p>
              </div>
            )}

            {/* Actions */}
            {onAction && claim.status !== 'approved' && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleAction('approve')}
                  disabled={isActioning || claim.tier === 'C'}
                >
                  {isActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction('request_evidence')}
                  disabled={isActioning}
                >
                  Request Evidence
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-destructive"
                  onClick={() => handleAction('reject')}
                  disabled={isActioning}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Reject
                </Button>
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
              {claim.detectedAt && (
                <span>Detected: {new Date(claim.detectedAt).toLocaleDateString()}</span>
              )}
              {claim.reviewedAt && (
                <span>Reviewed: {new Date(claim.reviewedAt).toLocaleDateString()}</span>
              )}
              {claim.source && (
                <span>Source: {claim.source}</span>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ClaimsInContext({
  campaignId,
  claims,
  onRefresh,
  onClaimAction,
  isLoading = false,
  className,
}: ClaimsInContextProps) {
  // Group claims by status
  const groupedClaims = claims.reduce((acc, claim) => {
    const status = claim.status === 'blocked' || claim.status === 'rejected' 
      ? 'blocked' 
      : claim.status === 'approved' 
        ? 'approved' 
        : 'pending'
    
    if (!acc[status]) acc[status] = []
    acc[status].push(claim)
    return acc
  }, {} as Record<string, Claim[]>)

  const blockedCount = groupedClaims.blocked?.length || 0
  const pendingCount = groupedClaims.pending?.length || 0
  const approvedCount = groupedClaims.approved?.length || 0

  const handleClaimAction = async (
    claimId: string, 
    action: 'approve' | 'reject' | 'request_evidence'
  ) => {
    if (onClaimAction) {
      await onClaimAction(claimId, action)
    }
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Loading claims...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (claims.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <ShieldCheck className="h-12 w-12 text-emerald-500 mb-4" />
            <h3 className="font-medium">No claims detected</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your campaign content has no marketing claims that require validation
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Claims Compliance
          </CardTitle>
          
          {/* Summary badges */}
          <div className="flex items-center gap-2">
            {blockedCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      {blockedCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {blockedCount} blocked claim{blockedCount !== 1 ? 's' : ''}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {pendingCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge className="bg-amber-500/10 text-amber-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {pendingCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {pendingCount} pending claim{pendingCount !== 1 ? 's' : ''}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge className="bg-emerald-100 text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    {approvedCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {approvedCount} approved claim{approvedCount !== 1 ? 's' : ''}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Blocked/Rejected Claims */}
        {groupedClaims.blocked && groupedClaims.blocked.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-destructive mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Requires Attention ({groupedClaims.blocked.length})
            </h4>
            <div className="space-y-2">
              {groupedClaims.blocked.map((claim) => (
                <ClaimItem 
                  key={claim.id} 
                  claim={claim}
                  onAction={onClaimAction ? (action) => handleClaimAction(claim.id, action) : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pending Claims */}
        {groupedClaims.pending && groupedClaims.pending.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-amber-500 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Review ({groupedClaims.pending.length})
            </h4>
            <div className="space-y-2">
              {groupedClaims.pending.map((claim) => (
                <ClaimItem 
                  key={claim.id} 
                  claim={claim}
                  onAction={onClaimAction ? (action) => handleClaimAction(claim.id, action) : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Approved Claims */}
        {groupedClaims.approved && groupedClaims.approved.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-emerald-600 mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Approved ({groupedClaims.approved.length})
            </h4>
            <div className="space-y-2">
              {groupedClaims.approved.map((claim) => (
                <ClaimItem key={claim.id} claim={claim} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
