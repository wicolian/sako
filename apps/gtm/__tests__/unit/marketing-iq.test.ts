/**
 * Marketing IQ (Ad Frameworks) Unit Tests
 * 
 * Tests for the marketing framework system.
 */

import { describe, it, expect } from 'vitest'

describe('Marketing IQ - Ad Frameworks', () => {
  // =========================================================================
  // Framework Definitions
  // =========================================================================

  interface AdFramework {
    id: string
    name: string
    acronym?: string
    structure: string[]
    description: string
    bestFor: string[]
    example?: string
  }

  const FRAMEWORKS: AdFramework[] = [
    {
      id: 'aida',
      name: 'AIDA',
      structure: ['Attention', 'Interest', 'Desire', 'Action'],
      description: 'Classic marketing funnel framework',
      bestFor: ['landing_pages', 'email_sequences', 'ads'],
    },
    {
      id: 'pas',
      name: 'Problem-Agitate-Solution',
      acronym: 'PAS',
      structure: ['Problem', 'Agitate', 'Solution'],
      description: 'Pain point focused framework',
      bestFor: ['sales_copy', 'ads', 'email'],
    },
    {
      id: 'bab',
      name: 'Before-After-Bridge',
      acronym: 'BAB',
      structure: ['Before', 'After', 'Bridge'],
      description: 'Transformation focused framework',
      bestFor: ['case_studies', 'testimonials', 'landing_pages'],
    },
    {
      id: 'pastor',
      name: 'PASTOR',
      structure: ['Problem', 'Amplify', 'Story', 'Transformation', 'Offer', 'Response'],
      description: 'Comprehensive long-form framework',
      bestFor: ['sales_pages', 'webinars', 'long_form_content'],
    },
    {
      id: 'fab',
      name: 'Features-Advantages-Benefits',
      acronym: 'FAB',
      structure: ['Features', 'Advantages', 'Benefits'],
      description: 'Product-focused framework',
      bestFor: ['product_pages', 'feature_announcements', 'comparisons'],
    },
    {
      id: '4ps',
      name: '4 Ps',
      structure: ['Promise', 'Picture', 'Proof', 'Push'],
      description: 'Promise-driven framework',
      bestFor: ['headlines', 'ads', 'email_subject_lines'],
    },
    {
      id: 'quest',
      name: 'QUEST',
      structure: ['Qualify', 'Understand', 'Educate', 'Stimulate', 'Transition'],
      description: 'Audience-qualifying framework',
      bestFor: ['lead_generation', 'webinars', 'content_marketing'],
    },
    {
      id: 'slap',
      name: 'SLAP',
      structure: ['Stop', 'Look', 'Act', 'Purchase'],
      description: 'Attention-grabbing framework',
      bestFor: ['social_ads', 'display_ads', 'video_ads'],
    },
    {
      id: 'star',
      name: 'STAR',
      structure: ['Situation', 'Task', 'Action', 'Result'],
      description: 'Case study framework',
      bestFor: ['case_studies', 'testimonials', 'success_stories'],
    },
    {
      id: 'pppp',
      name: 'Four Ps (Picture-Promise-Prove-Push)',
      acronym: 'PPPP',
      structure: ['Picture', 'Promise', 'Prove', 'Push'],
      description: 'Visual storytelling framework',
      bestFor: ['video_scripts', 'landing_pages', 'presentations'],
    },
    {
      id: 'acca',
      name: 'ACCA',
      structure: ['Awareness', 'Comprehension', 'Conviction', 'Action'],
      description: 'Cognitive marketing framework',
      bestFor: ['educational_content', 'b2b_marketing', 'complex_products'],
    },
    {
      id: 'forest',
      name: 'FOREST',
      structure: ['Free value', 'Objections', 'Reinforce', 'Engage', 'Social proof', 'Target'],
      description: 'Objection-handling framework',
      bestFor: ['sales_pages', 'pricing_pages', 'faq_content'],
    },
    {
      id: 'aidca',
      name: 'AIDCA',
      structure: ['Attention', 'Interest', 'Desire', 'Conviction', 'Action'],
      description: 'Extended AIDA with conviction',
      bestFor: ['high_ticket_sales', 'b2b_enterprise', 'consultative_selling'],
    },
    {
      id: 'usp',
      name: 'Unique Selling Proposition',
      acronym: 'USP',
      structure: ['Identify unique benefit', 'Support with proof', 'Make compelling'],
      description: 'Differentiation framework',
      bestFor: ['brand_positioning', 'taglines', 'value_propositions'],
    },
    {
      id: 'scqa',
      name: 'SCQA',
      structure: ['Situation', 'Complication', 'Question', 'Answer'],
      description: 'McKinsey problem-solving framework',
      bestFor: ['consulting_proposals', 'strategy_documents', 'presentations'],
    },
  ]

  describe('Framework Library', () => {
    it('has at least 15 frameworks', () => {
      expect(FRAMEWORKS.length).toBeGreaterThanOrEqual(15)
    })

    it('all frameworks have required fields', () => {
      for (const fw of FRAMEWORKS) {
        expect(fw.id).toBeDefined()
        expect(fw.name).toBeDefined()
        expect(fw.structure).toBeDefined()
        expect(fw.structure.length).toBeGreaterThan(0)
        expect(fw.description).toBeDefined()
        expect(fw.bestFor).toBeDefined()
        expect(fw.bestFor.length).toBeGreaterThan(0)
      }
    })

    it('framework IDs are unique', () => {
      const ids = FRAMEWORKS.map(f => f.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  // =========================================================================
  // Framework Selection
  // =========================================================================

  describe('Framework Selection', () => {
    const selectFrameworksForUseCase = (useCase: string): AdFramework[] => {
      return FRAMEWORKS.filter(fw => fw.bestFor.includes(useCase))
    }

    const getFrameworkById = (id: string): AdFramework | undefined => {
      return FRAMEWORKS.find(fw => fw.id === id)
    }

    it('finds frameworks for landing pages', () => {
      const frameworks = selectFrameworksForUseCase('landing_pages')
      expect(frameworks.length).toBeGreaterThan(0)
      expect(frameworks.some(f => f.id === 'aida')).toBe(true)
    })

    it('finds frameworks for ads', () => {
      const frameworks = selectFrameworksForUseCase('ads')
      expect(frameworks.length).toBeGreaterThan(0)
    })

    it('finds frameworks for case studies', () => {
      const frameworks = selectFrameworksForUseCase('case_studies')
      expect(frameworks.length).toBeGreaterThan(0)
      expect(frameworks.some(f => f.id === 'star')).toBe(true)
    })

    it('gets framework by ID', () => {
      const aida = getFrameworkById('aida')
      expect(aida).toBeDefined()
      expect(aida?.name).toBe('AIDA')
    })

    it('returns undefined for unknown ID', () => {
      const unknown = getFrameworkById('nonexistent')
      expect(unknown).toBeUndefined()
    })
  })

  // =========================================================================
  // Prompt Generation
  // =========================================================================

  describe('Framework Prompt Generation', () => {
    const generateFrameworkPrompt = (framework: AdFramework, topic: string): string => {
      const structureList = framework.structure.map((s, i) => `${i + 1}. ${s}`).join('\n')
      
      return `Using the ${framework.name} framework, create marketing copy for: "${topic}"

Framework structure:
${structureList}

For each section, provide compelling copy that follows the framework's intent.`
    }

    it('generates prompt with framework name', () => {
      const aida = FRAMEWORKS.find(f => f.id === 'aida')!
      const prompt = generateFrameworkPrompt(aida, 'Project management software')

      expect(prompt).toContain('AIDA')
      expect(prompt).toContain('Project management software')
    })

    it('includes all structure elements', () => {
      const pas = FRAMEWORKS.find(f => f.id === 'pas')!
      const prompt = generateFrameworkPrompt(pas, 'Test product')

      expect(prompt).toContain('Problem')
      expect(prompt).toContain('Agitate')
      expect(prompt).toContain('Solution')
    })

    it('numbers structure elements', () => {
      const fab = FRAMEWORKS.find(f => f.id === 'fab')!
      const prompt = generateFrameworkPrompt(fab, 'Test')

      expect(prompt).toContain('1. Features')
      expect(prompt).toContain('2. Advantages')
      expect(prompt).toContain('3. Benefits')
    })
  })

  // =========================================================================
  // Framework Validation
  // =========================================================================

  describe('Framework Content Validation', () => {
    interface FrameworkContent {
      frameworkId: string
      sections: { name: string; content: string }[]
    }

    const validateFrameworkContent = (content: FrameworkContent): { valid: boolean; errors: string[] } => {
      const errors: string[] = []
      const framework = FRAMEWORKS.find(f => f.id === content.frameworkId)

      if (!framework) {
        errors.push('Invalid framework ID')
        return { valid: false, errors }
      }

      // Check all sections are present
      for (const requiredSection of framework.structure) {
        const found = content.sections.find(s => 
          s.name.toLowerCase() === requiredSection.toLowerCase()
        )
        if (!found) {
          errors.push(`Missing section: ${requiredSection}`)
        } else if (!found.content || found.content.trim().length < 10) {
          errors.push(`Section "${requiredSection}" is too short (minimum 10 characters)`)
        }
      }

      return { valid: errors.length === 0, errors }
    }

    it('validates complete content', () => {
      const content: FrameworkContent = {
        frameworkId: 'pas',
        sections: [
          { name: 'Problem', content: 'Your team wastes hours on manual tasks every week.' },
          { name: 'Agitate', content: 'This inefficiency costs you thousands in lost productivity.' },
          { name: 'Solution', content: 'Our automation tool eliminates these manual tasks instantly.' },
        ],
      }

      const result = validateFrameworkContent(content)
      expect(result.valid).toBe(true)
    })

    it('rejects missing sections', () => {
      const content: FrameworkContent = {
        frameworkId: 'pas',
        sections: [
          { name: 'Problem', content: 'Valid problem statement here.' },
          // Missing Agitate and Solution
        ],
      }

      const result = validateFrameworkContent(content)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing section: Agitate')
    })

    it('rejects short content', () => {
      const content: FrameworkContent = {
        frameworkId: 'pas',
        sections: [
          { name: 'Problem', content: 'Short' }, // Too short
          { name: 'Agitate', content: 'Valid agitation content here.' },
          { name: 'Solution', content: 'Valid solution content here.' },
        ],
      }

      const result = validateFrameworkContent(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('too short'))).toBe(true)
    })

    it('rejects invalid framework ID', () => {
      const content: FrameworkContent = {
        frameworkId: 'nonexistent',
        sections: [],
      }

      const result = validateFrameworkContent(content)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid framework ID')
    })
  })

  // =========================================================================
  // Framework Badge Display
  // =========================================================================

  describe('Framework Badge', () => {
    const formatFrameworkBadge = (framework: AdFramework): string => {
      return framework.acronym || framework.name.toUpperCase().slice(0, 4)
    }

    it('uses acronym when available', () => {
      const pas = FRAMEWORKS.find(f => f.id === 'pas')!
      expect(formatFrameworkBadge(pas)).toBe('PAS')
    })

    it('generates short name when no acronym', () => {
      // Create a framework without acronym
      const fw: AdFramework = {
        id: 'test',
        name: 'Test Framework',
        structure: ['A', 'B'],
        description: 'Test',
        bestFor: ['test'],
      }
      expect(formatFrameworkBadge(fw)).toBe('TEST')
    })
  })
})
