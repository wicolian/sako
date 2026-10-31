/**
 * Approval Templates Unit Tests
 */

import { describe, it, expect } from 'vitest'

describe('Approval Templates', () => {
  describe('Template Definition', () => {
    interface ApprovalStage {
      id: string
      name: string
      order: number
      approvers: string[] // User IDs or roles
      requiredApprovals: number
      escalationAfter?: number // Hours
    }

    interface ApprovalTemplate {
      id: string
      name: string
      description: string
      stages: ApprovalStage[]
      autoApply: {
        claimCategories?: string[]
        riskScoreThreshold?: number
      }
    }

    const TEMPLATES: ApprovalTemplate[] = [
      {
        id: 'standard',
        name: 'Standard Review',
        description: 'Single stage approval for general content',
        stages: [
          {
            id: 'review',
            name: 'Content Review',
            order: 1,
            approvers: ['marketing_manager'],
            requiredApprovals: 1,
          },
        ],
        autoApply: {},
      },
      {
        id: 'regulated',
        name: 'Regulated Content',
        description: 'Two-stage approval for regulated categories',
        stages: [
          {
            id: 'marketing',
            name: 'Marketing Review',
            order: 1,
            approvers: ['marketing_manager'],
            requiredApprovals: 1,
            escalationAfter: 24,
          },
          {
            id: 'legal',
            name: 'Legal Review',
            order: 2,
            approvers: ['legal_team'],
            requiredApprovals: 1,
            escalationAfter: 48,
          },
        ],
        autoApply: {
          claimCategories: ['security', 'compliance', 'pricing'],
          riskScoreThreshold: 50,
        },
      },
      {
        id: 'enterprise',
        name: 'Enterprise Approval',
        description: 'Multi-stage approval with parallel reviewers',
        stages: [
          {
            id: 'team',
            name: 'Team Review',
            order: 1,
            approvers: ['team_lead', 'senior_marketer'],
            requiredApprovals: 1,
          },
          {
            id: 'stakeholder',
            name: 'Stakeholder Sign-off',
            order: 2,
            approvers: ['marketing_director', 'product_owner'],
            requiredApprovals: 2,
          },
        ],
        autoApply: {},
      },
    ]

    it('has multiple templates defined', () => {
      expect(TEMPLATES.length).toBeGreaterThanOrEqual(3)
    })

    it('templates have required fields', () => {
      for (const template of TEMPLATES) {
        expect(template.id).toBeDefined()
        expect(template.name).toBeDefined()
        expect(template.stages.length).toBeGreaterThan(0)
      }
    })

    it('stages are properly ordered', () => {
      for (const template of TEMPLATES) {
        for (let i = 0; i < template.stages.length - 1; i++) {
          expect(template.stages[i].order).toBeLessThan(template.stages[i + 1].order)
        }
      }
    })

    it('regulated template has auto-apply rules', () => {
      const regulated = TEMPLATES.find(t => t.id === 'regulated')
      expect(regulated?.autoApply.claimCategories).toBeDefined()
      expect(regulated?.autoApply.riskScoreThreshold).toBeDefined()
    })
  })

  describe('Template Selection', () => {
    interface ClaimContext {
      category: string
      riskScore: number
      hasRegulatedClaims: boolean
    }

    interface Template {
      id: string
      autoApply: {
        claimCategories?: string[]
        riskScoreThreshold?: number
      }
    }

    const selectTemplate = (context: ClaimContext, templates: Template[]): string => {
      // Check for regulated categories
      for (const template of templates) {
        if (template.autoApply.claimCategories?.includes(context.category)) {
          return template.id
        }
        if (template.autoApply.riskScoreThreshold &&
            context.riskScore >= template.autoApply.riskScoreThreshold) {
          return template.id
        }
      }
      return 'standard'
    }

    it('selects regulated template for security claims', () => {
      const templates: Template[] = [
        { id: 'standard', autoApply: {} },
        { id: 'regulated', autoApply: { claimCategories: ['security'] } },
      ]
      const context: ClaimContext = { category: 'security', riskScore: 30, hasRegulatedClaims: true }

      expect(selectTemplate(context, templates)).toBe('regulated')
    })

    it('selects based on risk score', () => {
      const templates: Template[] = [
        { id: 'standard', autoApply: {} },
        { id: 'high-risk', autoApply: { riskScoreThreshold: 50 } },
      ]
      const context: ClaimContext = { category: 'generic', riskScore: 60, hasRegulatedClaims: false }

      expect(selectTemplate(context, templates)).toBe('high-risk')
    })

    it('defaults to standard', () => {
      const templates: Template[] = [
        { id: 'standard', autoApply: {} },
        { id: 'regulated', autoApply: { claimCategories: ['security'] } },
      ]
      const context: ClaimContext = { category: 'generic', riskScore: 20, hasRegulatedClaims: false }

      expect(selectTemplate(context, templates)).toBe('standard')
    })
  })

  describe('Approval Status Tracking', () => {
    interface ApprovalStatus {
      templateId: string
      currentStage: number
      stageStatuses: {
        stageId: string
        status: 'pending' | 'approved' | 'rejected' | 'escalated'
        approvers: { userId: string; approved: boolean; timestamp?: string }[]
      }[]
    }

    const calculateOverallStatus = (status: ApprovalStatus): 'pending' | 'approved' | 'rejected' => {
      for (const stage of status.stageStatuses) {
        if (stage.status === 'rejected') return 'rejected'
        if (stage.status === 'pending') return 'pending'
      }
      return 'approved'
    }

    const canAdvance = (status: ApprovalStatus, requiredApprovals: number): boolean => {
      const currentStageStatus = status.stageStatuses.find(
        s => status.stageStatuses.indexOf(s) === status.currentStage - 1
      )
      if (!currentStageStatus) return false

      const approvedCount = currentStageStatus.approvers.filter(a => a.approved).length
      return approvedCount >= requiredApprovals
    }

    it('returns pending when stages incomplete', () => {
      const status: ApprovalStatus = {
        templateId: 'standard',
        currentStage: 1,
        stageStatuses: [
          { stageId: 'review', status: 'pending', approvers: [] },
        ],
      }
      expect(calculateOverallStatus(status)).toBe('pending')
    })

    it('returns rejected when any stage rejected', () => {
      const status: ApprovalStatus = {
        templateId: 'regulated',
        currentStage: 2,
        stageStatuses: [
          { stageId: 'marketing', status: 'approved', approvers: [{ userId: '1', approved: true }] },
          { stageId: 'legal', status: 'rejected', approvers: [{ userId: '2', approved: false }] },
        ],
      }
      expect(calculateOverallStatus(status)).toBe('rejected')
    })

    it('returns approved when all stages complete', () => {
      const status: ApprovalStatus = {
        templateId: 'standard',
        currentStage: 1,
        stageStatuses: [
          { stageId: 'review', status: 'approved', approvers: [{ userId: '1', approved: true }] },
        ],
      }
      expect(calculateOverallStatus(status)).toBe('approved')
    })

    it('allows advance when required approvals met', () => {
      const status: ApprovalStatus = {
        templateId: 'enterprise',
        currentStage: 1,
        stageStatuses: [
          {
            stageId: 'team',
            status: 'pending',
            approvers: [{ userId: '1', approved: true }],
          },
        ],
      }
      expect(canAdvance(status, 1)).toBe(true)
    })

    it('prevents advance when approvals not met', () => {
      const status: ApprovalStatus = {
        templateId: 'enterprise',
        currentStage: 1,
        stageStatuses: [
          {
            stageId: 'team',
            status: 'pending',
            approvers: [{ userId: '1', approved: false }],
          },
        ],
      }
      expect(canAdvance(status, 1)).toBe(false)
    })
  })

  describe('Escalation Logic', () => {
    const shouldEscalate = (
      stageStartTime: Date,
      escalationAfterHours: number,
      now: Date = new Date()
    ): boolean => {
      const hoursSinceStart = (now.getTime() - stageStartTime.getTime()) / (1000 * 60 * 60)
      return hoursSinceStart >= escalationAfterHours
    }

    it('does not escalate before threshold', () => {
      const start = new Date()
      start.setHours(start.getHours() - 12)
      expect(shouldEscalate(start, 24)).toBe(false)
    })

    it('escalates after threshold', () => {
      const start = new Date()
      start.setHours(start.getHours() - 25)
      expect(shouldEscalate(start, 24)).toBe(true)
    })

    it('escalates exactly at threshold', () => {
      const start = new Date()
      start.setHours(start.getHours() - 24)
      expect(shouldEscalate(start, 24)).toBe(true)
    })
  })
})
