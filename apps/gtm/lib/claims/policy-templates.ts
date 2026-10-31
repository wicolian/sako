/**
 * Policy Templates for Regulated Industries
 * 
 * Pre-configured compliance policies for common regulatory environments.
 * These templates provide sensible defaults that can be customized per workspace.
 */

import type { PolicyConfig } from './types';

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  industry: string;
  regulations: string[];
  policy: PolicyConfig;
}

/**
 * Default policy for general B2B SaaS
 */
export const DEFAULT_POLICY: PolicyTemplate = {
  id: 'default',
  name: 'Standard B2B SaaS',
  description: 'Balanced policy for general B2B software companies',
  industry: 'technology',
  regulations: [],
  policy: {
    mode: 'standard',
    forbiddenTerms: [
      { term: 'guaranteed', severity: 'block', replacement: 'designed to' },
      { term: 'always', severity: 'warn', replacement: 'typically' },
      { term: 'never', severity: 'warn', replacement: 'rarely' },
      { term: '100%', severity: 'block', replacement: 'up to' },
    ],
    regulatedCategories: {
      security: true,
      health: true,
      finance: true,
      legal: true,
    },
    superlativeRules: {
      block_without_proof: ['best', '#1', 'only', 'first', 'leading'],
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
};

/**
 * SOC 2 Type II Compliant Policy
 * For companies handling customer data with SOC 2 requirements
 */
export const SOC2_POLICY: PolicyTemplate = {
  id: 'soc2',
  name: 'SOC 2 Type II',
  description: 'Strict policy for SOC 2 certified companies making security claims',
  industry: 'technology',
  regulations: ['SOC 2 Type II', 'Trust Services Criteria'],
  policy: {
    mode: 'strict',
    forbiddenTerms: [
      { term: 'unhackable', severity: 'block', replacement: 'secure by design' },
      { term: 'bulletproof', severity: 'block', replacement: 'robust' },
      { term: 'impenetrable', severity: 'block', replacement: 'defense-in-depth' },
      { term: 'guaranteed secure', severity: 'block', replacement: 'designed with security in mind' },
      { term: '100% secure', severity: 'block', replacement: 'comprehensive security controls' },
      { term: 'never been breached', severity: 'block', replacement: 'strong security track record' },
      { term: 'military-grade', severity: 'warn', replacement: 'enterprise-grade' },
      { term: 'bank-level', severity: 'warn', replacement: 'industry-standard' },
    ],
    regulatedCategories: {
      security: true,
      health: false,
      finance: true,
      legal: true,
    },
    superlativeRules: {
      block_without_proof: ['most secure', 'safest', 'best protection', 'unbreakable'],
      require_evidence_tier: 'A',
    },
    evidenceRequirements: {
      performance: 'B',
      security: 'A', // Must have SOC 2 report or equivalent
      pricing: 'C',
      compliance: 'A',
      generic: 'B',
    },
  },
};

/**
 * HIPAA Compliant Policy
 * For healthcare and health tech companies
 */
export const HIPAA_POLICY: PolicyTemplate = {
  id: 'hipaa',
  name: 'HIPAA Healthcare',
  description: 'Strict policy for healthcare companies with PHI handling requirements',
  industry: 'healthcare',
  regulations: ['HIPAA', 'HITECH', 'FDA Guidelines'],
  policy: {
    mode: 'strict',
    forbiddenTerms: [
      // Health claims
      { term: 'cure', severity: 'block', replacement: 'designed to help manage' },
      { term: 'treat', severity: 'block', replacement: 'support' },
      { term: 'prevent', severity: 'block', replacement: 'may help reduce risk of' },
      { term: 'heal', severity: 'block', replacement: 'support recovery' },
      { term: 'diagnose', severity: 'block', replacement: 'identify potential' },
      { term: 'clinically proven', severity: 'block', replacement: 'studied in clinical settings' },
      { term: 'FDA approved', severity: 'block', replacement: 'FDA cleared' }, // Different standards
      { term: 'doctor recommended', severity: 'warn', replacement: 'healthcare provider input' },
      // Security for PHI
      { term: 'HIPAA certified', severity: 'block', replacement: 'HIPAA compliant' }, // No such thing as certified
      { term: '100% compliant', severity: 'block', replacement: 'designed for compliance' },
    ],
    regulatedCategories: {
      security: true,
      health: true, // Heavily regulated
      finance: true,
      legal: true,
    },
    superlativeRules: {
      block_without_proof: ['best treatment', 'most effective', 'safest', 'only solution'],
      require_evidence_tier: 'A',
    },
    evidenceRequirements: {
      performance: 'A', // Clinical evidence needed
      security: 'A', // BAA and HIPAA attestation needed
      pricing: 'C',
      compliance: 'A',
      generic: 'B',
    },
  },
};

/**
 * Fintech/Financial Services Policy
 * For companies in banking, payments, and financial technology
 */
export const FINTECH_POLICY: PolicyTemplate = {
  id: 'fintech',
  name: 'Fintech & Financial Services',
  description: 'Policy for companies making financial claims or handling money',
  industry: 'finance',
  regulations: ['SEC Guidelines', 'FINRA', 'CFPB', 'PCI DSS'],
  policy: {
    mode: 'strict',
    forbiddenTerms: [
      // Returns and earnings
      { term: 'guaranteed returns', severity: 'block', replacement: 'historical returns' },
      { term: 'risk-free', severity: 'block', replacement: 'risk-managed' },
      { term: 'get rich', severity: 'block', replacement: 'build wealth over time' },
      { term: 'double your money', severity: 'block', replacement: 'grow your investments' },
      { term: 'safe investment', severity: 'block', replacement: 'diversified investment' },
      { term: 'no fees', severity: 'block', replacement: 'low fees' }, // Always some fees somewhere
      // Comparisons
      { term: 'beat the market', severity: 'warn', replacement: 'market-competitive returns' },
      { term: 'outperform', severity: 'warn', replacement: 'historically performed' },
      // Security
      { term: 'FDIC insured', severity: 'block', replacement: '' }, // Only if actually true
      { term: 'bank-grade security', severity: 'warn', replacement: 'PCI-compliant security' },
    ],
    regulatedCategories: {
      security: true,
      health: false,
      finance: true, // Heavily regulated
      legal: true,
    },
    superlativeRules: {
      block_without_proof: ['highest returns', 'lowest fees', 'best rates', 'safest'],
      require_evidence_tier: 'A',
    },
    evidenceRequirements: {
      performance: 'A', // Need audited data
      security: 'A', // PCI DSS attestation
      pricing: 'A', // Fee disclosures required
      compliance: 'A',
      generic: 'B',
    },
  },
};

/**
 * E-commerce/Consumer Policy
 * For direct-to-consumer companies
 */
export const ECOMMERCE_POLICY: PolicyTemplate = {
  id: 'ecommerce',
  name: 'E-commerce & Consumer',
  description: 'Policy for consumer-facing e-commerce companies',
  industry: 'retail',
  regulations: ['FTC Guidelines', 'CAN-SPAM', 'Consumer Protection Laws'],
  policy: {
    mode: 'standard',
    forbiddenTerms: [
      // Pricing
      { term: 'free', severity: 'warn', replacement: '' }, // Check if actually free
      { term: 'limited time', severity: 'warn', replacement: '' }, // Must be true
      { term: 'while supplies last', severity: 'warn', replacement: '' },
      { term: 'best price', severity: 'block', replacement: 'competitive price' },
      // Product claims
      { term: 'miracle', severity: 'block', replacement: 'effective' },
      { term: 'instant results', severity: 'block', replacement: 'fast-acting' },
      { term: 'no side effects', severity: 'block', replacement: 'well-tolerated' },
      // Reviews
      { term: 'verified reviews', severity: 'warn', replacement: '' }, // Must be actually verified
      { term: 'top rated', severity: 'warn', replacement: 'highly rated' },
    ],
    regulatedCategories: {
      security: true,
      health: true, // If selling health products
      finance: false,
      legal: true,
    },
    superlativeRules: {
      block_without_proof: ['best seller', '#1 choice', 'most popular'],
      require_evidence_tier: 'B',
    },
    evidenceRequirements: {
      performance: 'B',
      security: 'B',
      pricing: 'B', // Price claims need backup
      compliance: 'B',
      generic: 'C',
    },
  },
};

/**
 * Legal/Professional Services Policy
 * For law firms, consultancies, and professional services
 */
export const LEGAL_SERVICES_POLICY: PolicyTemplate = {
  id: 'legal',
  name: 'Legal & Professional Services',
  description: 'Policy for law firms and professional service providers',
  industry: 'legal',
  regulations: ['ABA Model Rules', 'State Bar Guidelines'],
  policy: {
    mode: 'strict',
    forbiddenTerms: [
      { term: 'guaranteed outcome', severity: 'block', replacement: 'dedicated representation' },
      { term: 'we will win', severity: 'block', replacement: 'we fight for you' },
      { term: 'best lawyers', severity: 'block', replacement: 'experienced attorneys' },
      { term: 'top rated', severity: 'warn', replacement: 'highly reviewed' },
      { term: 'specialist', severity: 'warn', replacement: 'focused on' }, // May be regulated term
      { term: 'expert', severity: 'warn', replacement: 'experienced in' },
      { term: 'free consultation', severity: 'warn', replacement: '' }, // Verify it's truly free
    ],
    regulatedCategories: {
      security: true,
      health: false,
      finance: true,
      legal: true, // Heavily self-regulated
    },
    superlativeRules: {
      block_without_proof: ['best firm', 'top attorneys', 'highest success rate'],
      require_evidence_tier: 'A',
    },
    evidenceRequirements: {
      performance: 'A', // Case outcomes need documentation
      security: 'B',
      pricing: 'B',
      compliance: 'A',
      generic: 'B',
    },
  },
};

/**
 * Relaxed/Creative Policy
 * For companies that want maximum creative freedom with basic guardrails
 */
export const RELAXED_POLICY: PolicyTemplate = {
  id: 'relaxed',
  name: 'Creative Freedom',
  description: 'Minimal restrictions for maximum marketing creativity',
  industry: 'general',
  regulations: [],
  policy: {
    mode: 'relaxed',
    forbiddenTerms: [
      // Only block truly dangerous claims
      { term: 'cure', severity: 'block', replacement: 'help with' },
      { term: 'guaranteed', severity: 'warn', replacement: 'designed to' },
    ],
    regulatedCategories: {
      security: false,
      health: true, // Still protect health claims
      finance: false,
      legal: false,
    },
    superlativeRules: {
      block_without_proof: [], // Allow superlatives
      require_evidence_tier: 'C',
    },
    evidenceRequirements: {
      performance: 'C',
      security: 'C',
      pricing: 'C',
      compliance: 'C',
      generic: 'C',
    },
  },
};

/**
 * All available policy templates
 */
export const POLICY_TEMPLATES: PolicyTemplate[] = [
  DEFAULT_POLICY,
  SOC2_POLICY,
  HIPAA_POLICY,
  FINTECH_POLICY,
  ECOMMERCE_POLICY,
  LEGAL_SERVICES_POLICY,
  RELAXED_POLICY,
];

/**
 * Get a policy template by ID
 */
export function getPolicyTemplate(id: string): PolicyTemplate | undefined {
  return POLICY_TEMPLATES.find(t => t.id === id);
}

/**
 * Get policy templates by industry
 */
export function getPolicyTemplatesByIndustry(industry: string): PolicyTemplate[] {
  return POLICY_TEMPLATES.filter(t => 
    t.industry === industry || t.industry === 'general'
  );
}

/**
 * Create a custom policy by merging a template with overrides
 */
export function customizePolicy(
  templateId: string,
  overrides: Partial<PolicyConfig>
): PolicyConfig {
  const template = getPolicyTemplate(templateId);
  if (!template) {
    throw new Error(`Unknown policy template: ${templateId}`);
  }

  return {
    ...template.policy,
    ...overrides,
    forbiddenTerms: [
      ...(template.policy.forbiddenTerms || []),
      ...(overrides.forbiddenTerms || []),
    ],
    regulatedCategories: {
      ...template.policy.regulatedCategories,
      ...overrides.regulatedCategories,
    },
    superlativeRules: {
      ...template.policy.superlativeRules,
      ...overrides.superlativeRules,
    },
    evidenceRequirements: {
      ...template.policy.evidenceRequirements,
      ...overrides.evidenceRequirements,
    },
  };
}
