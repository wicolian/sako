import type { Json } from '@/lib/supabase/types'

export type BrainSourceType =
  | 'url'
  | 'webflow'
  | 'framer'
  | 'notion'
  | 'github'
  | 'file_upload'
  | 'manual'

export type BrainSourceStatus =
  | 'pending'
  | 'connected'
  | 'syncing'
  | 'ready'
  | 'review_required'
  | 'error'
  | 'disabled'

export type BrainSyncStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'review_required'
  | 'failed'

export type ProductFactStatus =
  | 'draft'
  | 'active'
  | 'review_required'
  | 'conflicted'
  | 'archived'

export type LegalRuleSeverity = 'info' | 'warn' | 'block'

export type LegalRuleStatus = 'draft' | 'active' | 'review_required' | 'archived'

export type BrainSnapshotStatus = 'draft' | 'approved' | 'superseded' | 'archived'

export interface BrainSource {
  id: string
  workspaceId: string
  brandId?: string
  sourceType: BrainSourceType
  connectionRef?: string
  externalId?: string
  displayName: string
  status: BrainSourceStatus
  lastSyncedAt?: string
  lastSnapshotId?: string
  config: Record<string, Json>
  createdAt: string
  updatedAt: string
}

export interface BrainSyncRun {
  id: string
  brainSourceId: string
  workspaceId: string
  status: BrainSyncStatus
  startedAt: string
  completedAt?: string
  changes: Record<string, Json>
  errorText?: string
  metrics: Record<string, Json>
}

export interface ProductFact {
  id: string
  workspaceId: string
  brandId?: string
  factKey: string
  statement: string
  category: string
  sourceId?: string
  confidence: number
  status: ProductFactStatus
  claimable: boolean
  effectiveRegion?: string
  metadata: Record<string, Json>
  confirmedBy?: string
  confirmedAt?: string
  createdAt: string
  updatedAt: string
}

export interface LegalRule {
  id: string
  workspaceId: string
  brandId?: string
  ruleType: string
  ruleText: string
  severity: LegalRuleSeverity
  appliesToChannels: string[]
  appliesToRegions: string[]
  requiredDisclaimer?: string
  sourceId?: string
  status: LegalRuleStatus
  metadata: Record<string, Json>
  createdAt: string
  updatedAt: string
}

export interface BrainSnapshot {
  id: string
  workspaceId: string
  brandId?: string
  status: BrainSnapshotStatus
  sourceIds: string[]
  summary: Record<string, Json>
  priorityRules: Record<string, Json>
  createdBy?: string
  createdAt: string
}

export interface BrainProvenanceRef {
  blockId?: string
  claimId?: string
  sourceType: BrainSourceType
  sourceId: string
  snapshotId: string
}

export interface BrainBootstrapSourceInput {
  sourceType: BrainSourceType
  displayName: string
  connectionRef?: string
  externalId?: string
  config?: Record<string, Json>
}

export interface BrainBootstrapInput {
  workspaceName: string
  industry?: string
  targetChannels: string[]
  brandName?: string
  brandId?: string
  approvalRules?: Record<string, Json>
  sources: BrainBootstrapSourceInput[]
  autoApproveLowRisk?: boolean
}

export interface BrainContext {
  snapshot: BrainSnapshot
  sources: BrainSource[]
  productFacts: ProductFact[]
  legalRules: LegalRule[]
}
