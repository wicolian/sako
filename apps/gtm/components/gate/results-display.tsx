'use client'

/**
 * Results Display - Animated validation results with score badge
 * 
 * Shows:
 * - Overall compliance score
 * - Summary stats (approved/needs_proof/blocked)
 * - List of validated claims
 * - Action buttons (copy, share, generate)
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScoreBadge } from './score-badge'
import { ClaimCard, type ClaimResult } from './claim-card'
import { BadgeEmbedDialog } from './compliance-badge'
import { toast } from 'sonner'
import { 
  Copy, 
  Check, 
  Share2, 
  Wand2, 
  ChevronDown, 
  ChevronUp,
  Download,
  FileText,
  Code2,
  Link as LinkIcon
} from 'lucide-react'

export interface ValidationResults {
  results: ClaimResult[]
  summary: {
    total: number
    approved: number
    needsProof: number
    blocked: number
    averageRiskScore: number
  }
  meta: {
    policyVersion?: number
    policyMode?: string
    processingTimeMs: number
  }
}

interface ResultsDisplayProps {
  results: ValidationResults
  originalText: string
  industry: string
  onGeneratePage: () => void
  onShare: () => void
  className?: string
}

// Store report token after creation
let cachedReportToken: string | null = null

export function ResultsDisplay({
  results,
  originalText,
  industry,
  onGeneratePage,
  onShare,
  className
}: ResultsDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [expandAll, setExpandAll] = useState(false)
  const [reportToken, setReportToken] = useState<string | null>(cachedReportToken)
  const [isCreatingReport, setIsCreatingReport] = useState(false)
  
  // Create report for sharing
  const createReport = async (): Promise<string | null> => {
    if (reportToken) return reportToken
    
    setIsCreatingReport(true)
    try {
      const response = await fetch('/api/gate/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText,
          industry,
          results: results.results,
          summary: results.summary,
        }),
      })
      
      const data = await response.json()
      if (data.success && data.token) {
        cachedReportToken = data.token
        setReportToken(data.token)
        return data.token
      }
    } catch (error) {
      console.error('Failed to create report:', error)
    } finally {
      setIsCreatingReport(false)
    }
    return null
  }
  
  const handleShare = async () => {
    const token = await createReport()
    if (token) {
      const url = `${window.location.origin}/gate/report/${token}`
      await navigator.clipboard.writeText(url)
      toast.success('Report link copied!')
    } else {
      toast.error('Failed to create report')
    }
  }
  
  const copyCompliantVersion = async () => {
    // Build compliant version by replacing blocked/needs_proof claims with suggestions
    let compliantText = originalText
    
    for (const claim of results.results) {
      if (claim.status !== 'approved' && claim.suggestion) {
        compliantText = compliantText.replace(claim.text, claim.suggestion)
      }
    }
    
    await navigator.clipboard.writeText(compliantText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const downloadReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      industry,
      summary: results.summary,
      claims: results.results,
      meta: results.meta,
    }
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compliance-report-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-6', className)}
    >
      {/* Score and Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Score Badge */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <ScoreBadge score={results.summary.averageRiskScore} size="lg" />
            </motion.div>
            
            {/* Summary Stats */}
            <div className="flex-1 w-full">
              <h3 className="text-lg font-semibold mb-4">Validation Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-center p-3 rounded-lg bg-emerald-500/10"
                >
                  <div className="text-2xl font-bold text-emerald-600">
                    {results.summary.approved}
                  </div>
                  <div className="text-xs text-muted-foreground">Approved</div>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-center p-3 rounded-lg bg-amber-500/10"
                >
                  <div className="text-2xl font-bold text-amber-500">
                    {results.summary.needsProof}
                  </div>
                  <div className="text-xs text-muted-foreground">Need Proof</div>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-center p-3 rounded-lg bg-red-500/10"
                >
                  <div className="text-2xl font-bold text-destructive">
                    {results.summary.blocked}
                  </div>
                  <div className="text-xs text-muted-foreground">Blocked</div>
                </motion.div>
              </div>
              
              <p className="text-xs text-muted-foreground mt-3">
                Analyzed {results.summary.total} claim{results.summary.total !== 1 ? 's' : ''} in {results.meta.processingTimeMs}ms
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Action Buttons - Responsive grid on mobile */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
        <Button onClick={copyCompliantVersion} variant="outline" className="text-sm sm:text-base">
          {copied ? (
            <>
              <Check className="mr-1 sm:mr-2 h-4 w-4 text-emerald-500" />
              <span className="hidden sm:inline">Copied!</span>
              <span className="sm:hidden">Done</span>
            </>
          ) : (
            <>
              <Copy className="mr-1 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Copy Compliant Version</span>
              <span className="sm:hidden">Copy</span>
            </>
          )}
        </Button>
        
        <Button onClick={onGeneratePage} className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-sm sm:text-base col-span-2 sm:col-span-1">
          <Wand2 className="mr-1 sm:mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Generate Landing Page</span>
          <span className="sm:hidden">Generate Page</span>
        </Button>
        
        <Button onClick={downloadReport} variant="outline" className="text-sm sm:text-base">
          <Download className="mr-1 sm:mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Download Report</span>
          <span className="sm:hidden">Download</span>
        </Button>
        
        <Button onClick={handleShare} variant="outline" className="text-sm sm:text-base" disabled={isCreatingReport}>
          <LinkIcon className="mr-1 sm:mr-2 h-4 w-4" />
          <span className="hidden sm:inline">{isCreatingReport ? 'Creating...' : 'Copy Link'}</span>
          <span className="sm:hidden">{isCreatingReport ? '...' : 'Link'}</span>
        </Button>
        
        {/* Badge Embed - only show if score is good */}
        {results.summary.averageRiskScore < 50 && reportToken && (
          <BadgeEmbedDialog score={results.summary.averageRiskScore} reportToken={reportToken}>
            <Button variant="outline" className="text-sm sm:text-base">
              <Code2 className="mr-1 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Embed Badge</span>
              <span className="sm:hidden">Embed</span>
            </Button>
          </BadgeEmbedDialog>
        )}
      </div>
      
      {/* Claims List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">
              Validated Claims ({results.results.length})
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpandAll(!expandAll)}
            >
              {expandAll ? (
                <>
                  <ChevronUp className="mr-1 h-4 w-4" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-4 w-4" />
                  Expand All
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {results.results.map((claim, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <ClaimCard 
                    claim={claim} 
                    index={index}
                    defaultExpanded={expandAll}
                  />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        </CardContent>
      </Card>
      
      {/* CTA for Signup */}
      {results.summary.blocked > 0 || results.summary.needsProof > 0 ? (
        <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-4 sm:p-6 text-center">
            <FileText className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 sm:mb-3 text-primary" />
            <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">
              Need help fixing these issues?
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
              Sign up for Sako to get AI-powered rewrites and manage your marketing compliance at scale.
            </p>
            <Button asChild size="sm" className="sm:size-default">
              <a href="/signup?source=gate">Get Started Free</a>
            </Button>
          </CardContent>
        </Card>
      ) : null}
      
      {/* Mobile Sticky CTA - Only shows on small screens */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border sm:hidden z-50">
        <Button 
          onClick={onGeneratePage} 
          className="w-full bg-gradient-to-r from-violet-500 to-purple-600"
        >
          <Wand2 className="mr-2 h-4 w-4" />
          Generate Landing Page
        </Button>
      </div>
      
      {/* Spacer for mobile sticky CTA */}
      <div className="h-20 sm:hidden" />
    </motion.div>
  )
}
