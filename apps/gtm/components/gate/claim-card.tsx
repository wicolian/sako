'use client'

/**
 * Claim Card - Individual claim result with expandable details
 * 
 * Shows claim text, status badge, and expandable details including:
 * - Issues found
 * - Risk score
 * - Suggested rewrite
 * - Evidence requirements
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Lightbulb,
  FileText,
  Copy,
  Check
} from 'lucide-react'
import { MiniScoreBadge } from './score-badge'

export interface ClaimResult {
  text: string
  status: 'approved' | 'needs_proof' | 'blocked'
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high'
  issues: string[]
  category?: string
  requiredEvidenceTier?: 'A' | 'B' | 'C' | null
  suggestion?: string
  requiresEvidence: boolean
}

interface ClaimCardProps {
  claim: ClaimResult
  index: number
  defaultExpanded?: boolean
}

export function ClaimCard({ claim, index, defaultExpanded = false }: ClaimCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [copied, setCopied] = useState(false)
  
  const getStatusIcon = () => {
    switch (claim.status) {
      case 'approved':
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      case 'needs_proof':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />
      case 'blocked':
        return <XCircle className="h-5 w-5 text-red-500" />
    }
  }
  
  const getStatusBadge = () => {
    switch (claim.status) {
      case 'approved':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Approved</Badge>
      case 'needs_proof':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Needs Proof</Badge>
      case 'blocked':
        return <Badge variant="outline" className="bg-red-500/10 text-destructive border-red-500/20">Blocked</Badge>
    }
  }
  
  const getEvidenceTierLabel = (tier: string) => {
    switch (tier) {
      case 'A':
        return 'Tier A - Third-party verification required'
      case 'B':
        return 'Tier B - Internal documentation required'
      case 'C':
        return 'Tier C - Basic substantiation required'
      default:
        return tier
    }
  }
  
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <Card className={cn(
      'transition-all duration-200',
      isExpanded && 'ring-1 ring-border shadow-sm'
    )}>
      <CardContent className="p-4">
        {/* Header - Always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-start gap-3 text-left"
        >
          <div className="flex-shrink-0 mt-0.5">
            {getStatusIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs text-muted-foreground">Claim #{index + 1}</span>
              {getStatusBadge()}
              <MiniScoreBadge score={claim.riskScore} />
              {claim.category && (
                <Badge variant="secondary" className="text-xs">
                  {claim.category}
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-foreground line-clamp-2">
              "{claim.text}"
            </p>
          </div>
          
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
        
        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pl-8 space-y-4">
            {/* Issues */}
            {claim.issues.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Issues Found
                </h4>
                <ul className="space-y-1">
                  {claim.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span>{formatIssue(issue)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Evidence Requirements */}
            {claim.requiredEvidenceTier && claim.requiresEvidence && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Evidence Required
                </h4>
                <div className="flex items-start gap-2 text-sm bg-muted/50 rounded-md p-3">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>{getEvidenceTierLabel(claim.requiredEvidenceTier)}</span>
                </div>
              </div>
            )}
            
            {/* Suggested Rewrite */}
            {claim.suggestion && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Suggested Rewrite
                </h4>
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm flex-1">{claim.suggestion}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(claim.suggestion!)
                      }}
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Format issue code to human-readable text
 */
function formatIssue(issue: string): string {
  const issueMap: Record<string, string> = {
    'SUPERLATIVE_NO_PROOF': 'Contains superlative claim without supporting evidence',
    'ABSOLUTE_CLAIM': 'Makes an absolute/unqualified claim that\'s hard to prove',
    'COMPARATIVE_NO_BASELINE': 'Comparative claim needs a clear baseline or reference',
    'FORBIDDEN_TERM': 'Contains prohibited terminology for this industry',
    'REGULATED_CATEGORY': 'Touches on a regulated category requiring extra scrutiny',
    'WEASEL_WORDS_STRICT': 'Contains vague or ambiguous language',
    'QUANT_DELTA_NO_SOURCE': 'Quantified claim needs a cited source',
    'MISSING_EVIDENCE': 'Claim requires supporting evidence to be published',
  }
  
  return issueMap[issue] || issue
}
