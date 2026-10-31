"use client"

import type { GenerationPlan, ProofStrategy, DecisionStage } from "@/lib/planning/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCcw, Route, ShieldCheck, Users } from "lucide-react"

const DECISION_STAGES: Array<{ value: DecisionStage; label: string }> = [
  { value: "discover", label: "Discover" },
  { value: "evaluate", label: "Evaluate" },
  { value: "justify", label: "Justify" },
  { value: "convert", label: "Convert" },
]

const PROOF_STRATEGIES: Array<{ value: ProofStrategy; label: string }> = [
  { value: "product-proof", label: "Product proof" },
  { value: "customer-proof", label: "Customer proof" },
  { value: "evidence-stack", label: "Evidence stack" },
  { value: "compliance-proof", label: "Compliance proof" },
]

interface GenerationPlanStepProps {
  plan: GenerationPlan | null
  loading?: boolean
  error?: string | null
  title?: string
  description?: string
  compact?: boolean
  onRefresh?: () => void
  onPlanChange?: (plan: GenerationPlan) => void
}

export function GenerationPlanStep({
  plan,
  loading = false,
  error,
  title = "Review plan",
  description = "Composer distilled the brief into a compact generation plan before rendering assets.",
  compact = false,
  onRefresh,
  onPlanChange,
}: GenerationPlanStepProps) {
  if (loading) {
    return (
      <Card className="border-border/60 bg-card/40">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Building a plan from brand, Brain context, proof needs, and route options...
        </CardContent>
      </Card>
    )
  }

  if (!plan) {
    return (
      <Card className="border-border/60 bg-card/40">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {error || "No plan available yet."}
        </CardContent>
      </Card>
    )
  }

  const selectedRoute = plan.creativeRoutes.find((route) => route.id === plan.selectedRoute) ?? plan.creativeRoutes[0]

  const updatePlan = (next: GenerationPlan) => {
    onPlanChange?.(next)
  }

  return (
    <Card className="border-border/60 bg-card/40 overflow-hidden">
      <CardHeader className="border-b border-border/50 bg-muted/10">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {onRefresh ? (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refresh plan
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-background/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Users className="h-4 w-4" /> Actor
            </div>
            <p className="font-medium text-foreground">{plan.primaryActor.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{plan.primaryActor.goal}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Route className="h-4 w-4" /> Decision
            </div>
            <p className="font-medium text-foreground">{plan.objective}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Stage: <span className="capitalize">{plan.decisionStage}</span>
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Proof
            </div>
            <p className="font-medium text-foreground">{selectedRoute.proofPosture} posture</p>
            <p className="mt-1 text-sm text-muted-foreground capitalize">
              Strategy: {plan.proofStrategy.replace("-", " ")}
            </p>
          </div>
        </div>

        {!compact ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Decision stage</div>
              <div className="grid grid-cols-2 gap-2">
                {DECISION_STAGES.map((stage) => (
                  <button
                    key={stage.value}
                    type="button"
                    onClick={() => updatePlan({ ...plan, decisionStage: stage.value })}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      plan.decisionStage === stage.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/50 bg-background hover:border-primary/40"
                    }`}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Proof strategy</div>
              <div className="grid gap-2">
                {PROOF_STRATEGIES.map((strategy) => (
                  <button
                    key={strategy.value}
                    type="button"
                    onClick={() => updatePlan({ ...plan, proofStrategy: strategy.value })}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      plan.proofStrategy === strategy.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/50 bg-background hover:border-primary/40"
                    }`}
                  >
                    {strategy.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-background/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Proof must appear</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {plan.constraints.proofBlockers.length > 0 ? (
                plan.constraints.proofBlockers.map((item) => (
                  <Badge key={item} variant="outline" className="bg-background">
                    {item}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No explicit blockers.</span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Composer will avoid</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {plan.constraints.visualBans.map((item) => (
                <Badge key={item} variant="outline" className="bg-background">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Creative routes</div>
          <div className="grid gap-3 lg:grid-cols-3">
            {plan.creativeRoutes.map((route) => {
              const active = route.id === plan.selectedRoute
              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => updatePlan({ ...plan, selectedRoute: route.id })}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    active
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border/50 bg-background/70 hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-foreground">{route.label}</div>
                    <Badge variant="outline" className="bg-background/70">
                      {Math.round(route.confidence * 100)}%
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{route.summary}</p>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div>Headline angle: {route.headlineAngle}</div>
                    <div>Proof posture: {route.proofPosture}</div>
                    <div>Visual bias: {route.visualBias}</div>
                    <div>Restraint: {route.restraint}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
