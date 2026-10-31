"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Shield, ShieldAlert, CheckCircle2, Info, AlertTriangle, AlertCircle, Sparkles, ChevronDown, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export interface ClaimData {
  id: string
  text: string
  riskLevel: 'safe' | 'needs_evidence' | 'risky' | 'blocked'
  category: string
  isFabricated?: boolean
  evidenceStatus?: string
  suggestedRewrite?: string
}

export interface ComplianceSidebarProps {
  complianceSummary: {
    grade: string
    totalClaims: number
    safe: number
    needsEvidence: number
    risky: number
    blocked: number
    slopViolations: number
    fabricatedClaims: number
  }
  claims: ClaimData[]
  onClaimSelect: (claimId: string) => void
  selectedClaimId?: string
}

function getGradeColor(grade: string) {
  if (['A', 'B'].includes(grade)) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
  if (grade === 'C') return "text-amber-500 bg-amber-500/10 border-amber-500/20"
  return "text-red-500 bg-red-500/10 border-red-500/20"
}

export function ComplianceSidebar({
  complianceSummary,
  claims,
  onClaimSelect,
  selectedClaimId
}: ComplianceSidebarProps) {
  const [filter, setFilter] = React.useState<string>("all")
  
  const filteredClaims = React.useMemo(() => {
    if (filter === "all") return claims
    if (filter === "fabricated") return claims.filter(c => c.isFabricated)
    return claims.filter(c => c.riskLevel === filter)
  }, [claims, filter])

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="flex flex-col h-full bg-background border-l border-border w-full max-w-sm"
    >
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Header & Score */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Claims status</h3>
              <div className="flex items-center gap-2">
                <div className={cn("text-4xl font-bold flex items-center justify-center h-16 w-16 rounded-xl border", getGradeColor(complianceSummary.grade))}>
                  {complianceSummary.grade}
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">
                    {complianceSummary.safe} of {complianceSummary.totalClaims} ready to ship
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Overall risk level: {['A', 'B'].includes(complianceSummary.grade) ? 'Low' : complianceSummary.grade === 'C' ? 'Medium' : 'High'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Bar */}
          <div className="space-y-2">
            <div className="flex w-full h-2 rounded-full overflow-hidden bg-muted">
              <div style={{ width: `${(complianceSummary.safe / complianceSummary.totalClaims) * 100}%` }} className="bg-emerald-500 transition-all" />
              <div style={{ width: `${(complianceSummary.needsEvidence / complianceSummary.totalClaims) * 100}%` }} className="bg-amber-500 transition-all" />
              <div style={{ width: `${(complianceSummary.risky / complianceSummary.totalClaims) * 100}%` }} className="bg-orange-500 transition-all" />
              <div style={{ width: `${(complianceSummary.blocked / complianceSummary.totalClaims) * 100}%` }} className="bg-red-500 transition-all" />
            </div>
            <div className="flex justify-between text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
              <span className="text-emerald-500">{complianceSummary.safe} Ready</span>
              {complianceSummary.needsEvidence > 0 && <span className="text-amber-500">{complianceSummary.needsEvidence} Needs proof</span>}
              {complianceSummary.risky > 0 && <span className="text-orange-500">{complianceSummary.risky} Risky</span>}
              {complianceSummary.blocked > 0 && <span className="text-red-500">{complianceSummary.blocked} Blocked</span>}
            </div>
          </div>

          {/* AI Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-muted/50 border-none shadow-none">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  Quality flags
                </div>
                <div className="text-sm font-semibold">
                  {complianceSummary.slopViolations === 0 
                    ? <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> 0 violations</span>
                    : <span className="text-amber-500">{complianceSummary.slopViolations} violations</span>}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/50 border-none shadow-none">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ShieldAlert className="h-3 w-3" />
                  Generated claims
                </div>
                <div className="text-sm font-semibold">
                  {complianceSummary.fabricatedClaims === 0 
                    ? <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> None</span>
                    : <span className="text-blue-500">{complianceSummary.fabricatedClaims} generated</span>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Claims List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Claim review</h3>
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              <Badge 
                variant={filter === "all" ? "default" : "secondary"}
                className="cursor-pointer text-[10px] uppercase tracking-wider font-mono"
                onClick={() => setFilter("all")}
              >
                All
              </Badge>
              <Badge 
                variant={filter === "safe" ? "default" : "secondary"}
                className="cursor-pointer text-[10px] uppercase tracking-wider font-mono"
                onClick={() => setFilter("safe")}
              >
                Ready
              </Badge>
              <Badge 
                variant={filter === "needs_evidence" ? "default" : "secondary"}
                className="cursor-pointer text-[10px] uppercase tracking-wider font-mono"
                onClick={() => setFilter("needs_evidence")}
              >
                Needs proof
              </Badge>
              <Badge 
                variant={filter === "risky" ? "default" : "secondary"}
                className="cursor-pointer text-[10px] uppercase tracking-wider font-mono"
                onClick={() => setFilter("risky")}
              >
                Risky
              </Badge>
              <Badge 
                variant={filter === "fabricated" ? "default" : "secondary"}
                className="cursor-pointer text-[10px] uppercase tracking-wider font-mono"
                onClick={() => setFilter("fabricated")}
              >
                Generated
              </Badge>
            </div>

            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredClaims.map((claim) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={claim.id}
                    onClick={() => onClaimSelect(claim.id)}
                    className={cn(
                      "p-3 rounded-xl border text-sm cursor-pointer transition-colors duration-200",
                      selectedClaimId === claim.id 
                        ? "border-primary bg-primary/5 shadow-sm" 
                        : "border-border/50 bg-card hover:border-primary/30 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 shrink-0">
                        {claim.isFabricated ? (
                          <Sparkles className="h-4 w-4 text-blue-500" />
                        ) : claim.riskLevel === 'safe' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : claim.riskLevel === 'needs_evidence' ? (
                          <Info className="h-4 w-4 text-amber-500" />
                        ) : claim.riskLevel === 'risky' ? (
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {claim.category}
                          </span>
                          {claim.isFabricated && (
                            <span className="bg-blue-500/10 text-blue-500 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                              AI Generated
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 leading-relaxed text-foreground/90">
                          {claim.text}
                        </p>
                        {selectedClaimId === claim.id && claim.suggestedRewrite && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-2 pt-2 border-t border-border/50"
                          >
                            <span className="text-xs font-medium text-muted-foreground mb-1 block">Safer rewrite:</span>
                            <p className="text-xs italic bg-muted p-2 rounded-md">
                              "{claim.suggestedRewrite}"
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Button size="sm" variant="outline" className="h-7 text-xs px-2 w-full">Use rewrite</Button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {filteredClaims.length === 0 && (
                  <div className="text-center p-8 text-sm text-muted-foreground border border-dashed rounded-xl">
                    No claims match this filter.
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </ScrollArea>
    </motion.div>
  )
}
