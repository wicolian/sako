import type {
  AdVariant,
  DeckAsset,
  EmailSequence,
  LaunchKit,
  LaunchKitBrief,
  LandingPageAsset,
  SocialPost,
} from '@/lib/kit/kit-types'
import type { AssetDocument, ClaimRef } from '@/lib/assets/asset-document'

export interface LaunchKitRecord {
  id: string
  workspace_id: string
  campaign_id: string | null
  brand_id: string | null
  brief: LaunchKitBrief
  status: LaunchKit['status']
  assets: LaunchKit['assets']
  compliance: LaunchKit['compliance']
  angles: string[] | null
  created_at: string
  updated_at: string
  exported_at?: string | null
}

export interface GeneratedKitAssets {
  landingPage?: {
    id?: string
    html: string
    headline?: string
    subheadline?: string
    sections?: LandingPageAsset['sections']
    designTokens?: LandingPageAsset['designTokens']
    claims?: string[]
  } | null
  ads?: {
    variants: AdVariant[]
  } | null
  emails?: {
    campaign_name: string
    emails: Array<{
      subject: string
      preheader: string
      body_html: string
      cta_text: string
      cta_url: string
      delay_days: number
      email_type: EmailSequence['emails'][number]['emailType']
    }>
  } | null
  social?: {
    posts: SocialPost[]
  } | null
  deck?: {
    id: string
    title: string
    slides: Array<{
      id: string
      type: DeckAsset['slides'][number]['type']
      order: number
      headline: string
      subheadline?: string
      bullets?: string[]
      speakerNotes: string
      visualSuggestion: string
      claims?: string[]
    }>
    totalSlides: number
    estimatedDuration: string
    theme: DeckAsset['theme']
  } | null
}

export function isMissingLaunchKitsTableError(message: string | undefined): boolean {
  if (!message) {
    return false
  }

  return (
    message.includes("Could not find the table 'public.launch_kits'") ||
    message.includes('relation "launch_kits" does not exist')
  )
}

export function buildLaunchKitFromCampaignGeneration(params: {
  kitId: string
  campaignId: string
  workspaceId: string
  brandId?: string | null
  brief: LaunchKitBrief
  assets: GeneratedKitAssets
  assetDocuments: AssetDocument[]
  createdAt?: Date
  updatedAt?: Date
  status?: LaunchKit['status']
  angles?: string[]
}): LaunchKit {
  const createdAt = params.createdAt ?? new Date()
  const updatedAt = params.updatedAt ?? createdAt
  const assets = params.assets

  return {
    id: params.kitId,
    campaignId: params.campaignId,
    workspaceId: params.workspaceId,
    brandId: params.brandId ?? undefined,
    brief: params.brief,
    status: params.status ?? 'review',
    assets: {
      landingPage: assets.landingPage
        ? {
            id: assets.landingPage.id ?? crypto.randomUUID(),
            html: assets.landingPage.html,
            headline: assets.landingPage.headline ?? '',
            subheadline: assets.landingPage.subheadline ?? '',
            sections: assets.landingPage.sections ?? [],
            designTokens: assets.landingPage.designTokens ?? {
              primaryColor: '#0f172a',
              secondaryColor: '#64748b',
              fontFamily: 'Geist',
            },
            claims: assets.landingPage.claims ?? [],
          }
        : null,
      ads: assets.ads?.variants ?? [],
      emails: assets.emails
        ? {
            campaignName: assets.emails.campaign_name,
            emails: assets.emails.emails.map((email) => ({
              subject: email.subject,
              preheader: email.preheader,
              bodyHtml: email.body_html,
              ctaText: email.cta_text,
              ctaUrl: email.cta_url,
              delayDays: email.delay_days,
              emailType: email.email_type,
              claims: [],
            })),
          }
        : null,
      socialPosts: assets.social?.posts ?? [],
      deck: assets.deck
        ? {
            id: assets.deck.id,
            title: assets.deck.title,
            slides: assets.deck.slides.map((slide) => ({
              id: slide.id,
              type: slide.type,
              order: slide.order,
              headline: slide.headline,
              subheadline: slide.subheadline,
              bullets: slide.bullets,
              speakerNotes: slide.speakerNotes,
              visualSuggestion: slide.visualSuggestion,
              claims: slide.claims ?? [],
            })),
            totalSlides: assets.deck.totalSlides,
            estimatedDuration: assets.deck.estimatedDuration,
            theme: assets.deck.theme,
          }
        : null,
    },
    compliance: summarizeCompliance(params.assetDocuments),
    angles: params.angles ?? [],
    createdAt,
    updatedAt,
  }
}

export function mapLaunchKitRecord(record: LaunchKitRecord): LaunchKit {
  return {
    id: record.id,
    campaignId: record.campaign_id ?? '',
    workspaceId: record.workspace_id,
    brandId: record.brand_id ?? undefined,
    brief: record.brief,
    status: record.status,
    assets: record.assets,
    compliance: record.compliance,
    angles: record.angles ?? [],
    createdAt: new Date(record.created_at),
    updatedAt: new Date(record.updated_at),
    exportedAt: record.exported_at ? new Date(record.exported_at) : undefined,
  }
}

export function summarizeCompliance(assetDocuments: AssetDocument[]): LaunchKit['compliance'] {
  const claims = assetDocuments.flatMap((doc) => doc.claims)
  const blocked = claims.filter(isBlockedClaim).length
  const approved = claims.filter(isApprovedClaim).length
  const needsReview = Math.max(claims.length - blocked - approved, 0)
  const averageRiskScore =
    claims.length > 0
      ? Number(
          (claims.reduce((sum, claim) => sum + claim.riskScore, 0) / claims.length).toFixed(2)
        )
      : 0

  return {
    totalClaims: claims.length,
    approved,
    needsReview,
    blocked,
    averageRiskScore,
  }
}

function isBlockedClaim(claim: ClaimRef): boolean {
  return claim.riskScore >= 70 && claim.status !== 'verified' && claim.status !== 'overridden'
}

function isApprovedClaim(claim: ClaimRef): boolean {
  return claim.status === 'verified' || claim.status === 'overridden' || claim.riskScore < 35
}
