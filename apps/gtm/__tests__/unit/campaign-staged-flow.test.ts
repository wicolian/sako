/**
 * Campaign Staged Flow Unit Tests
 */

import { describe, it, expect } from 'vitest'

describe('Campaign Staged Flow', () => {
  describe('Stage Configuration', () => {
    interface Stage {
      id: string
      name: string
      order: number
      required: boolean
      canSkip?: boolean
    }

    const CAMPAIGN_STAGES: Stage[] = [
      { id: 'content', name: 'Content', order: 1, required: true },
      { id: 'design', name: 'Design', order: 2, required: false, canSkip: true },
      { id: 'compliance', name: 'Compliance', order: 3, required: true },
      { id: 'publish', name: 'Publish', order: 4, required: true },
      { id: 'performance', name: 'Performance', order: 5, required: false },
    ]

    it('has 5 stages', () => {
      expect(CAMPAIGN_STAGES).toHaveLength(5)
    })

    it('stages are in order', () => {
      for (let i = 0; i < CAMPAIGN_STAGES.length - 1; i++) {
        expect(CAMPAIGN_STAGES[i].order).toBeLessThan(CAMPAIGN_STAGES[i + 1].order)
      }
    })

    it('design stage can be skipped', () => {
      const design = CAMPAIGN_STAGES.find(s => s.id === 'design')
      expect(design?.canSkip).toBe(true)
    })

    it('compliance is required', () => {
      const compliance = CAMPAIGN_STAGES.find(s => s.id === 'compliance')
      expect(compliance?.required).toBe(true)
    })
  })

  describe('Progress Calculation', () => {
    interface StageProgress {
      stageId: string
      completed: boolean
      blockers?: string[]
    }

    const calculateProgress = (stages: StageProgress[]): number => {
      const completed = stages.filter(s => s.completed).length
      return Math.round((completed / stages.length) * 100)
    }

    const getBlockers = (stages: StageProgress[]): string[] => {
      return stages
        .filter(s => s.blockers && s.blockers.length > 0)
        .flatMap(s => s.blockers!)
    }

    it('calculates 0% for no completion', () => {
      const stages: StageProgress[] = [
        { stageId: 'content', completed: false },
        { stageId: 'design', completed: false },
        { stageId: 'compliance', completed: false },
      ]
      expect(calculateProgress(stages)).toBe(0)
    })

    it('calculates 100% for full completion', () => {
      const stages: StageProgress[] = [
        { stageId: 'content', completed: true },
        { stageId: 'design', completed: true },
        { stageId: 'compliance', completed: true },
      ]
      expect(calculateProgress(stages)).toBe(100)
    })

    it('calculates partial progress', () => {
      const stages: StageProgress[] = [
        { stageId: 'content', completed: true },
        { stageId: 'design', completed: false },
        { stageId: 'compliance', completed: false },
        { stageId: 'publish', completed: false },
      ]
      expect(calculateProgress(stages)).toBe(25)
    })

    it('collects blockers', () => {
      const stages: StageProgress[] = [
        { stageId: 'content', completed: true },
        { stageId: 'compliance', completed: false, blockers: ['2 claims need evidence', '1 claim blocked'] },
      ]
      const blockers = getBlockers(stages)
      expect(blockers).toContain('2 claims need evidence')
      expect(blockers).toContain('1 claim blocked')
    })
  })

  describe('Stage Unlock Logic', () => {
    interface Campaign {
      stages: {
        content: boolean
        design: boolean
        compliance: boolean
        publish: boolean
      }
    }

    const canUnlockStage = (campaign: Campaign, stageId: string): boolean => {
      switch (stageId) {
        case 'content':
          return true // Always unlocked
        case 'design':
          return campaign.stages.content
        case 'compliance':
          return campaign.stages.content
        case 'publish':
          return campaign.stages.compliance
        case 'performance':
          return campaign.stages.publish
        default:
          return false
      }
    }

    it('content is always unlocked', () => {
      const campaign: Campaign = {
        stages: { content: false, design: false, compliance: false, publish: false },
      }
      expect(canUnlockStage(campaign, 'content')).toBe(true)
    })

    it('design requires content', () => {
      const noContent: Campaign = {
        stages: { content: false, design: false, compliance: false, publish: false },
      }
      const withContent: Campaign = {
        stages: { content: true, design: false, compliance: false, publish: false },
      }
      expect(canUnlockStage(noContent, 'design')).toBe(false)
      expect(canUnlockStage(withContent, 'design')).toBe(true)
    })

    it('publish requires compliance', () => {
      const noCompliance: Campaign = {
        stages: { content: true, design: true, compliance: false, publish: false },
      }
      const withCompliance: Campaign = {
        stages: { content: true, design: true, compliance: true, publish: false },
      }
      expect(canUnlockStage(noCompliance, 'publish')).toBe(false)
      expect(canUnlockStage(withCompliance, 'publish')).toBe(true)
    })
  })

  describe('Blocker Detection', () => {
    interface ClaimStatus {
      supported: number
      weak: number
      blocked: number
      pending: number
    }

    const detectComplianceBlockers = (claims: ClaimStatus): string[] => {
      const blockers: string[] = []

      if (claims.blocked > 0) {
        blockers.push(`${claims.blocked} claim${claims.blocked > 1 ? 's' : ''} blocked`)
      }

      if (claims.weak > 0) {
        blockers.push(`${claims.weak} claim${claims.weak > 1 ? 's' : ''} need evidence`)
      }

      if (claims.pending > 0) {
        blockers.push(`${claims.pending} claim${claims.pending > 1 ? 's' : ''} pending review`)
      }

      return blockers
    }

    it('detects blocked claims', () => {
      const blockers = detectComplianceBlockers({ supported: 5, weak: 0, blocked: 2, pending: 0 })
      expect(blockers).toContain('2 claims blocked')
    })

    it('detects weak claims', () => {
      const blockers = detectComplianceBlockers({ supported: 5, weak: 3, blocked: 0, pending: 0 })
      expect(blockers).toContain('3 claims need evidence')
    })

    it('returns empty for all supported', () => {
      const blockers = detectComplianceBlockers({ supported: 5, weak: 0, blocked: 0, pending: 0 })
      expect(blockers).toHaveLength(0)
    })

    it('handles singular grammar', () => {
      const blockers = detectComplianceBlockers({ supported: 5, weak: 1, blocked: 1, pending: 0 })
      expect(blockers).toContain('1 claim blocked')
      expect(blockers).toContain('1 claim need evidence')
    })
  })
})
