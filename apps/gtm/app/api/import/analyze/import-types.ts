import type { BrandAnalysis } from '@/lib/import/brand-extractor'
import type { DesignTokens } from '@/lib/import/design-extractor'
import type { ExtractedClaim } from '@/lib/import/claims-extractor'
import type { EvidenceCandidate } from '@/lib/import/evidence-researcher'
import type { LinkedEvidence } from '@/lib/import/evidence-linker'

export interface ImportRequest {
  url: string
  confirmOwnership: boolean
}

export interface ImportProgress {
  event: 'progress'
  stage: string
  progress: number
  message?: string
  partialData?: Record<string, unknown>
}

export interface ImportResult {
  event: 'complete'
  data: {
    brandId: string
    sourceUrl: string
    brand: BrandAnalysis
    designTokens: DesignTokens
    claims: ExtractedClaim[]
    evidence: EvidenceCandidate[]
    linkedEvidence: LinkedEvidence[]
    sanitizedHtml: string
    sections: Array<{
      id: string
      type: string
      textContent: string
    }>
    summary: {
      claimsTotal: number
      claimsSupported: number
      claimsNeedReview: number
      claimsBlocked: number
      evidenceFound: number
      complianceScore: number
      complianceGrade: string
    }
    brandContext: Record<string, unknown>
    proofProfile: {
      recommendedStrategy: 'product-proof' | 'customer-proof' | 'evidence-stack' | 'compliance-proof'
      candidates: string[]
      gaps: string[]
    }
    metadataSource?: 'brandfetch' | 'html_ai'
    evidenceStatus?: 'completed' | 'skipped'
    evidenceMessage?: string
  }
}

export interface ImportError {
  event: 'error'
  error: string
  stage: string
}

export type StreamEvent = ImportProgress | ImportResult | ImportError
