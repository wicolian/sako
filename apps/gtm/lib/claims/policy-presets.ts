/**
 * Policy Presets - Industry-specific compliance configurations
 * 
 * These presets power the /gate public validator with pre-configured
 * rules for common industries.
 */

import type { PolicyConfig } from './types'

export interface PolicyPreset {
  id: string
  name: string
  description: string
  icon: string
  config: PolicyConfig
}

/**
 * SaaS B2B - Default for software companies
 * Focus: Competitive claims, ROI promises, security certifications
 */
const SAAS_B2B_PRESET: PolicyPreset = {
  id: 'saas_b2b',
  name: 'SaaS B2B',
  description: 'Software companies selling to businesses',
  icon: '💻',
  config: {
    mode: 'standard',
    forbiddenTerms: [
      { term: 'guaranteed ROI', regex: false },
      { term: '100% uptime', regex: false },
      { term: 'hack-proof', regex: false },
      { term: 'unbreakable', regex: false },
      { term: 'zero risk', regex: false },
    ],
    regulatedCategories: {
      security: true,
      health: false,
      finance: true,
      legal: true,
    },
    superlativeRules: {
      block_without_proof: ['best', '#1', 'only', 'first', 'leading', 'top'],
      require_evidence_tier: 'A',
    },
    evidenceRequirements: {
      performance: 'B',
      security: 'A',
      pricing: 'C',
      compliance: 'A',
      generic: 'C',
    },
  },
}

/**
 * Healthcare/Medical - Strict FDA compliance
 * Focus: Treatment claims, diagnosis, therapeutic promises
 */
const HEALTHCARE_PRESET: PolicyPreset = {
  id: 'healthcare',
  name: 'Healthcare / Medical',
  description: 'FDA-regulated health products and services',
  icon: '🏥',
  config: {
    mode: 'strict',
    forbiddenTerms: [
      { term: 'cure', regex: false },
      { term: 'cures', regex: false },
      { term: 'treat', regex: false },
      { term: 'treats', regex: false },
      { term: 'diagnose', regex: false },
      { term: 'prevent', regex: false },
      { term: 'prevents', regex: false },
      { term: 'miracle', regex: false },
      { term: 'breakthrough cure', regex: false },
      { term: 'clinically proven', regex: false },
      { term: 'doctor recommended', regex: false },
      { term: 'FDA approved', regex: false },
    ],
    regulatedCategories: {
      security: false,
      health: true,
      finance: false,
      legal: true,
    },
    superlativeRules: {
      block_without_proof: ['best', '#1', 'only', 'safest', 'most effective'],
      require_evidence_tier: 'A',
    },
    evidenceRequirements: {
      performance: 'A',
      security: 'A',
      pricing: 'B',
      compliance: 'A',
      generic: 'B',
    },
  },
}

/**
 * Financial Services - SEC/FINRA compliance
 * Focus: Investment promises, ROI guarantees, earnings claims
 */
const FINANCIAL_PRESET: PolicyPreset = {
  id: 'financial',
  name: 'Financial Services',
  description: 'SEC and FINRA regulated financial products',
  icon: '💰',
  config: {
    mode: 'strict',
    forbiddenTerms: [
      { term: 'guaranteed returns', regex: false },
      { term: 'risk-free', regex: false },
      { term: 'can\'t lose', regex: false },
      { term: 'sure thing', regex: false },
      { term: 'get rich', regex: false },
      { term: 'double your money', regex: false },
      { term: 'no risk', regex: false },
      { term: 'insider', regex: false },
      { term: 'secret strategy', regex: false },
    ],
    regulatedCategories: {
      security: true,
      health: false,
      finance: true,
      legal: true,
    },
    superlativeRules: {
      block_without_proof: ['best', '#1', 'highest returns', 'top performing'],
      require_evidence_tier: 'A',
    },
    evidenceRequirements: {
      performance: 'A',
      security: 'A',
      pricing: 'A',
      compliance: 'A',
      generic: 'B',
    },
  },
}

/**
 * Legal Services - Bar association compliance
 * Focus: Outcome guarantees, success rates, case results
 */
const LEGAL_PRESET: PolicyPreset = {
  id: 'legal',
  name: 'Legal Services',
  description: 'Law firms and legal service providers',
  icon: '⚖️',
  config: {
    mode: 'strict',
    forbiddenTerms: [
      { term: 'guaranteed outcome', regex: false },
      { term: 'we always win', regex: false },
      { term: '100% success', regex: false },
      { term: 'never lost', regex: false },
      { term: 'best lawyer', regex: false },
      { term: 'top attorney', regex: false },
    ],
    regulatedCategories: {
      security: false,
      health: false,
      finance: true,
      legal: true,
    },
    superlativeRules: {
      block_without_proof: ['best', '#1', 'top rated', 'most successful'],
      require_evidence_tier: 'A',
    },
    evidenceRequirements: {
      performance: 'A',
      security: 'B',
      pricing: 'B',
      compliance: 'A',
      generic: 'B',
    },
  },
}

/**
 * E-commerce/DTC - FTC compliance
 * Focus: Pricing claims, "free" offers, discount truthfulness
 */
const ECOMMERCE_PRESET: PolicyPreset = {
  id: 'ecommerce',
  name: 'E-commerce / DTC',
  description: 'Direct-to-consumer retail and e-commerce',
  icon: '🛒',
  config: {
    mode: 'standard',
    forbiddenTerms: [
      { term: 'free gift', regex: false },
      { term: 'risk-free trial', regex: false },
      { term: 'lowest price guaranteed', regex: false },
      { term: 'best deal anywhere', regex: false },
      { term: 'never been cheaper', regex: false },
    ],
    regulatedCategories: {
      security: true,
      health: false,
      finance: true,
      legal: false,
    },
    superlativeRules: {
      block_without_proof: ['best', '#1', 'cheapest', 'lowest price'],
      require_evidence_tier: 'B',
    },
    evidenceRequirements: {
      performance: 'C',
      security: 'B',
      pricing: 'B',
      compliance: 'B',
      generic: 'C',
    },
  },
}

/**
 * Generic - Baseline FTC compliance
 * Focus: General marketing claims, basic truth-in-advertising
 */
const GENERIC_PRESET: PolicyPreset = {
  id: 'generic',
  name: 'Generic / Other',
  description: 'General baseline FTC compliance',
  icon: '📋',
  config: {
    mode: 'standard',
    forbiddenTerms: [
      { term: 'guaranteed', regex: false },
      { term: 'risk-free', regex: false },
    ],
    regulatedCategories: {
      security: false,
      health: false,
      finance: false,
      legal: false,
    },
    superlativeRules: {
      block_without_proof: ['best', '#1', 'only'],
      require_evidence_tier: 'B',
    },
    evidenceRequirements: {
      performance: 'C',
      security: 'B',
      pricing: 'C',
      compliance: 'B',
      generic: 'C',
    },
  },
}

/**
 * All available policy presets
 */
export const POLICY_PRESETS: PolicyPreset[] = [
  SAAS_B2B_PRESET,
  HEALTHCARE_PRESET,
  FINANCIAL_PRESET,
  LEGAL_PRESET,
  ECOMMERCE_PRESET,
  GENERIC_PRESET,
]

/**
 * Get a policy preset by ID
 */
export function getPolicyPreset(id: string): PolicyPreset | undefined {
  return POLICY_PRESETS.find(preset => preset.id === id)
}

/**
 * Get the default policy preset (SaaS B2B)
 */
export function getDefaultPreset(): PolicyPreset {
  return SAAS_B2B_PRESET
}

/**
 * Get all preset IDs for validation
 */
export function getPresetIds(): string[] {
  return POLICY_PRESETS.map(preset => preset.id)
}
