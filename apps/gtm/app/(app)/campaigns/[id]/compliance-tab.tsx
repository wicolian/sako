"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Link2,
  Upload,
  FileText,
  File,
  ExternalLink,
  Eye,
  Plus,
  Search,
  Filter,
  Loader2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface Claim {
  id: string
  text: string
  status: "approved" | "warning" | "error" | "pending"
  risk_level?: "low" | "medium" | "high"
  evidence_id?: string
  evidence?: Evidence
  suggestion?: string
  rewrite_suggestion?: string
}

interface Evidence {
  id: string
  title: string
  content?: string
  source_type: 'case_study' | 'certification' | 'statistic' | 'testimonial' | 'document'
  source_url?: string
  created_at: string
  used_by_count?: number
}

interface ComplianceTabProps {
  campaignId: string
  workspaceId: string
}

export function ComplianceTab({ campaignId, workspaceId }: ComplianceTabProps) {
  const [claims, setClaims] = useState<Claim[]>([])
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'warning' | 'error'>('all')

  const fetchData = useCallback(async () => {
    try {
      const [claimsRes, evidenceRes] = await Promise.all([
        fetch(`/api/claims?campaignId=${campaignId}`),
        fetch('/api/evidence'),
      ])

      if (claimsRes.ok) {
        const claimsData = await claimsRes.json()
        setClaims(claimsData.claims || [])
      }

      if (evidenceRes.ok) {
        const evidenceData = await evidenceRes.json()
        setEvidence(evidenceData.evidence || [])
      }
    } catch (error) {
      console.error('Failed to fetch compliance data:', error)
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const linkEvidence = async (claimId: string, evidenceId: string) => {
    try {
      await fetch(`/api/claims/${claimId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence_id: evidenceId }),
      })
      fetchData()
    } catch (error) {
      console.error('Failed to link evidence:', error)
    }
  }

  const filteredClaims = claims.filter((claim) => {
    if (filterStatus !== 'all' && claim.status !== filterStatus) return false
    if (searchQuery && !claim.text.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const stats = {
    approved: claims.filter((c) => c.status === 'approved').length,
    warning: claims.filter((c) => c.status === 'warning').length,
    error: claims.filter((c) => c.status === 'error').length,
  }

  const totalClaims = claims.length
  const compliancePercentage = totalClaims > 0 
    ? Math.round((stats.approved / totalClaims) * 100)
    : 100

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Compliance Summary Header */}
      <div className="px-6 py-4 border-b bg-card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {compliancePercentage >= 80 ? (
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              ) : compliancePercentage >= 50 ? (
                <ShieldAlert className="h-5 w-5 text-amber-500" />
              ) : (
                <ShieldX className="h-5 w-5 text-destructive" />
              )}
              Compliance Status
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {totalClaims === 0
                ? "No claims to review in this campaign"
                : stats.warning > 0
                ? `${stats.warning} claim${stats.warning > 1 ? "s" : ""} need supporting evidence`
                : stats.error > 0
                ? `${stats.error} claim${stats.error > 1 ? "s" : ""} need attention`
                : "All claims are validated"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm">
              <Sparkles className="h-4 w-4 mr-2" />
              Auto-validate
            </Button>
          </div>
        </div>

        {/* Progress and Stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-sm font-medium tabular-nums">
              {compliancePercentage}%
            </span>
            <Progress value={compliancePercentage} className="flex-1 h-2" />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-medium tabular-nums">{stats.approved}</span>
              <span className="text-muted-foreground">Supported</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="font-medium tabular-nums">{stats.warning}</span>
              <span className="text-muted-foreground">Needs Evidence</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-destructive" />
              <span className="font-medium tabular-nums">{stats.error}</span>
              <span className="text-muted-foreground">Blocked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Split Pane */}
      <div className="flex-1 grid grid-cols-2 divide-x overflow-hidden">
        {/* Claims Panel (Left) */}
        <div className="flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search claims..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setFilterStatus("all")}>
                    All Claims
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("warning")}>
                    Needs Evidence
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("error")}>
                    Blocked Only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredClaims.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No claims to review</p>
                  <p className="text-sm mt-1">
                    All claims in this campaign are compliant
                  </p>
                </div>
              ) : (
                filteredClaims.map((claim) => (
                  <ClaimCard
                    key={claim.id}
                    claim={claim}
                    isSelected={selectedClaim?.id === claim.id}
                    onClick={() => setSelectedClaim(claim)}
                    onLinkEvidence={() => setSelectedClaim(claim)}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Evidence Panel (Right) */}
        <div className="flex flex-col overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-medium">Evidence Library</h3>
              {selectedClaim && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select evidence to link to the selected claim
                </p>
              )}
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {evidence.length === 0 ? (
              <UploadDropzone />
            ) : (
              <>
                {/* Show linked evidence first when a claim is selected */}
                {selectedClaim && (
                  <div className="mb-4">
                    <p className="text-xs text-[var(--color-text-muted)] mb-2 uppercase tracking-wider">
                      Link evidence to selected claim
                    </p>
                  </div>
                )}
                {evidence.map((ev) => (
                  <EvidenceCard
                    key={ev.id}
                    evidence={ev}
                    isLinkable={!!selectedClaim}
                    onLink={() => selectedClaim && linkEvidence(selectedClaim.id, ev.id)}
                    onView={() => setSelectedEvidence(ev)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Evidence Detail Sheet */}
      <Sheet
        open={!!selectedEvidence}
        onOpenChange={() => setSelectedEvidence(null)}
      >
        <SheetContent className="w-[500px] sm:max-w-none">
          {selectedEvidence && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedEvidence.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {selectedEvidence.source_type.replace("_", " ")}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Uploaded{" "}
                    {new Date(selectedEvidence.created_at).toLocaleDateString()}
                  </span>
                </div>
                {selectedEvidence.content && (
                  <div className="p-4 bg-muted rounded-lg border">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedEvidence.content}
                    </p>
                  </div>
                )}
                {selectedEvidence.source_url && (
                  <Button variant="outline" className="w-full" asChild>
                    <a
                      href={selectedEvidence.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Source
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ClaimCard({
  claim,
  isSelected,
  onClick,
  onLinkEvidence,
}: {
  claim: Claim
  isSelected: boolean
  onClick: () => void
  onLinkEvidence: () => void
}) {
  const statusConfig = {
    approved: {
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      label: "Supported",
      badgeVariant: "default" as const,
    },
    warning: {
      icon: AlertTriangle,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      label: "Needs Evidence",
      badgeVariant: "secondary" as const,
    },
    error: {
      icon: XCircle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      label: "Blocked",
      badgeVariant: "destructive" as const,
    },
    pending: {
      icon: Loader2,
      color: "text-muted-foreground",
      bg: "bg-muted",
      label: "Pending",
      badgeVariant: "outline" as const,
    },
  }

  const { icon: StatusIcon, color, bg, label, badgeVariant } =
    statusConfig[claim.status]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "p-4 rounded-xl border cursor-pointer transition-all",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border bg-card hover:border-ring"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-1.5 rounded-lg shrink-0", bg)}>
          <StatusIcon className={cn("h-4 w-4", color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium mb-2 line-clamp-2">{claim.text}</p>
          <div className="flex items-center gap-2">
            <Badge variant={badgeVariant} className="text-[10px]">
              {label}
            </Badge>
            {claim.risk_level && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {claim.risk_level} risk
              </Badge>
            )}
            {claim.evidence && (
              <Badge variant="secondary" className="text-[10px]">
                <Link2 className="h-2.5 w-2.5 mr-1" />
                Evidence linked
              </Badge>
            )}
          </div>

          {/* Suggestion or Rewrite for blocked claims */}
          {claim.status === "error" && claim.rewrite_suggestion && (
            <div className="mt-3 p-3 bg-muted rounded-lg border">
              <p className="text-xs font-medium text-foreground mb-1">
                ✨ Suggested rewrite:
              </p>
              <p className="text-xs text-muted-foreground italic">
                "{claim.rewrite_suggestion}"
              </p>
              <Button size="sm" variant="outline" className="mt-2 h-6 text-xs">
                Apply Rewrite
              </Button>
            </div>
          )}

          {claim.suggestion && claim.status !== "error" && (
            <p className="text-xs text-muted-foreground mt-2">
              💡 {claim.suggestion}
            </p>
          )}
        </div>
      </div>

      {/* Link Evidence CTA for warning status */}
      {claim.status === "warning" && !claim.evidence && (
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-3"
          onClick={(e) => {
            e.stopPropagation()
            onLinkEvidence()
          }}
        >
          <Link2 className="h-4 w-4 mr-2" />
          Find Evidence
          <ArrowRight className="h-4 w-4 ml-auto" />
        </Button>
      )}

      {/* Fix Issue CTA for blocked claims */}
      {claim.status === "error" && !claim.rewrite_suggestion && (
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-3 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Compliant Version
        </Button>
      )}
    </motion.div>
  )
}

function EvidenceCard({
  evidence,
  isLinkable,
  onLink,
  onView,
}: {
  evidence: Evidence
  isLinkable: boolean
  onLink: () => void
  onView: () => void
}) {
  const typeIcons = {
    case_study: FileText,
    certification: CheckCircle2,
    statistic: File,
    testimonial: File,
    document: File,
  }

  const Icon = typeIcons[evidence.source_type] || File

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border border-border bg-card hover:border-ring transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{evidence.title}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {evidence.source_type.replace("_", " ")}
          </p>
          {evidence.used_by_count !== undefined && evidence.used_by_count > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Used by {evidence.used_by_count} claim
              {evidence.used_by_count > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="ghost" className="flex-1" onClick={onView}>
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
        {isLinkable && (
          <Button size="sm" className="flex-1" onClick={onLink}>
            <Link2 className="h-4 w-4 mr-2" />
            Link
          </Button>
        )}
      </div>
    </motion.div>
  )
}

function UploadDropzone() {
  return (
    <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-ring transition-colors cursor-pointer">
      <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-50" />
      <p className="font-medium mb-1">Upload Evidence</p>
      <p className="text-sm text-muted-foreground mb-4">
        Drag files here or click to browse
      </p>
      <p className="text-xs text-muted-foreground">
        Case studies, certifications, statistics, testimonials
      </p>
    </div>
  )
}
