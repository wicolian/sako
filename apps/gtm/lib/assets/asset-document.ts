import type { BrainProvenanceRef } from '@/lib/brain/types'

/**
 * Unified Asset Document Model (UADM)
 *
 * Canonical schema shared by all asset types: landing pages, social posts,
 * emails, decks, and ads. Every generator outputs this, every editor consumes
 * it, and every export/publish pipeline reads from it.
 *
 * HTML is the source of truth for every asset.
 */

// ============================================================================
// Core Types
// ============================================================================

export type AssetType = 'landing' | 'social' | 'email' | 'deck' | 'ad'

export type Channel =
  | 'linkedin'
  | 'instagram'
  | 'twitter'
  | 'facebook'
  | 'meta'
  | 'google'

export type ComplianceStatus = 'clean' | 'warning' | 'blocked'

export type AssetStatus = 'draft' | 'review' | 'approved' | 'published'

// ============================================================================
// Content Blocks
// ============================================================================

export interface ContentBlock {
  id: string
  type:
    | 'headline'
    | 'subheadline'
    | 'body'
    | 'cta'
    | 'image'
    | 'logo'
    | 'list'
    | 'testimonial'
    | 'stat'
    | 'divider'
    | 'spacer'
    | 'custom'
  content: string
  position?: { x: number; y: number; width?: number; height?: number }
  style?: Record<string, string>
  locked?: boolean
}

// ============================================================================
// Design Tokens
// ============================================================================

export interface DesignTokens {
  colors: {
    primary: string
    secondary: string
    accent?: string
    background: string
    text: string
    [key: string]: string | undefined
  }
  typography: {
    heading: string
    body: string
    sizes: Record<string, string>
  }
  spacing: {
    base: number
    scale: number[]
  }
  borderRadius?: string
  shadow?: string
}

// ============================================================================
// Claims & Evidence
// ============================================================================

export interface ClaimRef {
  id: string
  text: string
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  status: 'verified' | 'unverified' | 'blocked' | 'overridden'
  evidenceIds: string[]
  suggestedRewrite?: string
  blockId?: string
}

export interface EvidenceRef {
  id: string
  url: string
  tier: 'A' | 'B' | 'C'
  sourceType: string
  snippet?: string
  confidence?: number
}

// ============================================================================
// Rendering
// ============================================================================

export interface Dimensions {
  width: number
  height: number
}

export interface RenderVariant {
  format: 'png' | 'jpg' | 'pdf' | 'html' | 'pptx'
  url: string
  dimensions?: Dimensions
  fileSize?: number
}

// ============================================================================
// AssetDocument — The Core Contract
// ============================================================================

export interface AssetDocument {
  id: string
  workspaceId: string
  brandId: string
  campaignId?: string
  brainSnapshotId?: string
  type: AssetType
  channel?: Channel

  // Content — HTML is source of truth
  html: string
  blocks: ContentBlock[]
  designTokens: DesignTokens

  // Compliance
  claims: ClaimRef[]
  evidenceRefs: EvidenceRef[]
  complianceStatus: ComplianceStatus

  // Rendering
  dimensions?: Dimensions
  renderedImageUrl?: string
  renderVariants?: RenderVariant[]

  // Versioning
  revision: number
  parentRevisionId?: string
  status: AssetStatus

  // Metadata
  title?: string
  description?: string
  skeletonId?: string
  generationKey?: string
  provenance?: BrainProvenanceRef[]

  createdAt: string
  updatedAt: string
}

// ============================================================================
// Creation helpers
// ============================================================================

export interface CreateAssetDocumentInput {
  workspaceId: string
  brandId: string
  campaignId?: string
  brainSnapshotId?: string
  type: AssetType
  channel?: Channel
  html: string
  blocks?: ContentBlock[]
  designTokens?: DesignTokens
  claims?: ClaimRef[]
  evidenceRefs?: EvidenceRef[]
  dimensions?: Dimensions
  title?: string
  description?: string
  skeletonId?: string
  generationKey?: string
  provenance?: BrainProvenanceRef[]
}

export function createAssetDocument(
  input: CreateAssetDocumentInput
): AssetDocument {
  return {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    campaignId: input.campaignId,
    brainSnapshotId: input.brainSnapshotId,
    type: input.type,
    channel: input.channel,
    html: input.html,
    blocks: input.blocks ?? [],
    designTokens: input.designTokens ?? {
      colors: {
        primary: '#000000',
        secondary: '#333333',
        background: '#ffffff',
        text: '#111111',
      },
      typography: {
        heading: 'Inter',
        body: 'Inter',
        sizes: { h1: '48px', h2: '36px', h3: '24px', body: '16px' },
      },
      spacing: { base: 8, scale: [8, 16, 24, 32, 48, 64] },
    },
    claims: input.claims ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    complianceStatus: 'clean',
    dimensions: input.dimensions,
    revision: 1,
    status: 'draft',
    title: input.title,
    description: input.description,
    skeletonId: input.skeletonId,
    generationKey: input.generationKey,
    provenance: input.provenance ?? [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ============================================================================
// Compliance helpers
// ============================================================================

export function computeComplianceStatus(
  claims: ClaimRef[]
): ComplianceStatus {
  if (claims.length === 0) return 'clean'
  const hasBlocked = claims.some(
    (c) => c.riskScore >= 70 && c.status !== 'verified' && c.status !== 'overridden'
  )
  if (hasBlocked) return 'blocked'
  const hasWarning = claims.some(
    (c) => c.riskScore >= 40 && c.status === 'unverified'
  )
  if (hasWarning) return 'warning'
  return 'clean'
}

// ============================================================================
// DB row mapping
// ============================================================================

export interface AssetDocumentRow {
  id: string
  workspace_id: string
  brand_id: string | null
  campaign_id: string | null
  brain_snapshot_id: string | null
  asset_type: string
  channel: string | null
  html: string
  blocks_json: unknown
  design_tokens: unknown
  claims_json: unknown
  evidence_json: unknown
  compliance_status: string
  dimensions: unknown
  rendered_image_url: string | null
  render_variants: unknown
  revision: number
  parent_revision_id: string | null
  status: string
  title: string | null
  description: string | null
  skeleton_id: string | null
  generation_key: string | null
  provenance_json: unknown
  created_at: string
  updated_at: string
}

export function rowToAssetDocument(row: AssetDocumentRow): AssetDocument {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    brandId: row.brand_id ?? '',
    campaignId: row.campaign_id ?? undefined,
    brainSnapshotId: row.brain_snapshot_id ?? undefined,
    type: row.asset_type as AssetType,
    channel: (row.channel as Channel) ?? undefined,
    html: row.html,
    blocks: (row.blocks_json as ContentBlock[]) ?? [],
    designTokens: (row.design_tokens as DesignTokens) ?? {
      colors: { primary: '#000', secondary: '#333', background: '#fff', text: '#111' },
      typography: { heading: 'Inter', body: 'Inter', sizes: {} },
      spacing: { base: 8, scale: [] },
    },
    claims: (row.claims_json as ClaimRef[]) ?? [],
    evidenceRefs: (row.evidence_json as EvidenceRef[]) ?? [],
    complianceStatus: row.compliance_status as ComplianceStatus,
    dimensions: (row.dimensions as Dimensions) ?? undefined,
    renderedImageUrl: row.rendered_image_url ?? undefined,
    renderVariants: (row.render_variants as RenderVariant[]) ?? undefined,
    revision: row.revision,
    parentRevisionId: row.parent_revision_id ?? undefined,
    status: row.status as AssetStatus,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    skeletonId: row.skeleton_id ?? undefined,
    generationKey: row.generation_key ?? undefined,
    provenance: (row.provenance_json as BrainProvenanceRef[]) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function assetDocumentToRow(
  doc: AssetDocument
): Omit<AssetDocumentRow, 'created_at' | 'updated_at'> {
  return {
    id: doc.id,
    workspace_id: doc.workspaceId,
    brand_id: doc.brandId || null,
    campaign_id: doc.campaignId ?? null,
    brain_snapshot_id: doc.brainSnapshotId ?? null,
    asset_type: doc.type,
    channel: doc.channel ?? null,
    html: doc.html,
    blocks_json: doc.blocks,
    design_tokens: doc.designTokens,
    claims_json: doc.claims,
    evidence_json: doc.evidenceRefs,
    compliance_status: doc.complianceStatus,
    dimensions: doc.dimensions ?? null,
    rendered_image_url: doc.renderedImageUrl ?? null,
    render_variants: doc.renderVariants ?? [],
    revision: doc.revision,
    parent_revision_id: doc.parentRevisionId ?? null,
    status: doc.status,
    title: doc.title ?? null,
    description: doc.description ?? null,
    skeleton_id: doc.skeletonId ?? null,
    generation_key: doc.generationKey ?? null,
    provenance_json: doc.provenance ?? [],
  }
}
