"use client"

import Link from "next/link"
import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Search,
  CheckCircle2,
  ShieldAlert,
  Info,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Link2,
  Check,
  RefreshCw,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type ClaimRiskLevel = "safe" | "needs_evidence" | "risky" | "blocked"

interface ClaimsApiItem {
  id: string
  text: string
  category: string
  status: string
  riskScore: number
  reasonCodes: string[]
  suggestedRewrites: string[]
  evidence: Array<{ id: string }>
  lastValidated: string
}

interface ClaimRow {
  id: string
  text: string
  riskLevel: ClaimRiskLevel
  category: string
  status: string
  lastValidated: string
  riskReasoning?: string
  suggestedRewrite?: string
  linkedEvidenceCount: number
}

function mapClaimRiskLevel(claim: ClaimsApiItem): ClaimRiskLevel {
  if (claim.status === "approved") return "safe"
  if (claim.status === "needs_proof") return "needs_evidence"
  if (claim.status === "blocked" || claim.status === "rejected") return "blocked"
  if (claim.riskScore >= 60) return "blocked"
  if (claim.riskScore >= 35) return "risky"
  return "needs_evidence"
}

function getRiskReasoning(claim: ClaimsApiItem): string | undefined {
  if (claim.reasonCodes.length === 0) return undefined
  return claim.reasonCodes
    .map((reasonCode) => reasonCode.replaceAll("_", " ").toLowerCase())
    .join(", ")
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ")
}

function toClaimRow(claim: ClaimsApiItem): ClaimRow {
  return {
    id: claim.id,
    text: claim.text,
    riskLevel: mapClaimRiskLevel(claim),
    category: claim.category,
    status: claim.status,
    lastValidated: claim.lastValidated,
    riskReasoning: getRiskReasoning(claim),
    suggestedRewrite: claim.suggestedRewrites[0],
    linkedEvidenceCount: claim.evidence.length,
  }
}

function RiskIcon({ level }: { level: ClaimRiskLevel }) {
  switch (level) {
    case "safe":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    case "needs_evidence":
      return <Info className="w-4 h-4 text-amber-500" />
    case "risky":
      return <AlertTriangle className="w-4 h-4 text-orange-500" />
    case "blocked":
      return <ShieldAlert className="w-4 h-4 text-red-500" />
  }
}

function RiskBadge({ level }: { level: ClaimRiskLevel }) {
  switch (level) {
    case "safe":
      return <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">Ready</Badge>
    case "needs_evidence":
      return <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-500">Needs proof</Badge>
    case "risky":
      return <Badge variant="outline" className="border-orange-500/20 bg-orange-500/10 text-orange-600">Risky</Badge>
    case "blocked":
      return <Badge variant="outline" className="border-red-500/20 bg-red-500/10 text-destructive">Blocked</Badge>
  }
}

export default function ClaimsManagementPage() {
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [mutatingClaimId, setMutatingClaimId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchClaims = async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      const response = await fetch("/api/claims?limit=250")
      const data = (await response.json()) as { claims?: ClaimsApiItem[]; error?: string }

      if (!response.ok) {
        throw new Error(data.error || "Failed to load claims")
      }

      setClaims((data.claims || []).map(toClaimRow))
      setError(null)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load claims")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void fetchClaims()
  }, [])

  const toggleRow = (id: string) => {
    setExpandedRows((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleAcceptRewrite = async (id: string, rewrite: string) => {
    setMutatingClaimId(id)
    try {
      const response = await fetch(`/api/claims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rewrite, status: "draft" }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Failed to update claim" }))
        throw new Error(data.error || "Failed to update claim")
      }

      await fetch(`/api/claims/${id}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generateRewrites: true }),
      })

      await fetchClaims(false)
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to accept rewrite")
    } finally {
      setMutatingClaimId(null)
    }
  }

  const handleAcceptAllRewrites = async () => {
    const rewritableClaims = claims.filter((claim) => claim.suggestedRewrite)
    if (rewritableClaims.length === 0) {
      return
    }

    setRefreshing(true)
    try {
      await Promise.all(
        rewritableClaims.map((claim) =>
          fetch(`/api/claims/${claim.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: claim.suggestedRewrite, status: "draft" }),
          })
        )
      )

      await Promise.all(
        rewritableClaims.map((claim) =>
          fetch(`/api/claims/${claim.id}/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ generateRewrites: true }),
          })
        )
      )

      await fetchClaims(false)
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to accept rewrites")
      setRefreshing(false)
    }
  }

  const handleRevalidateAll = async () => {
    setRefreshing(true)
    try {
      await Promise.all(
        claims.map((claim) =>
          fetch(`/api/claims/${claim.id}/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ generateRewrites: true }),
          })
        )
      )

      await fetchClaims(false)
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to re-validate claims")
      setRefreshing(false)
    }
  }

  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      const matchesSearch =
        claim.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        claim.category.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = filter === "all" || claim.riskLevel === filter
      return matchesSearch && matchesFilter
    })
  }, [claims, filter, searchQuery])

  const stats = {
    total: claims.length,
    safe: claims.filter((claim) => claim.riskLevel === "safe").length,
    needsEvidence: claims.filter((claim) => claim.riskLevel === "needs_evidence").length,
    risky: claims.filter((claim) => claim.riskLevel === "risky").length,
    blocked: claims.filter((claim) => claim.riskLevel === "blocked").length,
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 bg-background min-h-screen text-foreground">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Claims review</h1>
          <p className="text-muted-foreground mt-1">
            Review the claims linked to your workspace, see what is safe to ship, and turn weak copy into evidence-backed language.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => void handleAcceptAllRewrites()}
            disabled={refreshing || loading || claims.every((claim) => !claim.suggestedRewrite)}
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-emerald-500" />}
            Apply Safer Rewrites
          </Button>
          <Button
            className="gap-2"
            onClick={() => void handleRevalidateAll()}
            disabled={refreshing || loading || claims.length === 0}
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Recheck All Claims
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-card border-border/50">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mt-1">Total Claims</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <div className="text-2xl font-bold text-emerald-600">{stats.safe}</div>
            <div className="text-[10px] uppercase font-bold text-emerald-600/80 tracking-wider mt-1">Ready</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <div className="text-2xl font-bold text-amber-500">{stats.needsEvidence}</div>
            <div className="text-[10px] uppercase font-bold text-amber-500/80 tracking-wider mt-1">Needs proof</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <div className="text-2xl font-bold text-orange-600">{stats.risky}</div>
            <div className="text-[10px] uppercase font-bold text-orange-600/80 tracking-wider mt-1">Risky</div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <div className="text-2xl font-bold text-destructive">{stats.blocked}</div>
            <div className="text-[10px] uppercase font-bold text-destructive/80 tracking-wider mt-1">Blocked</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search claims or categories..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10 bg-card border-border/50"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {["all", "safe", "needs_evidence", "risky", "blocked"].map((value) => (
            <Badge
              key={value}
              variant={filter === value ? "default" : "secondary"}
              className="cursor-pointer text-[10px] uppercase tracking-wider font-mono hover:bg-primary/80"
              onClick={() => setFilter(value)}
            >
              {value.replace("_", " ")}
            </Badge>
          ))}
        </div>
      </div>

      <Card className="border-border/50 overflow-hidden bg-card">
        <Table>
            <TableHeader className="bg-muted/20">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40px]" />
                <TableHead className="w-[380px]">Claim</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last checked</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading claims
                  </div>
                </TableCell>
              </TableRow>
            ) : null}

            {!loading && filteredClaims.map((claim) => (
              <React.Fragment key={claim.id}>
                <TableRow
                  className={cn(
                    "cursor-pointer transition-colors",
                    expandedRows.has(claim.id) ? "bg-muted/10" : "hover:bg-muted/20"
                  )}
                  onClick={() => toggleRow(claim.id)}
                >
                  <TableCell>
                    {expandedRows.has(claim.id) ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <RiskIcon level={claim.riskLevel} />
                      <span className="line-clamp-1">{claim.text}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RiskBadge level={claim.riskLevel} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-mono uppercase bg-background">
                      {claim.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">
                    {formatStatus(claim.status)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {claim.lastValidated}
                  </TableCell>
                </TableRow>

                <AnimatePresence>
                  {expandedRows.has(claim.id) ? (
                    <TableRow className="bg-muted/5 hover:bg-muted/5 border-b">
                      <TableCell colSpan={6} className="p-0">
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-6 pl-[56px] grid grid-cols-1 md:grid-cols-2 gap-8 border-l-2 border-primary/20 ml-[20px] my-2">
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Full Claim Text</h4>
                                <p className="text-base font-medium leading-relaxed bg-background p-3 rounded-lg border border-border/50">
                                  "{claim.text}"
                                </p>
                              </div>

                              {claim.riskReasoning ? (
                                <div>
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-orange-600/80 mb-2 flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Why this needs review
                                  </h4>
                                  <p className="text-sm text-muted-foreground bg-orange-500/5 p-3 rounded-lg border border-orange-500/10">
                                    {claim.riskReasoning}
                                  </p>
                                </div>
                              ) : null}
                            </div>

                            <div className="space-y-6">
                              {claim.suggestedRewrite ? (
                                <div>
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-500/80 mb-2 flex items-center gap-1.5">
                                    <Check className="w-3.5 h-3.5" />
                                    Safer rewrite
                                  </h4>
                                  <div className="bg-blue-500/5 p-3 rounded-lg border border-blue-500/10 space-y-3">
                                    <p className="text-sm font-medium italic text-foreground">
                                      "{claim.suggestedRewrite}"
                                    </p>
                                    <Button
                                      size="sm"
                                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        void handleAcceptRewrite(claim.id, claim.suggestedRewrite!)
                                      }}
                                      disabled={mutatingClaimId === claim.id}
                                    >
                                      {mutatingClaimId === claim.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                      Use This Rewrite
                                    </Button>
                                  </div>
                                </div>
                              ) : null}

                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                                  <Link2 className="w-3.5 h-3.5" />
                                  Evidence
                                </h4>
                                <div className="bg-background p-3 rounded-lg border border-border/50 flex items-center justify-between gap-3">
                                  <span className="text-sm">
                                    {claim.linkedEvidenceCount > 0
                                      ? `${claim.linkedEvidenceCount} evidence item${claim.linkedEvidenceCount === 1 ? "" : "s"} linked`
                                      : "No proof linked yet"}
                                  </span>
                                  <Button asChild variant="outline" size="sm" onClick={(event) => event.stopPropagation()}>
                                    <Link href={`/claims/${claim.id}`}>
                                      Open Claim
                                      <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </AnimatePresence>
              </React.Fragment>
            ))}

            {!loading && filteredClaims.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No claims match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
