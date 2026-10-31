"use client"

import { useMemo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Sparkles,
  Globe,
  ShieldAlert,
  ChevronRight,
  Activity,
  FileText,
  Send,
  Play,
} from "lucide-react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface CampaignStats {
  total: number
  draft: number
  ready: number
  published: number
  running: number
  archived: number
}

interface WorkspaceHealthStats {
  pendingReview: number
  blocked: number
}

interface Alert {
  id: string
  type: "claims" | "evidence" | "compliance" | "approval"
  title: string
  description: string
  count: number
  href: string
  priority: "high" | "medium" | "low"
  action: string
}

interface RecentCampaign {
  id: string
  name: string
  status: string
  updated_at: string
  progress?: number
}

const statusConfig = {
  draft: {
    label: "Draft",
    icon: FileText,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-muted",
    description: "In progress",
  },
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    description: "Ready to publish",
  },
  published: {
    label: "Live",
    icon: Play,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    description: "Published",
  },
  running: {
    label: "Live",
    icon: Activity,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    description: "Running",
  },
}

export default function DashboardClient({
  user,
  workspace,
  campaignStats,
  healthStats,
  recentCampaigns,
}: {
  user: { email?: string }
  workspace: { name: string }
  campaignStats: CampaignStats
  healthStats: WorkspaceHealthStats
  recentCampaigns: RecentCampaign[]
}) {
  const userName = user?.email?.split("@")[0] || "there"
  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1)

  const alerts = useMemo(() => {
    const newAlerts: Alert[] = []

    if (healthStats.pendingReview > 0) {
      newAlerts.push({
        id: "claims",
        type: "claims",
        title: "Claims need evidence",
        description: "Review and attach supporting evidence to unblock publishing",
        count: healthStats.pendingReview,
        href: "/claims?filter=pending",
        priority: "high",
        action: "Add Evidence",
      })
    }

    if (healthStats.blocked > 0) {
      newAlerts.push({
        id: "blocked",
        type: "compliance",
        title: "Blocked claims detected",
        description: "High-risk claims need attention before campaigns can go live",
        count: healthStats.blocked,
        href: "/claims?filter=blocked",
        priority: "high",
        action: "Review Claims",
      })
    }

    if (campaignStats.ready > 0) {
      newAlerts.push({
        id: "ready",
        type: "approval",
        title: "Campaigns ready to publish",
        description: "Complete campaigns waiting for final review",
        count: campaignStats.ready,
        href: "/campaigns?status=ready",
        priority: "medium",
        action: "Review & Publish",
      })
    }

    return newAlerts
  }, [campaignStats, healthStats])

  const getNextAction = () => {
    if (campaignStats.draft > 0) {
      return {
        label: "Continue drafting",
        count: campaignStats.draft,
        href: "/campaigns?status=draft",
        description: "campaigns in progress",
      }
    }
    if (campaignStats.ready > 0) {
      return {
        label: "Publish campaigns",
        count: campaignStats.ready,
        href: "/campaigns?status=ready",
        description: "ready to go live",
      }
    }
    return null
  }

  const nextAction = getNextAction()
  const hasNoCampaigns = Object.values(campaignStats).every((v) => v === 0)
  const totalLive = campaignStats.published + campaignStats.running
  const reviewLoad = healthStats.pendingReview + healthStats.blocked

  const flowSteps = [
    {
      id: "import",
      step: "01",
      title: "Import your brand",
      description: "Paste your website and let Composer pull brand voice, claims, and evidence gaps.",
      href: "/import",
      icon: Globe,
      badge: "Start here",
    },
    {
      id: "campaign",
      step: "02",
      title: "Create campaign assets",
      description: "Generate landing pages, email, and social copy from the imported brand context.",
      href: "/campaigns/new",
      icon: Sparkles,
      badge: campaignStats.total ? `${campaignStats.total} created` : "Next",
    },
    {
      id: "claims",
      step: "03",
      title: "Review claims",
      description: "See which messages are ready, which need proof, and what is blocked before shipping.",
      href: "/claims",
      icon: FileText,
      badge: reviewLoad > 0 ? `${reviewLoad} need review` : "Clear",
    },
    {
      id: "ship",
      step: "04",
      title: "Ship with confidence",
      description: "Export, deploy where supported, or hand work off once the campaign is compliant.",
      href: nextAction?.href || "/campaigns",
      icon: Send,
      badge: nextAction ? nextAction.label : "Ready when you are",
    },
  ]

  return (
    <main className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto max-w-6xl space-y-10 p-6 md:p-8">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card className="overflow-hidden border-border/50 bg-card/40 backdrop-blur-sm">
            <CardContent className="p-8 md:p-10">
              <div className="grid gap-8 lg:grid-cols-[1.35fr,0.85fr]">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
                    {workspace.name}
                    <span className="h-1 w-1 rounded-full bg-border" />
                    <span>{displayName}</span>
                  </div>
                  <div className="space-y-3">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                      Import your brand. Generate campaign assets. Review claims. Ship.
                    </h1>
                    <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                      Composer turns your website into campaign-ready copy with real claims review before export or deploy.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild size="lg" className="rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                      <Link href="/import" className="gap-2">
                        <Globe className="h-4 w-4" />
                        Import brand
                      </Link>
                    </Button>
                    <Button variant="outline" asChild size="lg" className="rounded-xl bg-background/60 hover:scale-[1.02] active:scale-[0.98] transition-all">
                      <Link href={hasNoCampaigns ? "/campaigns/new" : "/campaigns"} className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        {hasNoCampaigns ? "Create campaign" : "Open campaigns"}
                      </Link>
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {flowSteps.map((item) => (
                      <Link key={item.id} href={item.href}>
                        <div className="group h-full rounded-2xl border border-border/50 bg-background/50 p-4 transition-all duration-200 hover:border-primary/40 hover:bg-background hover:shadow-md">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              {item.step}
                            </span>
                            <item.icon className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
                          </div>
                          <p className="text-sm font-semibold text-foreground">{item.title}</p>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                          <div className="mt-4 flex items-center justify-between">
                            <Badge variant="secondary" className="bg-muted/70 text-[11px]">
                              {item.badge}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                <div>
                  <Card className="h-full border-border/50 bg-background/60">
                    <CardContent className="flex h-full flex-col gap-6 p-6">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Campaign pipeline
                        </p>
                        <h2 className="text-xl font-semibold text-foreground">
                          {hasNoCampaigns ? "No campaigns yet" : "What needs attention now"}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {hasNoCampaigns
                            ? "Start with a website import so Composer has real brand context to work from."
                            : "Use this snapshot to move active work toward review and shipping."}
                        </p>
                      </div>

                      <div className="grid gap-3">
                        <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">In progress</span>
                            <span className="text-2xl font-semibold">{campaignStats.draft}</span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border/50 bg-blue-500/5 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Ready to ship</span>
                            <span className="text-2xl font-semibold text-blue-500">{campaignStats.ready}</span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border/50 bg-emerald-500/5 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Live</span>
                            <span className="text-2xl font-semibold text-emerald-600">{totalLive}</span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border/50 bg-amber-500/5 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Claims waiting on review</span>
                            <span className="text-2xl font-semibold text-amber-500">{reviewLoad}</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-dashed border-border/50 p-4">
                        <p className="text-sm font-medium text-foreground">
                          {nextAction ? nextAction.label : "Follow the four-step flow above"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {nextAction
                            ? `${nextAction.count} ${nextAction.description}`
                            : "Import a brand, create a campaign, review claims, then choose the best ship path."}
                        </p>
                        {nextAction ? (
                          <Button asChild variant="link" className="mt-2 h-auto px-0 text-primary hover:scale-[1.02] active:scale-[0.98] transition-all">
                            <Link href={nextAction.href}>
                              Open queue
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Alerts Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Needs review
            </h2>
            
            {alerts.length > 0 ? (
              <div className="grid gap-3">
                {alerts.map((alert, i) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                  >
                    <Link href={alert.href}>
                      <Card className={cn(
                        "hover:border-primary/50 transition-all duration-200 hover:shadow-md cursor-pointer group",
                        alert.priority === "high" ? "bg-amber-500/5 border-amber-500/20" : "bg-card/40 border-border/50"
                      )}>
                        <CardContent className="flex items-start gap-4 p-5">
                          <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            alert.priority === "high" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"
                          )}>
                            <AlertTriangle className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("font-semibold text-sm", alert.priority === "high" && "text-amber-500")}>
                                {alert.title}
                              </span>
                              <Badge variant={alert.priority === "high" ? "outline" : "secondary"} className={cn("text-[10px]", alert.priority === "high" && "border-amber-500/30 text-amber-500")}>
                                {alert.count}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1">{alert.description}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="shrink-0 group-hover:translate-x-1 transition-transform">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-border/50 bg-transparent">
                <CardContent className="p-8 text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-1">No blocked claims or pending publish reviews.</p>
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* Recent Campaigns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Campaigns
              </h2>
              <Link href="/campaigns" className="text-xs font-medium text-primary hover:underline flex items-center">
                View all <ChevronRight className="w-3 h-3 ml-1" />
              </Link>
            </div>
            
            {recentCampaigns.length > 0 ? (
              <div className="grid gap-3">
                {recentCampaigns.map((campaign, i) => {
                  const config = statusConfig[campaign.status as keyof typeof statusConfig] || statusConfig.draft
                  return (
                    <motion.div
                      key={campaign.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                    >
                      <Link href={`/campaigns/${campaign.id}`}>
                        <Card className="hover:border-primary/50 bg-card/40 border-border/50 transition-all duration-200 hover:shadow-md cursor-pointer group">
                          <CardContent className="flex items-center gap-4 p-5">
                            <div className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                              config.bgColor
                            )}>
                              <config.icon className={cn("h-5 w-5", config.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                                {campaign.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatRelativeTime(campaign.updated_at)}
                              </p>
                            </div>
                            <Badge variant="outline" className={cn("capitalize shrink-0", config.color, config.borderColor, config.bgColor.replace('/10', '/5'))}>
                              {config.label}
                            </Badge>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <Card className="border-dashed border-border/50 bg-transparent">
                <CardContent className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">No recent campaigns.</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </main>
  )
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) return "Just now"
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
