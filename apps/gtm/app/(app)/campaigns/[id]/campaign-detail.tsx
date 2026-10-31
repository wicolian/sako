"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileText,
  Layout,
  Send,
  Zap,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TooltipProvider } from "@/components/ui/tooltip"
import type {
  Campaign,
  Message,
  Angle,
  PageBlock,
  FollowupFlow,
} from "@/lib/supabase/types"

import { ExportActions } from "@/components/campaigns/export-actions"
import { ComplianceSidebar, ClaimData } from "@/components/campaigns/compliance-sidebar"
import { AssetCard } from "@/components/campaigns/asset-card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { buildReviewSignals, recommendReviewActions } from "@/lib/planning/review-signals"
import { GenerationPlanSchema, type ReviewActionId } from "@/lib/planning/types"

// Import original tabs
import { MessagesTab } from "./tabs/messages-tab"
import { PageBuilderTab } from "./tabs/page-builder-tab"
import { PublishTab } from "./tabs/publish-tab"

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  ready: "outline",
  published: "default",
  running: "default",
  archived: "secondary",
  escalated: "destructive",
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  ready: "Ready to publish",
  published: "Published",
  running: "Running",
  archived: "Archived",
  escalated: "Escalated",
}

interface CampaignDetailProps {
  campaign: Campaign
  messages: Message[]
  angles: Angle[]
  pageBlocks: PageBlock[]
  followupFlow: FollowupFlow | null
  claims?: ClaimData[]
}

function getComplianceGrade(claims: ClaimData[]): string {
  if (claims.length === 0) return 'N/A'
  if (claims.some((claim) => claim.riskLevel === 'blocked')) return 'D'
  if (claims.some((claim) => claim.riskLevel === 'risky')) return 'C'
  if (claims.some((claim) => claim.riskLevel === 'needs_evidence')) return 'B'
  return 'A'
}

function getComplianceHeadline(summary: {
  totalClaims: number
  needsEvidence: number
  risky: number
  blocked: number
}): string {
  if (summary.totalClaims === 0) return "Claims not linked yet"
  if (summary.blocked > 0) return `${summary.blocked} blocked claim${summary.blocked === 1 ? "" : "s"}`
  if (summary.risky + summary.needsEvidence > 0) {
    const totalNeedsReview = summary.risky + summary.needsEvidence
    return `${totalNeedsReview} claim${totalNeedsReview === 1 ? "" : "s"} need review`
  }
  return "Claims ready"
}

export function CampaignDetail({
  campaign,
  messages,
  angles,
  pageBlocks,
  followupFlow,
  claims = [],
}: CampaignDetailProps) {
  const router = useRouter()
  
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedClaimId, setSelectedClaimId] = useState<string | undefined>()
  const [reviewLoading, setReviewLoading] = useState<{
    assetType: "landing-page" | "social" | "email" | null
    action: ReviewActionId | null
  }>({ assetType: null, action: null })

  const [editName, setEditName] = useState(campaign.name)
  const [editAudience, setEditAudience] = useState(campaign.audience ?? "")
  const [editGoal, setEditGoal] = useState(campaign.goal ?? "")
  const [editOffer, setEditOffer] = useState(campaign.offer ?? "")
  const [editCta, setEditCta] = useState(campaign.cta ?? "")

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          audience: editAudience,
          goal: editGoal,
          offer: editOffer,
          cta: editCta,
        }),
      })
      if (response.ok) {
        setIsEditOpen(false)
        router.refresh()
      }
    } catch (error) {
      console.error('Error saving campaign:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, { method: 'DELETE' })
      if (response.ok) router.push('/campaigns')
    } catch (error) {
      console.error('Error deleting campaign:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const complianceSummary = {
    grade: getComplianceGrade(claims),
    totalClaims: claims.length,
    safe: claims.filter(c => c.riskLevel === 'safe').length,
    needsEvidence: claims.filter(c => c.riskLevel === 'needs_evidence').length,
    risky: claims.filter(c => c.riskLevel === 'risky').length,
    blocked: claims.filter(c => c.riskLevel === 'blocked').length,
    slopViolations: 0,
    fabricatedClaims: claims.filter(c => c.isFabricated).length,
  }

  const landingPageContent = pageBlocks.length > 0
    ? pageBlocks.map((block) => JSON.stringify(block.props)).join('\n\n')
    : 'No landing page blocks generated yet.'
  const socialContent = messages.filter((message) => message.type !== 'supporting').map((message) => message.text).join('\n\n') || 'No social assets generated yet.'
  const emailContent = messages.filter((message) => message.type === 'supporting').map((message) => message.text).join('\n\n') || 'No email assets generated yet.'
  const complianceLabel = getComplianceHeadline(complianceSummary)
  const complianceTone = complianceSummary.blocked > 0
    ? "bg-red-500/10 border-red-500/20 text-destructive"
    : complianceSummary.risky + complianceSummary.needsEvidence > 0
      ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
  const generatedAssetCount = [
    pageBlocks.length > 0,
    messages.some((message) => message.type !== 'supporting'),
    messages.some((message) => message.type === 'supporting'),
  ].filter(Boolean).length
  const generationPlan = useMemo(() => {
    const constraints =
      campaign.constraints && typeof campaign.constraints === "object"
        ? (campaign.constraints as Record<string, unknown>)
        : {}
    const parsed = GenerationPlanSchema.safeParse(constraints.generation_plan)
    return parsed.success ? parsed.data : null
  }, [campaign.constraints])
  const landingSignals =
    generationPlan && landingPageContent !== 'No landing page blocks generated yet.'
      ? buildReviewSignals("landing-page", landingPageContent, generationPlan)
      : []
  const socialSignals =
    generationPlan && socialContent !== 'No social assets generated yet.'
      ? buildReviewSignals("social", socialContent, generationPlan)
      : []
  const emailSignals =
    generationPlan && emailContent !== 'No email assets generated yet.'
      ? buildReviewSignals("email", emailContent, generationPlan)
      : []

  const runReviewAction = async (
    assetType: "landing-page" | "social" | "email",
    action?: ReviewActionId,
  ) => {
    if (!generationPlan) return

    setReviewLoading({ assetType, action: action ?? null })
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/assets/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType,
          plan: generationPlan,
          reviewAction: action,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to regenerate asset")
      }

      router.push(`/campaigns/${campaign.id}/assets`)
    } catch (error) {
      console.error("Error regenerating asset:", error)
    } finally {
      setReviewLoading({ assetType: null, action: null })
    }
  }
  
  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
        {/* Top Header */}
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl z-20 shrink-0 relative">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-primary/50 to-emerald-500/50" />
          <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild className="shrink-0 h-9 w-9 bg-muted/50 hover:bg-muted">
                <Link href="/campaigns">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="h-6 w-px bg-border/50" />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold tracking-tight">{campaign.name}</h1>
                  <Badge variant={statusColors[campaign.status] || "outline"} className="capitalize bg-background/50 backdrop-blur">
                    {statusLabels[campaign.status] || campaign.status}
                  </Badge>
                  <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${complianceTone}`}>
                    {complianceLabel}
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generated campaign assets grounded in your brand context, with claim review visible before anything ships.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <ExportActions 
                onExportMarkdownZip={() => {}}
                onExportHtmlZip={() => {}}
                onExportBrief={() => {}}
                onCopyAll={() => {}}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit Details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsDeleteOpen(true)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Campaign
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="grid gap-4 border-b border-border/50 bg-card/20 px-6 py-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Generated assets</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{generatedAssetCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">Landing page, social copy, and email assets in one view.</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Claims review</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{claims.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {claims.length > 0
                ? `${complianceSummary.safe} ready, ${complianceSummary.needsEvidence + complianceSummary.risky + complianceSummary.blocked} still need attention.`
                : "This campaign does not have linked claims yet."}
            </p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Next step</p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {complianceSummary.blocked > 0
                ? "Fix blocked claims"
                : campaign.status === "ready"
                  ? "Choose a ship path"
                  : "Review assets and claims"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Move from overview to landing page, then use Ship for direct deploy, export-only handoff, or manual package download.
            </p>
          </div>
        </div>

        {/* Main Interface */}
        <Tabs defaultValue="assets" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-2 border-b border-border/50 bg-card/20 backdrop-blur-sm z-10 shrink-0">
            <TabsList className="bg-muted/50 border border-border/50 p-1 w-full justify-start overflow-x-auto h-auto">
              <TabsTrigger value="assets" className="gap-2 py-2 data-[state=active]:bg-card/80 data-[state=active]:shadow-sm">
                <Zap className="h-4 w-4" /> Overview
              </TabsTrigger>
              <TabsTrigger value="builder" className="gap-2 py-2 data-[state=active]:bg-card/80 data-[state=active]:shadow-sm">
                <Layout className="h-4 w-4" /> Landing Page
              </TabsTrigger>
              <TabsTrigger value="publish" className="gap-2 py-2 data-[state=active]:bg-card/80 data-[state=active]:shadow-sm">
                <Send className="h-4 w-4" /> Ship
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-2 py-2 data-[state=active]:bg-card/80 data-[state=active]:shadow-sm">
                <FileText className="h-4 w-4" /> Copy
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            {/* Tab 1: Visual Assets & Compliance (The 2-panel view) */}
            <TabsContent value="assets" className="h-full m-0 data-[state=active]:flex">
              {/* Left Panel: Assets (70%) */}
              <div className="flex-1 overflow-y-auto bg-muted/10 p-6 md:p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                  <AssetCard 
                    assetType="landing-page"
                    title="Main Landing Page"
                    content={landingPageContent}
                    claims={claims}
                    onCopy={() => {}}
                    onExportMarkdown={() => {}}
                    onExportHTML={() => {}}
                    onRegenerate={() => void runReviewAction("landing-page")}
                    onClaimClick={setSelectedClaimId}
                    reviewSignals={landingSignals}
                    reviewActions={recommendReviewActions(landingSignals)}
                    reviewLoadingAction={
                      reviewLoading.assetType === "landing-page" ? reviewLoading.action : null
                    }
                    onReviewAction={(action) => void runReviewAction("landing-page", action)}
                  />
                  <AssetCard 
                    assetType="social"
                    title="Social Posts (LinkedIn, Twitter)"
                    content={socialContent}
                    claims={claims}
                    onCopy={() => {}}
                    onExportMarkdown={() => {}}
                    onExportHTML={() => {}}
                    onRegenerate={() => void runReviewAction("social")}
                    onClaimClick={setSelectedClaimId}
                    reviewSignals={socialSignals}
                    reviewActions={recommendReviewActions(socialSignals)}
                    reviewLoadingAction={
                      reviewLoading.assetType === "social" ? reviewLoading.action : null
                    }
                    onReviewAction={(action) => void runReviewAction("social", action)}
                  />
                  <AssetCard 
                    assetType="email"
                    title="Nurture Sequence"
                    content={emailContent}
                    claims={claims}
                    onCopy={() => {}}
                    onExportMarkdown={() => {}}
                    onExportHTML={() => {}}
                    onRegenerate={() => void runReviewAction("email")}
                    onClaimClick={setSelectedClaimId}
                    reviewSignals={emailSignals}
                    reviewActions={recommendReviewActions(emailSignals)}
                    reviewLoadingAction={
                      reviewLoading.assetType === "email" ? reviewLoading.action : null
                    }
                    onReviewAction={(action) => void runReviewAction("email", action)}
                  />
                </div>
              </div>

              {/* Right Panel: Compliance Sidebar (30%) */}
              {claims.length > 0 ? (
                <div className="w-80 lg:w-96 shrink-0 border-l border-border/50 bg-card hidden md:block z-10 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.5)]">
                  <ComplianceSidebar 
                    complianceSummary={complianceSummary}
                    claims={claims}
                    onClaimSelect={setSelectedClaimId}
                    selectedClaimId={selectedClaimId}
                  />
                </div>
              ) : (
                <div className="w-80 lg:w-96 shrink-0 border-l border-border/50 bg-card hidden md:flex z-10 items-center justify-center p-6">
                  <div className="space-y-3 text-center">
                    <p className="text-sm font-semibold">No structured claims linked</p>
                    <p className="text-sm text-muted-foreground">
                      This campaign does not have any workspace claims matched to its current copy yet.
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/claims">Open claims workspace</Link>
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Other Legacy Tabs wrapped in proper scrolling containers */}
            <TabsContent value="builder" className="h-full m-0 overflow-y-auto bg-muted/10">
              <PageBuilderTab campaign={campaign} blocks={pageBlocks} />
            </TabsContent>
            
            <TabsContent value="publish" className="h-full m-0 overflow-y-auto bg-muted/10 p-6">
              <div className="max-w-5xl mx-auto"><PublishTab campaign={campaign} messages={messages} angles={angles} blocks={pageBlocks} /></div>
            </TabsContent>

            <TabsContent value="messages" className="h-full m-0 overflow-y-auto bg-muted/10 p-6">
              <div className="max-w-5xl mx-auto"><MessagesTab campaign={campaign} messages={messages} /></div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Dialogs */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-lg bg-card/95 backdrop-blur-xl border-border/50">
            <DialogHeader>
              <DialogTitle>Edit campaign details</DialogTitle>
              <DialogDescription>Update the core brief for this campaign.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign name</Label>
                <Input id="name" value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal">Campaign goal</Label>
                <Textarea id="goal" value={editGoal} onChange={(e) => setEditGoal(e.target.value)} rows={3} className="bg-muted/50 resize-none" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-primary-foreground">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="bg-card/95 backdrop-blur-xl border-destructive/20">
            <DialogHeader>
              <DialogTitle className="text-destructive">Delete campaign</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{campaign.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Delete Campaign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  )
}
