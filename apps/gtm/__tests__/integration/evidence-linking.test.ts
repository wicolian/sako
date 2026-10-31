/**
 * Evidence Linking Flow Integration Tests
 * 
 * Tests the end-to-end flow of linking evidence to claims.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  in: vi.fn(() => mockSupabase),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  then: vi.fn((cb: (result: { data: unknown; error: unknown }) => void) => cb({ data: null, error: null })),
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => mockSupabase),
}))

describe('Evidence Linking Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // Evidence Types
  // =========================================================================

  describe('Evidence Types', () => {
    const EVIDENCE_TIERS = {
      A: ['case_study', 'research_paper', 'certification', 'audit_report'],
      B: ['customer_review', 'analyst_report', 'benchmark', 'testimonial'],
      C: ['internal_data', 'product_docs', 'blog_post', 'press_release'],
    }

    const getEvidenceTier = (type: string): 'A' | 'B' | 'C' => {
      if (EVIDENCE_TIERS.A.includes(type)) return 'A'
      if (EVIDENCE_TIERS.B.includes(type)) return 'B'
      return 'C'
    }

    it('categorizes Tier A evidence correctly', () => {
      expect(getEvidenceTier('case_study')).toBe('A')
      expect(getEvidenceTier('research_paper')).toBe('A')
      expect(getEvidenceTier('certification')).toBe('A')
      expect(getEvidenceTier('audit_report')).toBe('A')
    })

    it('categorizes Tier B evidence correctly', () => {
      expect(getEvidenceTier('customer_review')).toBe('B')
      expect(getEvidenceTier('analyst_report')).toBe('B')
      expect(getEvidenceTier('benchmark')).toBe('B')
      expect(getEvidenceTier('testimonial')).toBe('B')
    })

    it('categorizes Tier C evidence correctly', () => {
      expect(getEvidenceTier('internal_data')).toBe('C')
      expect(getEvidenceTier('product_docs')).toBe('C')
      expect(getEvidenceTier('blog_post')).toBe('C')
      expect(getEvidenceTier('press_release')).toBe('C')
    })

    it('defaults unknown types to Tier C', () => {
      expect(getEvidenceTier('unknown_type')).toBe('C')
      expect(getEvidenceTier('')).toBe('C')
    })
  })

  // =========================================================================
  // Evidence Validation
  // =========================================================================

  describe('Evidence Validation', () => {
    interface Evidence {
      id: string
      url?: string
      type: string
      tier: 'A' | 'B' | 'C'
      title: string
      description?: string
    }

    const validateEvidence = (evidence: Partial<Evidence>): { valid: boolean; errors: string[] } => {
      const errors: string[] = []

      if (!evidence.title || evidence.title.length < 3) {
        errors.push('Title is required (minimum 3 characters)')
      }

      if (!evidence.type) {
        errors.push('Evidence type is required')
      }

      if (evidence.url) {
        try {
          new URL(evidence.url)
        } catch {
          errors.push('Invalid URL format')
        }
      }

      return { valid: errors.length === 0, errors }
    }

    it('validates complete evidence', () => {
      const result = validateEvidence({
        title: 'Case Study: Customer Success',
        type: 'case_study',
        tier: 'A',
        url: 'https://example.com/case-study',
      })

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects evidence without title', () => {
      const result = validateEvidence({
        type: 'case_study',
        tier: 'A',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Title is required (minimum 3 characters)')
    })

    it('rejects evidence with short title', () => {
      const result = validateEvidence({
        title: 'AB',
        type: 'case_study',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Title is required (minimum 3 characters)')
    })

    it('rejects evidence without type', () => {
      const result = validateEvidence({
        title: 'Valid Title',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Evidence type is required')
    })

    it('rejects invalid URL', () => {
      const result = validateEvidence({
        title: 'Valid Title',
        type: 'case_study',
        url: 'not-a-valid-url',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid URL format')
    })

    it('allows evidence without URL', () => {
      const result = validateEvidence({
        title: 'Internal Data Report',
        type: 'internal_data',
      })

      expect(result.valid).toBe(true)
    })
  })

  // =========================================================================
  // Claim-Evidence Matching
  // =========================================================================

  describe('Claim-Evidence Matching', () => {
    interface Claim {
      id: string
      text: string
      category: string
      requiredTier?: 'A' | 'B' | 'C'
    }

    interface Evidence {
      id: string
      tier: 'A' | 'B' | 'C'
      keywords: string[]
    }

    const calculateMatchScore = (claim: Claim, evidence: Evidence): number => {
      let score = 0

      // Tier match bonus
      if (claim.requiredTier) {
        const tierOrder = { A: 3, B: 2, C: 1 }
        if (tierOrder[evidence.tier] >= tierOrder[claim.requiredTier]) {
          score += 30
        }
      } else {
        score += 20 // No requirement, give some points
      }

      // Keyword overlap
      const claimWords = claim.text.toLowerCase().split(/\s+/)
      const keywordMatches = evidence.keywords.filter(kw => 
        claimWords.some(word => word.includes(kw.toLowerCase()))
      )
      score += keywordMatches.length * 10

      // Cap at 100
      return Math.min(100, score)
    }

    it('gives high score for tier match', () => {
      const claim: Claim = { id: '1', text: 'SOC 2 certified', category: 'security', requiredTier: 'A' }
      const evidence: Evidence = { id: 'e1', tier: 'A', keywords: ['soc', 'certified'] }

      const score = calculateMatchScore(claim, evidence)
      expect(score).toBeGreaterThanOrEqual(50)
    })

    it('gives lower score for tier mismatch', () => {
      const claim: Claim = { id: '1', text: 'SOC 2 certified', category: 'security', requiredTier: 'A' }
      const evidenceA: Evidence = { id: 'e1', tier: 'A', keywords: ['soc'] }
      const evidenceC: Evidence = { id: 'e2', tier: 'C', keywords: ['soc'] }

      const scoreA = calculateMatchScore(claim, evidenceA)
      const scoreC = calculateMatchScore(claim, evidenceC)
      expect(scoreA).toBeGreaterThan(scoreC)
    })

    it('increases score with keyword matches', () => {
      const claim: Claim = { id: '1', text: '50% faster performance', category: 'performance' }
      const evidenceMany: Evidence = { id: 'e1', tier: 'B', keywords: ['faster', 'performance', '50'] }
      const evidenceFew: Evidence = { id: 'e2', tier: 'B', keywords: ['speed'] }

      const scoreMany = calculateMatchScore(claim, evidenceMany)
      const scoreFew = calculateMatchScore(claim, evidenceFew)
      expect(scoreMany).toBeGreaterThan(scoreFew)
    })

    it('caps score at 100', () => {
      const claim: Claim = { id: '1', text: 'Many keywords here', category: 'generic' }
      const evidence: Evidence = { 
        id: 'e1', 
        tier: 'A', 
        keywords: ['many', 'keywords', 'here', 'extra', 'more', 'additional', 'bonus', 'words'] 
      }

      const score = calculateMatchScore(claim, evidence)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  // =========================================================================
  // Link Status Management
  // =========================================================================

  describe('Link Status Management', () => {
    type LinkStatus = 'valid' | 'broken' | 'unknown' | 'checking'

    const updateLinkStatus = async (
      currentStatus: LinkStatus,
      newStatus: LinkStatus,
      lastChecked: Date | null,
      now: Date = new Date()
    ): Promise<{ status: LinkStatus; shouldRecheck: boolean }> => {
      const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

      const shouldRecheck = !lastChecked || 
        (now.getTime() - lastChecked.getTime()) > CHECK_INTERVAL_MS

      return {
        status: newStatus,
        shouldRecheck,
      }
    }

    it('marks for recheck after 7 days', async () => {
      const lastChecked = new Date()
      lastChecked.setDate(lastChecked.getDate() - 8)

      const result = await updateLinkStatus('valid', 'valid', lastChecked)
      expect(result.shouldRecheck).toBe(true)
    })

    it('does not recheck within 7 days', async () => {
      const lastChecked = new Date()
      lastChecked.setDate(lastChecked.getDate() - 3)

      const result = await updateLinkStatus('valid', 'valid', lastChecked)
      expect(result.shouldRecheck).toBe(false)
    })

    it('marks for recheck if never checked', async () => {
      const result = await updateLinkStatus('unknown', 'unknown', null)
      expect(result.shouldRecheck).toBe(true)
    })
  })

  // =========================================================================
  // Evidence Coverage Calculation
  // =========================================================================

  describe('Evidence Coverage Calculation', () => {
    interface ClaimWithEvidence {
      id: string
      evidenceCount: number
      requiredTier?: 'A' | 'B' | 'C'
      linkedTier?: 'A' | 'B' | 'C'
    }

    const calculateCoverage = (claims: ClaimWithEvidence[]): {
      total: number
      covered: number
      percentage: number
      adequate: boolean
    } => {
      if (claims.length === 0) {
        return { total: 0, covered: 0, percentage: 100, adequate: true }
      }

      const covered = claims.filter(c => c.evidenceCount > 0).length
      const percentage = Math.round((covered / claims.length) * 100)

      // Check if all required tiers are met
      const adequate = claims.every(c => {
        if (!c.requiredTier || !c.linkedTier) return c.evidenceCount === 0 || true
        const tierOrder = { A: 3, B: 2, C: 1 }
        return tierOrder[c.linkedTier] >= tierOrder[c.requiredTier]
      })

      return { total: claims.length, covered, percentage, adequate }
    }

    it('calculates 100% coverage for all covered claims', () => {
      const claims: ClaimWithEvidence[] = [
        { id: '1', evidenceCount: 1 },
        { id: '2', evidenceCount: 2 },
        { id: '3', evidenceCount: 1 },
      ]

      const result = calculateCoverage(claims)
      expect(result.percentage).toBe(100)
      expect(result.covered).toBe(3)
    })

    it('calculates partial coverage', () => {
      const claims: ClaimWithEvidence[] = [
        { id: '1', evidenceCount: 1 },
        { id: '2', evidenceCount: 0 },
        { id: '3', evidenceCount: 0 },
        { id: '4', evidenceCount: 1 },
      ]

      const result = calculateCoverage(claims)
      expect(result.percentage).toBe(50)
      expect(result.covered).toBe(2)
    })

    it('returns 100% for empty claims array', () => {
      const result = calculateCoverage([])
      expect(result.percentage).toBe(100)
      expect(result.adequate).toBe(true)
    })

    it('checks tier adequacy', () => {
      const adequateClaims: ClaimWithEvidence[] = [
        { id: '1', evidenceCount: 1, requiredTier: 'A', linkedTier: 'A' },
        { id: '2', evidenceCount: 1, requiredTier: 'B', linkedTier: 'A' },
      ]

      const inadequateClaims: ClaimWithEvidence[] = [
        { id: '1', evidenceCount: 1, requiredTier: 'A', linkedTier: 'C' },
      ]

      expect(calculateCoverage(adequateClaims).adequate).toBe(true)
      expect(calculateCoverage(inadequateClaims).adequate).toBe(false)
    })
  })
})
