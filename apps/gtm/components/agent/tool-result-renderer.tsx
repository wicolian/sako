'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Check,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Layers,
  FileText,
  FileCheck,
  Palette,
  ArrowRight,
  Globe,
  Clock,
  Star,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ToolResultProps {
  toolName: string
  result: Record<string, unknown>
}

export function ToolResultRenderer({ toolName, result }: ToolResultProps) {
  if (!result?.success) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <XCircle className="h-4 w-4 shrink-0" />
        <span>{(result?.error as string) || 'Operation failed'}</span>
      </div>
    )
  }

  switch (toolName) {
    case 'listCampaigns':
      return <CampaignsResult campaigns={result.campaigns as Campaign[]} count={result.count as number} />
    case 'listClaims':
      return <ClaimsResult claims={result.claims as Claim[]} statusSummary={result.statusSummary as Record<string, number>} />
    case 'listEvidence':
      return <EvidenceResult evidence={result.evidence as Evidence[]} tierSummary={result.tierSummary as Record<string, number>} />
    case 'getBrandInfo':
      return <BrandResult brand={result.brand as Brand | null} />
    case 'navigateTo':
      return <NavigationResult route={result.route as string} page={result.page as string} reason={result.reason as string} />
    case 'importWebsite':
      return <ImportResult url={result.url as string} instructions={result.instructions as string} />
    case 'createCampaign':
      return <CampaignCreatedResult campaignId={result.campaignId as string} message={result.message as string} />
    case 'validateClaim':
      return <ValidationResult result={result} />
    case 'generateLandingPage':
      return <LandingPageResult content={result.content as Record<string, unknown>} />
    case 'generateAngles':
      return <AnglesResult angles={result.angles as Angle[]} />
    default:
      return <GenericResult result={result} />
  }
}

// Types
interface Campaign {
  id: string
  name: string
  status: string
  goal?: string
  audience?: string
  created_at?: string
  updated_at?: string
}

interface Claim {
  id: string
  text: string
  claim_type: string
  status: string
  risk_score?: number
  category?: string
}

interface Evidence {
  id: string
  title: string
  type: string
  tier: string
  source_type?: string
  url?: string
}

interface Brand {
  name: string
  website?: string
  colors?: {
    primary?: string
    secondary?: string
    accent?: string
  }
  voice?: string[]
  tagline?: string
  industry?: string
}

interface Angle {
  name: string
  hook: string
  message: string
}

// Campaign list result
function CampaignsResult({ campaigns, count }: { campaigns: Campaign[]; count: number }) {
  if (!campaigns?.length) {
    return (
      <div className="rounded-lg border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
        <Layers className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No campaigns found</p>
        <p className="text-xs mt-1">Create your first campaign to get started</p>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-muted/20 text-muted-foreground  ',
    ready: 'bg-blue-500/10 text-blue-500  ',
    published: 'bg-emerald-500/10 text-emerald-500  ',
    running: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    archived: 'bg-amber-500/10 text-amber-500  ',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{count} campaign(s) found</span>
        <Link href="/campaigns" className="text-primary hover:underline text-xs flex items-center gap-1">
          View all <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {campaigns.slice(0, 5).map((campaign) => (
          <Link
            key={campaign.id}
            href={`/campaigns/${campaign.id}`}
            className="block rounded-lg border bg-card p-3 transition-colors hover:border-primary/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{campaign.name}</p>
                {campaign.goal && (
                  <p className="text-xs text-muted-foreground mt-0.5">Goal: {campaign.goal}</p>
                )}
              </div>
              <Badge className={cn('shrink-0', statusColors[campaign.status] || statusColors.draft)}>
                {campaign.status}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  )
}

// Claims list result
function ClaimsResult({ claims, statusSummary }: { claims: Claim[]; statusSummary: Record<string, number> }) {
  if (!claims?.length) {
    return (
      <div className="rounded-lg border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
        <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No claims found</p>
        <p className="text-xs mt-1">Import a website to extract marketing claims</p>
      </div>
    )
  }

  const statusIcons: Record<string, typeof Check> = {
    approved: Check,
    needs_proof: AlertTriangle,
    blocked: XCircle,
    draft: Clock,
  }

  const statusColors: Record<string, string> = {
    approved: 'text-emerald-500',
    needs_proof: 'text-amber-500',
    blocked: 'text-red-500',
    draft: 'text-muted-foreground',
    ready_review: 'text-blue-500',
    rejected: 'text-destructive',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Summary badges */}
      {statusSummary && Object.keys(statusSummary).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusSummary).map(([status, count]) => (
            <Badge key={status} variant="outline" className="gap-1">
              {status.replace('_', ' ')}: {count}
            </Badge>
          ))}
        </div>
      )}

      {/* Claims list */}
      <div className="space-y-2">
        {claims.slice(0, 5).map((claim) => {
          const StatusIcon = statusIcons[claim.status] || Clock
          return (
            <div
              key={claim.id}
              className="rounded-lg border bg-card p-3"
            >
              <div className="flex items-start gap-2">
                <StatusIcon className={cn('h-4 w-4 mt-0.5 shrink-0', statusColors[claim.status])} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">&quot;{claim.text}&quot;</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {claim.claim_type}
                    </Badge>
                    {claim.risk_score !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        Risk: {Math.round(claim.risk_score * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Link href="/claims" className="text-primary hover:underline text-xs flex items-center gap-1">
        View all claims <ExternalLink className="h-3 w-3" />
      </Link>
    </motion.div>
  )
}

// Evidence list result
function EvidenceResult({ evidence, tierSummary }: { evidence: Evidence[]; tierSummary: Record<string, number> }) {
  if (!evidence?.length) {
    return (
      <div className="rounded-lg border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
        <FileCheck className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No evidence found</p>
        <p className="text-xs mt-1">Import a website or add evidence manually</p>
      </div>
    )
  }

  const tierColors: Record<string, string> = {
    A: 'bg-emerald-500/10 text-emerald-500  ',
    B: 'bg-blue-500/10 text-blue-500  ',
    C: 'bg-amber-500/10 text-amber-500  ',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Tier summary */}
      {tierSummary && Object.keys(tierSummary).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(tierSummary).map(([tier, count]) => (
            <Badge key={tier} className={cn(tierColors[tier] || tierColors.C)}>
              Tier {tier}: {count}
            </Badge>
          ))}
        </div>
      )}

      {/* Evidence list */}
      <div className="space-y-2">
        {evidence.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className="rounded-lg border bg-card p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.source_type || item.type}</p>
              </div>
              <Badge className={cn('shrink-0', tierColors[item.tier] || tierColors.C)}>
                Tier {item.tier}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <Link href="/evidence" className="text-primary hover:underline text-xs flex items-center gap-1">
        View all evidence <ExternalLink className="h-3 w-3" />
      </Link>
    </motion.div>
  )
}

// Brand info result
function BrandResult({ brand }: { brand: Brand | null }) {
  if (!brand) {
    return (
      <div className="rounded-lg border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
        <Palette className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No brand configured yet</p>
        <Link href="/import" className="text-primary hover:underline mt-2 inline-flex items-center gap-1">
          Import your website <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            {brand.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Colors */}
          {brand.colors && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Colors</p>
              <div className="flex gap-2">
                {brand.colors.primary && (
                  <div
                    className="h-8 w-8 rounded-md border shadow-sm"
                    style={{ backgroundColor: brand.colors.primary }}
                    title={`Primary: ${brand.colors.primary}`}
                  />
                )}
                {brand.colors.secondary && (
                  <div
                    className="h-8 w-8 rounded-md border shadow-sm"
                    style={{ backgroundColor: brand.colors.secondary }}
                    title={`Secondary: ${brand.colors.secondary}`}
                  />
                )}
                {brand.colors.accent && (
                  <div
                    className="h-8 w-8 rounded-md border shadow-sm"
                    style={{ backgroundColor: brand.colors.accent }}
                    title={`Accent: ${brand.colors.accent}`}
                  />
                )}
              </div>
            </div>
          )}

          {/* Voice */}
          {brand.voice && brand.voice.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Voice</p>
              <div className="flex flex-wrap gap-1">
                {brand.voice.map((tone, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {tone}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tagline */}
          {brand.tagline && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tagline</p>
              <p className="text-sm italic">&quot;{brand.tagline}&quot;</p>
            </div>
          )}

          <Link href="/brand-dna" className="text-primary hover:underline text-xs flex items-center gap-1 pt-2">
            Edit brand settings <ExternalLink className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Navigation result
function NavigationResult({ route, page, reason }: { route: string; page: string; reason: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border bg-primary/5 p-4"
    >
      <p className="text-sm mb-3">{reason}</p>
      <Button asChild size="sm">
        <Link href={route}>
          Go to {page} <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </motion.div>
  )
}

// Import result
function ImportResult({ url, instructions }: { url: string; instructions: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border bg-card p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-primary" />
        <span className="font-medium">{url}</span>
      </div>
      <p className="text-sm text-muted-foreground">{instructions}</p>
      <Button asChild size="sm">
        <Link href={`/import?url=${encodeURIComponent(url)}`}>
          Start Import <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </motion.div>
  )
}

// Campaign created result
function CampaignCreatedResult({ campaignId, message }: { campaignId: string; message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-emerald-500/20 bg-green-50   p-4"
    >
      <div className="flex items-center gap-2 text-emerald-500 ">
        <Check className="h-5 w-5" />
        <span className="font-medium">{message}</span>
      </div>
      <Button asChild size="sm" className="mt-3">
        <Link href={`/campaigns/${campaignId}`}>
          Open Campaign <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </motion.div>
  )
}

// Validation result
function ValidationResult({ result }: { result: Record<string, unknown> }) {
  const isCompliant = result.isCompliant as boolean
  const suggestions = result.suggestions as string[] | undefined

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-lg border p-4',
        isCompliant
          ? 'border-emerald-500/20 bg-green-50  '
          : 'border-amber-200 bg-amber-50 dark:border-amber-900 '
      )}
    >
      <div className={cn(
        'flex items-center gap-2',
        isCompliant ? 'text-emerald-500 ' : 'text-amber-500 '
      )}>
        {isCompliant ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        <span className="font-medium">
          {isCompliant ? 'Claim is compliant' : 'Claim needs review'}
        </span>
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-muted-foreground">Suggestions:</p>
          <ul className="text-sm space-y-1">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <Star className="h-3 w-3 mt-1 shrink-0 text-primary" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  )
}

// Landing page result
function LandingPageResult({ content }: { content: Record<string, unknown> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border bg-card p-4 space-y-4"
    >
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="h-5 w-5" />
        <span className="font-medium">Landing Page Generated</span>
      </div>

      {typeof content.headline === 'string' && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Headline</p>
          <p className="text-lg font-semibold">{content.headline}</p>
        </div>
      )}

      {typeof content.subheadline === 'string' && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Subheadline</p>
          <p className="text-sm">{content.subheadline}</p>
        </div>
      )}

      {Array.isArray(content.benefits) && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Benefits</p>
          <ul className="text-sm space-y-1">
            {content.benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                {String(b)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {typeof content.cta === 'string' && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">CTA</p>
          <Badge>{content.cta}</Badge>
        </div>
      )}
    </motion.div>
  )
}

// Marketing angles result
function AnglesResult({ angles }: { angles: Angle[] }) {
  if (!angles?.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="h-5 w-5" />
        <span className="font-medium">{angles.length} Marketing Angles</span>
      </div>

      <div className="space-y-2">
        {angles.map((angle, i) => (
          <Card key={i}>
            <CardContent className="p-3 space-y-2">
              <p className="font-medium">{angle.name}</p>
              <p className="text-sm text-primary">{angle.hook}</p>
              <p className="text-sm text-muted-foreground">{angle.message}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  )
}

// Generic fallback result
function GenericResult({ result }: { result: Record<string, unknown> }) {
  const { success, message, ...rest } = result

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border bg-card p-4"
    >
      {typeof message === 'string' && (
        <div className="flex items-center gap-2 text-emerald-500  mb-2">
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium">{message}</span>
        </div>
      )}
      {Object.keys(rest).length > 0 && (
        <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(rest, null, 2)}
        </pre>
      )}
    </motion.div>
  )
}
