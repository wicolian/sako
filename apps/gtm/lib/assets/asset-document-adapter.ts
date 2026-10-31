/**
 * Asset Document Adapter
 *
 * Backward-compatibility layer that converts between legacy per-asset
 * interfaces (LandingPageAsset, SocialPost, DeckAsset, etc.) and the
 * canonical AssetDocument.
 *
 * During the migration period both shapes are kept in sync.
 */

import {
  type AssetDocument,
  type AssetType,
  type Channel,
  type ContentBlock,
  type DesignTokens,
  type ClaimRef,
  type Dimensions,
  createAssetDocument,
  computeComplianceStatus,
  assetDocumentToRow,
} from './asset-document'
import type { BrandContext } from '@/lib/ai/brand-context'
import type { DesignArchetype } from '@/lib/design/archetype-selector'
import type {
  LandingPageAsset,
  SocialPost,
  DeckAsset,
  DeckSlide,
  AdVariant,
  EmailMessage,
  EmailSequence,
} from '@/lib/kit/kit-types'
import { createServiceClient } from '@/lib/supabase/service'

// ============================================================================
// Legacy → AssetDocument converters
// ============================================================================

export function landingPageToAssetDocument(
  asset: LandingPageAsset,
  workspaceId: string,
  brandId: string,
  campaignId?: string
): AssetDocument {
  const claims: ClaimRef[] = (asset.claims ?? []).map((text, i) => ({
    id: crypto.randomUUID(),
    text,
    riskScore: 0,
    riskLevel: 'low' as const,
    status: 'unverified' as const,
    evidenceIds: [],
  }))

  return createAssetDocument({
    workspaceId,
    brandId,
    campaignId,
    type: 'landing',
    html: asset.html,
    blocks: (asset.sections ?? []).map((s, i) => ({
      id: crypto.randomUUID(),
      type: s.type === 'hero' ? 'headline' : s.type === 'cta' ? 'cta' : ('custom' as ContentBlock['type']),
      content: s.html,
    })),
    designTokens: {
      colors: {
        primary: asset.designTokens?.primaryColor ?? '#000000',
        secondary: asset.designTokens?.secondaryColor ?? '#333333',
        background: '#ffffff',
        text: '#111111',
      },
      typography: {
        heading: asset.designTokens?.fontFamily ?? 'Inter',
        body: asset.designTokens?.fontFamily ?? 'Inter',
        sizes: { h1: '48px', h2: '36px', h3: '24px', body: '16px' },
      },
      spacing: { base: 8, scale: [8, 16, 24, 32, 48, 64] },
    },
    claims,
    title: asset.headline,
    description: asset.subheadline,
  })
}

export function socialPostToAssetDocument(
  post: SocialPost,
  workspaceId: string,
  brandId: string,
  campaignId?: string
): AssetDocument {
  const channelMap: Record<string, Channel> = {
    linkedin: 'linkedin',
    twitter: 'twitter',
    facebook: 'facebook',
    instagram: 'instagram',
    tiktok: 'facebook', // fallback
  }

  const dimensionMap: Record<string, Dimensions> = {
    linkedin: { width: 1200, height: 627 },
    instagram: { width: 1080, height: 1080 },
    twitter: { width: 1200, height: 675 },
    facebook: { width: 1200, height: 630 },
    tiktok: { width: 1080, height: 1920 },
  }

  const claims: ClaimRef[] = (post.claims ?? []).map((text) => ({
    id: crypto.randomUUID(),
    text,
    riskScore: 0,
    riskLevel: 'low' as const,
    status: 'unverified' as const,
    evidenceIds: [],
  }))

  // Build a basic HTML visual for the social post
  const html = 'visualHtml' in post && typeof post.visualHtml === 'string'
    ? post.visualHtml
    : buildSocialPostHtml(post)

  return createAssetDocument({
    workspaceId,
    brandId,
    campaignId,
    type: 'social',
    channel: channelMap[post.platform] ?? 'linkedin',
    html,
    blocks: [
      { id: crypto.randomUUID(), type: 'body', content: post.content },
      ...(post.hashtags?.length
        ? [{ id: crypto.randomUUID(), type: 'custom' as const, content: post.hashtags.join(' ') }]
        : []),
    ],
    dimensions: dimensionMap[post.platform] ?? { width: 1200, height: 627 },
    claims,
    title: post.variantLabel,
  })
}

export function deckToAssetDocument(
  deck: DeckAsset,
  workspaceId: string,
  brandId: string,
  campaignId?: string,
  options?: {
    designArchetype?: DesignArchetype
  }
): AssetDocument {
  const blocks: ContentBlock[] = deck.slides.map((slide) => ({
    id: slide.id,
    type: slide.type === 'title' ? 'headline' as const : 'custom' as const,
    content: `<h2>${slide.headline}</h2>${slide.subheadline ? `<p>${slide.subheadline}</p>` : ''}${
      slide.bullets?.length ? `<ul>${slide.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : ''
    }`,
  }))

  const html = buildDeckHtml(deck, options?.designArchetype)

  return createAssetDocument({
    workspaceId,
    brandId,
    campaignId,
    type: 'deck',
    html,
    blocks,
    designTokens: {
      colors: {
        primary: deck.theme?.primaryColor ?? '#000000',
        secondary: '#333333',
        background: '#ffffff',
        text: '#111111',
      },
      typography: {
        heading: deck.theme?.fontFamily ?? 'Inter',
        body: deck.theme?.fontFamily ?? 'Inter',
        sizes: { h1: '48px', h2: '36px', h3: '24px', body: '16px' },
      },
      spacing: { base: 8, scale: [8, 16, 24, 32, 48, 64] },
    },
    dimensions: { width: 1920, height: 1080 },
    title: deck.title,
  })
}

export function adVariantToAssetDocument(
  ad: AdVariant,
  workspaceId: string,
  brandId: string,
  campaignId?: string
): AssetDocument {
  const channelMap: Record<string, Channel> = {
    facebook: 'meta',
    instagram: 'meta',
    linkedin: 'linkedin',
    google: 'google',
  }

  const dimensionMap: Record<string, Dimensions> = {
    feed: { width: 1200, height: 628 },
    story: { width: 1080, height: 1920 },
    carousel: { width: 1080, height: 1080 },
    display: { width: 300, height: 250 },
  }

  const html = buildAdHtml(ad)

  return createAssetDocument({
    workspaceId,
    brandId,
    campaignId,
    type: 'ad',
    channel: channelMap[ad.platform] ?? 'meta',
    html,
    blocks: [
      { id: crypto.randomUUID(), type: 'headline', content: ad.headline },
      { id: crypto.randomUUID(), type: 'body', content: ad.primaryText },
      { id: crypto.randomUUID(), type: 'cta', content: ad.callToAction },
    ],
    dimensions: dimensionMap[ad.format] ?? { width: 1200, height: 628 },
    claims: (ad.claims ?? []).map((text) => ({
      id: crypto.randomUUID(),
      text,
      riskScore: 0,
      riskLevel: 'low' as const,
      status: 'unverified' as const,
      evidenceIds: [],
    })),
    title: `${ad.angle} — ${ad.platform} ${ad.format}`,
  })
}

export function emailSequenceToAssetDocuments(
  seq: EmailSequence,
  workspaceId: string,
  brandId: string,
  campaignId?: string,
  options?: {
    brandContext?: BrandContext
    designArchetype?: DesignArchetype
  }
): AssetDocument[] {
  return (seq.emails ?? []).map((email, i) => {
    const html = buildEmailHtml({
      subject: email.subject,
      body: email.bodyHtml,
      callToAction: email.ctaText,
      emailType: email.emailType,
    }, options)
    return createAssetDocument({
      workspaceId,
      brandId,
      campaignId,
      type: 'email',
      html,
      blocks: [
        { id: crypto.randomUUID(), type: 'headline', content: email.subject },
        { id: crypto.randomUUID(), type: 'body', content: email.bodyHtml },
        ...(email.ctaText
          ? [{ id: crypto.randomUUID(), type: 'cta' as const, content: email.ctaText }]
          : []),
      ],
      claims: (email.claims ?? []).map((text) => ({
        id: crypto.randomUUID(),
        text,
        riskScore: 0,
        riskLevel: 'low' as const,
        status: 'unverified' as const,
        evidenceIds: [],
      })),
      title: email.subject,
      description: `Email ${i + 1} of ${seq.emails.length} — ${seq.campaignName}`,
    })
  })
}

// ============================================================================
// AssetDocument → Legacy converters (backward compat)
// ============================================================================

export function assetDocumentToLandingPage(doc: AssetDocument): LandingPageAsset {
  return {
    id: doc.id,
    html: doc.html,
    headline: doc.title ?? '',
    subheadline: doc.description ?? '',
    sections: doc.blocks.map((b) => ({ type: b.type, html: b.content })),
    designTokens: {
      primaryColor: doc.designTokens.colors.primary,
      secondaryColor: doc.designTokens.colors.secondary,
      fontFamily: doc.designTokens.typography.heading,
    },
    claims: doc.claims.map((c) => c.text),
  }
}

// ============================================================================
// Persist helpers
// ============================================================================

export async function upsertAssetDocument(doc: AssetDocument): Promise<AssetDocument> {
  const supabase = createServiceClient()
  const row = assetDocumentToRow(doc)

  const { data, error } = await supabase
    .from('asset_documents')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to upsert asset document: ${error.message}`)
  }

  const savedDoc = { ...doc, updatedAt: new Date().toISOString() }
  const { syncAssetDocumentClaimLineage } = await import('@/lib/claims/claim-lineage')
  return syncAssetDocumentClaimLineage(savedDoc)
}

export async function getAssetDocument(id: string): Promise<AssetDocument | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('asset_documents')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null

  // Import inline to avoid circular deps
  const { rowToAssetDocument } = await import('./asset-document')
  return rowToAssetDocument(data as unknown as import('./asset-document').AssetDocumentRow)
}

export async function listAssetDocuments(
  workspaceId: string,
  filters?: { campaignId?: string; type?: AssetType; status?: string }
): Promise<AssetDocument[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('asset_documents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (filters?.campaignId) query = query.eq('campaign_id', filters.campaignId)
  if (filters?.type) query = query.eq('asset_type', filters.type)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query

  if (error) throw new Error(`Failed to list asset documents: ${error.message}`)

  const { rowToAssetDocument } = await import('./asset-document')
  return (data ?? []).map((row) => rowToAssetDocument(row as unknown as import('./asset-document').AssetDocumentRow))
}

// ============================================================================
// HTML builders for legacy types
// ============================================================================

function buildSocialPostHtml(post: SocialPost): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--brand-background, #0f172a); color: var(--brand-text, #f8fafc); }
  .card { padding: 48px; max-width: 100%; width: 100%; }
  .content { font-size: 24px; line-height: 1.5; margin-bottom: 24px; white-space: pre-wrap; }
  .hashtags { font-size: 16px; color: var(--brand-primary, #3b82f6); }
</style></head>
<body>
<div class="card">
  <p class="content">${escapeHtml(post.content)}</p>
  ${post.hashtags?.length ? `<p class="hashtags">${post.hashtags.map((h) => `#${h}`).join(' ')}</p>` : ''}
</div>
</body></html>`
}

function buildDeckHtml(deck: DeckAsset, archetype?: DesignArchetype): string {
  const slidesHtml = deck.slides
    .map(
      (slide) => `
<section class="slide" data-slide-type="${slide.type}">
  <h2>${escapeHtml(slide.headline)}</h2>
  ${slide.subheadline ? `<p class="sub">${escapeHtml(slide.subheadline)}</p>` : ''}
  ${slide.bullets?.length ? `<ul>${slide.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
</section>`
    )
    .join('\n')

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .slide {
    width: 1920px;
    height: 1080px;
    padding: ${archetype?.spacingDensity === 'spacious' ? '96px' : '72px'};
    display: flex;
    flex-direction: column;
    justify-content: center;
    font-family: '${deck.theme?.fontFamily ?? 'system-ui'}', system-ui;
    background: ${archetype?.deck === 'clean-light' ? '#f8fafc' : '#111827'};
    color: ${archetype?.deck === 'clean-light' ? '#0f172a' : '#f8fafc'};
    page-break-after: always;
  }
  h2 { font-size: 64px; margin-bottom: 24px; color: ${deck.theme?.primaryColor ?? '#3b82f6'}; }
  .sub { font-size: 32px; opacity: 0.8; margin-bottom: 40px; }
  ul { font-size: 28px; line-height: 1.8; padding-left: 40px; }
  [data-slide-type="problem"] h2,
  [data-slide-type="cta"] h2 { font-size: 72px; max-width: 14ch; }
  [data-slide-type="proof"],
  [data-slide-type="pricing"] { background: color-mix(in oklch, ${deck.theme?.primaryColor ?? '#3b82f6'} 8%, transparent); }
</style></head>
<body>${slidesHtml}</body></html>`
}

function buildAdHtml(ad: AdVariant): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--brand-background, #0f172a); color: var(--brand-text, #f8fafc); }
  .ad { padding: 40px; text-align: center; }
  .headline { font-size: 32px; font-weight: 700; margin-bottom: 16px; }
  .body { font-size: 18px; margin-bottom: 24px; opacity: 0.9; }
  .cta { display: inline-block; padding: 14px 32px; background: var(--brand-primary, #3b82f6); color: #fff; border-radius: 8px; font-weight: 600; font-size: 18px; }
</style></head>
<body>
<div class="ad">
  <h1 class="headline">${escapeHtml(ad.headline)}</h1>
  <p class="body">${escapeHtml(ad.primaryText)}</p>
  <span class="cta">${escapeHtml(ad.callToAction)}</span>
</div>
</body></html>`
}

function buildEmailHtml(
  email: { subject: string; body: string; callToAction?: string; emailType?: string },
  options?: {
    brandContext?: BrandContext
    designArchetype?: DesignArchetype
  }
): string {
  const primary = options?.brandContext?.colors.primary ?? '#0f172a'
  const background = options?.designArchetype?.prefersDark ? '#0b1020' : '#f4f4f5'
  const surface = options?.designArchetype?.prefersDark ? '#11172a' : '#ffffff'
  const text = options?.designArchetype?.prefersDark ? '#e5e7eb' : '#1f2937'
  const headingFont = options?.brandContext?.typography.fontHeading ?? options?.brandContext?.typography.fontFamily ?? 'Inter'
  const bodyFont = options?.brandContext?.typography.fontFamily ?? 'Inter'
  const radius = options?.designArchetype?.borderRadius ?? '8px'
  const emailType = email.emailType ?? 'nurture'

  if (emailType === 'welcome') {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<meta name="color-scheme" content="light dark">
<style>
  body { font-family: '${bodyFont}', Arial, sans-serif; margin: 0; padding: 0; background: ${background}; color: ${text}; }
  .container { max-width: 600px; margin: 0 auto; background: ${surface}; padding: 32px 24px; }
  .accent { width: 48px; height: 3px; background: ${primary}; margin-bottom: 20px; }
  .subject { font-family: '${headingFont}', Arial, sans-serif; font-size: 26px; line-height: 1.25; margin-bottom: 18px; }
  .body { font-size: 16px; line-height: 1.7; color: ${text}; }
  a.inline-link { color: ${primary}; text-decoration: underline; font-weight: 600; }
  @media (prefers-color-scheme: dark) {
    body { background: #080c16 !important; color: #e5e7eb !important; }
    .container { background: #0f172a !important; }
  }
</style></head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:${background};"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" class="container">
    <tr><td><div class="accent"></div></td></tr>
    <tr><td class="subject">${escapeHtml(email.subject)}</td></tr>
    <tr><td class="body">${email.body}</td></tr>
    ${email.callToAction ? `<tr><td class="body" style="padding-top:16px;"><a class="inline-link" href="#">${escapeHtml(email.callToAction)}</a></td></tr>` : ''}
  </table>
</td></tr></table>
</body></html>`
  }

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<meta name="color-scheme" content="light dark">
<style>
  body { font-family: '${bodyFont}', Arial, sans-serif; margin: 0; padding: 0; background: ${background}; }
  .container { max-width: 600px; margin: 0 auto; background: ${surface}; border-radius: ${radius}; overflow: hidden; }
  .header { padding: 28px 32px; background: color-mix(in oklch, ${surface} 92%, ${primary} 8%); color: ${text}; border-bottom: 1px solid color-mix(in oklch, ${text} 12%, transparent); }
  .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 0.18em; opacity: 0.8; margin-bottom: 10px; }
  .subject { font-family: '${headingFont}', Arial, sans-serif; margin: 0; font-size: 28px; line-height: 1.2; }
  .content { padding: 32px; color: ${text}; line-height: 1.7; font-size: 16px; }
  .cta { display: inline-block; padding: 14px 28px; background: ${primary}; color: #fff; border-radius: ${radius}; text-decoration: none; font-weight: 600; margin-top: 16px; }
  .signature { padding-top: 24px; color: color-mix(in oklch, ${text} 68%, transparent); font-size: 14px; }
  @media (prefers-color-scheme: dark) {
    body { background: #080c16 !important; }
    .container { background: #0f172a !important; }
    .content { color: #e5e7eb !important; }
  }
</style></head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:${background}; padding:24px 12px;"><tr><td align="center">
<div class="container">
  <div class="header">
    <div class="eyebrow">${emailType === 'closing' ? 'Final note' : emailType === 'social_proof' ? 'Customer proof' : 'Sako Composer'}</div>
    <h1 class="subject">${escapeHtml(email.subject)}</h1>
  </div>
  <div class="content">
    ${email.body}
    ${email.callToAction ? `<br><a class="cta" href="#">${escapeHtml(email.callToAction)}</a>` : ''}
    <div class="signature">Built for clear review and responsible delivery.</div>
  </div>
</div>
</td></tr></table>
</body></html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
