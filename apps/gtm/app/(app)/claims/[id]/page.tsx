'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  CheckCircle2,
  XCircle,
  Clock,
  Link2,
  Plus,
  Trash2,
  RefreshCw,
  Lightbulb,
  FileText,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import type { ClaimStatus, ClaimCategory, ClaimType } from '@/lib/supabase/types'

interface Evidence {
  id: string
  title: string
  type: string
  tier: 'A' | 'B' | 'C'
  content?: string
  url?: string
}

interface ClaimWithDetails {
  id: string
  text: string
  original_text: string | null
  claim_type: ClaimType
  category: ClaimCategory
  status: ClaimStatus
  risk_score: number
  reason_codes: string[]
  required_evidence_tier: 'A' | 'B' | 'C' | null
  suggested_rewrites: string[]
  policy_version: number | null
  created_at: string
  updated_at: string
  claim_evidence_links: Array<{
    id: string
    relevance_note: string | null
    evidence: Evidence
  }>
  approvals: Array<{
    id: string
    decision: string
    comment: string | null
    created_at: string
  }>
}

const STATUS_CONFIG: Record<ClaimStatus, { icon: React.ElementType; color: string; label: string }> = {
  draft: { icon: Clock, color: 'bg-muted/20 text-muted-foreground', label: 'Draft' },
  needs_proof: { icon: ShieldQuestion, color: 'bg-amber-500/10 text-amber-500', label: 'Needs Proof' },
  blocked: { icon: ShieldAlert, color: 'bg-destructive/10 text-destructive', label: 'Blocked' },
  ready_review: { icon: Clock, color: 'bg-blue-500/10 text-blue-500', label: 'Ready for Review' },
  approved: { icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-500', label: 'Approved' },
  rejected: { icon: XCircle, color: 'bg-destructive/10 text-destructive', label: 'Rejected' },
}

export default function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [claim, setClaim] = useState<ClaimWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(false)
  const [availableEvidence, setAvailableEvidence] = useState<Evidence[]>([])
  const [linkEvidenceOpen, setLinkEvidenceOpen] = useState(false)
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null)
  const [relevanceNote, setRelevanceNote] = useState('')

  useEffect(() => {
    fetchClaim()
    fetchAvailableEvidence()
  }, [id])

  async function fetchClaim() {
    setLoading(true)
    try {
      const res = await fetch(`/api/claims/${id}`)
      if (res.ok) {
        const data = await res.json()
        setClaim(data)
      }
    } catch (error) {
      console.error('Error fetching claim:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchAvailableEvidence() {
    try {
      const res = await fetch('/api/evidence')
      if (res.ok) {
        const data = await res.json()
        setAvailableEvidence(data)
      }
    } catch (error) {
      console.error('Error fetching evidence:', error)
    }
  }

  async function revalidateClaim() {
    setValidating(true)
    try {
      await fetch(`/api/claims/${id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateRewrites: true }),
      })
      fetchClaim()
    } catch (error) {
      console.error('Error validating claim:', error)
    } finally {
      setValidating(false)
    }
  }

  async function linkEvidence() {
    if (!selectedEvidence) return
    try {
      await fetch(`/api/claims/${id}/link-evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidenceId: selectedEvidence,
          relevanceNote,
        }),
      })
      setLinkEvidenceOpen(false)
      setSelectedEvidence(null)
      setRelevanceNote('')
      fetchClaim()
    } catch (error) {
      console.error('Error linking evidence:', error)
    }
  }

  async function unlinkEvidence(evidenceId: string) {
    try {
      await fetch(`/api/claims/${id}/link-evidence?evidenceId=${evidenceId}`, {
        method: 'DELETE',
      })
      fetchClaim()
    } catch (error) {
      console.error('Error unlinking evidence:', error)
    }
  }

  async function submitForReview() {
    try {
      await fetch(`/api/claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready_review' }),
      })
      fetchClaim()
    } catch (error) {
      console.error('Error submitting for review:', error)
    }
  }

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-background text-foreground">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!claim) {
    return (
      <div className="p-6">
        <p>Claim not found</p>
        <Button asChild className="mt-4">
          <Link href="/claims">Back to Claims</Link>
        </Button>
      </div>
    )
  }

  const StatusIcon = STATUS_CONFIG[claim.status].icon
  const linkedEvidenceIds = new Set(claim.claim_evidence_links.map(l => l.evidence.id))
  const unlinkedEvidence = availableEvidence.filter(e => !linkedEvidenceIds.has(e.id))

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/claims">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Badge className={STATUS_CONFIG[claim.status].color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {STATUS_CONFIG[claim.status].label}
            </Badge>
            {claim.risk_score > 0 && (
              <Badge variant="outline" className={
                claim.risk_score > 50 ? 'bg-red-50 text-destructive' :
                claim.risk_score > 25 ? 'bg-yellow-50 text-amber-500' :
                'bg-green-50 text-emerald-500'
              }>
                Risk Score: {claim.risk_score}
              </Badge>
            )}
          </div>
        </div>
        <Button onClick={revalidateClaim} disabled={validating} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${validating ? 'animate-spin' : ''}`} />
          Re-validate
        </Button>
      </div>

      {/* Main Claim */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{claim.text}</CardTitle>
          {claim.original_text && (
            <CardDescription>
              Original: {claim.original_text}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Badge variant="outline">{claim.claim_type} claim</Badge>
            <Badge variant="outline">{claim.category}</Badge>
            {claim.required_evidence_tier && (
              <Badge variant="outline">
                Requires Tier {claim.required_evidence_tier} Evidence
              </Badge>
            )}
          </div>

          {/* Reason Codes */}
          {claim.reason_codes && claim.reason_codes.length > 0 && (
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-yellow-800">Validation Issues</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {claim.reason_codes.map((code, i) => (
                  <Badge key={i} variant="secondary">
                    {code.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suggested Rewrites */}
      {claim.suggested_rewrites && claim.suggested_rewrites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Suggested Rewrites
            </CardTitle>
            <CardDescription>
              AI-generated compliant alternatives
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {claim.suggested_rewrites.map((rewrite, i) => (
              <div key={i} className="p-3 bg-muted rounded-lg flex items-start justify-between gap-4">
                <p className="text-sm">{rewrite}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await fetch(`/api/claims/${id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: rewrite }),
                    })
                    fetchClaim()
                  }}
                >
                  Use This
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Linked Evidence */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="w-5 h-5" />
              Linked Evidence
            </CardTitle>
            <CardDescription>
              Proof supporting this claim
            </CardDescription>
          </div>
          <Dialog open={linkEvidenceOpen} onOpenChange={setLinkEvidenceOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Link Evidence
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link Evidence</DialogTitle>
                <DialogDescription>
                  Select evidence to support this claim
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  {unlinkedEvidence.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No available evidence. Add evidence in the Evidence Library.
                    </p>
                  ) : (
                    unlinkedEvidence.map((evidence) => (
                      <button
                        key={evidence.id}
                        onClick={() => setSelectedEvidence(evidence.id)}
                        className={`w-full p-3 rounded-lg border text-left transition-all ${
                          selectedEvidence === evidence.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{evidence.title}</span>
                          <Badge variant="outline">Tier {evidence.tier}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{evidence.type}</span>
                      </button>
                    ))
                  )}
                </div>
                {selectedEvidence && (
                  <div>
                    <Label>Relevance Note (optional)</Label>
                    <Textarea
                      placeholder="Explain how this evidence supports the claim..."
                      value={relevanceNote}
                      onChange={(e) => setRelevanceNote(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLinkEvidenceOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={linkEvidence} disabled={!selectedEvidence}>
                  Link Evidence
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {claim.claim_evidence_links.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No evidence linked yet
            </p>
          ) : (
            <div className="space-y-3">
              {claim.claim_evidence_links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span className="font-medium">{link.evidence.title}</span>
                      <Badge variant="outline" className="text-xs">
                        Tier {link.evidence.tier}
                      </Badge>
                    </div>
                    {link.relevance_note && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {link.relevance_note}
                      </p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => unlinkEvidence(link.evidence.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval History */}
      {claim.approvals && claim.approvals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Approval History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {claim.approvals.map((approval) => (
                <div key={approval.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <Badge className={
                    approval.decision === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                    approval.decision === 'rejected' ? 'bg-destructive/10 text-destructive' :
                    'bg-amber-500/10 text-amber-500'
                  }>
                    {approval.decision}
                  </Badge>
                  <div className="flex-1">
                    {approval.comment && <p className="text-sm">{approval.comment}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(approval.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {claim.status === 'needs_proof' && claim.claim_evidence_links.length > 0 && (
          <Button onClick={submitForReview}>
            Submit for Review
          </Button>
        )}
        {claim.status === 'blocked' && claim.suggested_rewrites.length > 0 && (
          <p className="text-sm text-muted-foreground">
            This claim is blocked. Use one of the suggested rewrites above.
          </p>
        )}
      </div>
    </div>
  )
}
