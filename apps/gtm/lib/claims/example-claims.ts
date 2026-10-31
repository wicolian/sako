/**
 * Example Claims - Pre-loaded demo claims for each industry
 * 
 * Used in the /gate public validator to show ClaimsOS in action
 * before users paste their own copy.
 */

export interface ExampleClaim {
  text: string
  expectedStatus: 'approved' | 'needs_proof' | 'blocked'
  note: string
}

export interface IndustryExamples {
  industry: string
  industryId: string
  claims: ExampleClaim[]
}

/**
 * SaaS B2B Examples
 */
const SAAS_EXAMPLES: IndustryExamples = {
  industry: 'SaaS B2B',
  industryId: 'saas_b2b',
  claims: [
    {
      text: 'Trusted by 10,000+ companies worldwide',
      expectedStatus: 'approved',
      note: 'Social proof with specific number, no superlative',
    },
    {
      text: 'The #1 rated CRM platform for startups',
      expectedStatus: 'needs_proof',
      note: 'Superlative "#1" requires third-party evidence',
    },
    {
      text: 'Guaranteed 100% uptime with our enterprise plan',
      expectedStatus: 'blocked',
      note: 'Absolute claim "100% uptime" is provably false',
    },
    {
      text: 'Teams save an average of 5 hours per week',
      expectedStatus: 'needs_proof',
      note: 'Quantified claim requires baseline study',
    },
  ],
}

/**
 * Healthcare Examples
 */
const HEALTHCARE_EXAMPLES: IndustryExamples = {
  industry: 'Healthcare / Medical',
  industryId: 'healthcare',
  claims: [
    {
      text: 'Our app helps you track your daily wellness habits',
      expectedStatus: 'approved',
      note: 'Describes functionality without making health claims',
    },
    {
      text: 'Clinically proven to reduce anxiety in 30 days',
      expectedStatus: 'blocked',
      note: '"Clinically proven" requires FDA review for health claims',
    },
    {
      text: 'May support healthy sleep patterns when combined with good habits',
      expectedStatus: 'needs_proof',
      note: 'Hedged health claim still needs substantiation',
    },
    {
      text: 'This supplement cures chronic fatigue',
      expectedStatus: 'blocked',
      note: '"Cures" is a forbidden term for supplements',
    },
  ],
}

/**
 * Financial Services Examples
 */
const FINANCIAL_EXAMPLES: IndustryExamples = {
  industry: 'Financial Services',
  industryId: 'financial',
  claims: [
    {
      text: 'Start investing with as little as $1',
      expectedStatus: 'approved',
      note: 'Factual statement about minimum investment',
    },
    {
      text: 'Our fund has returned 12% annually over the past 5 years',
      expectedStatus: 'needs_proof',
      note: 'Performance claim requires documented evidence',
    },
    {
      text: 'Guaranteed 20% returns on your investment',
      expectedStatus: 'blocked',
      note: '"Guaranteed returns" violates SEC regulations',
    },
    {
      text: 'Join 500,000+ investors managing their portfolios',
      expectedStatus: 'approved',
      note: 'User count is verifiable social proof',
    },
  ],
}

/**
 * Legal Services Examples
 */
const LEGAL_EXAMPLES: IndustryExamples = {
  industry: 'Legal Services',
  industryId: 'legal',
  claims: [
    {
      text: 'Over 20 years of experience in personal injury law',
      expectedStatus: 'approved',
      note: 'Verifiable experience claim',
    },
    {
      text: 'We\'ve recovered $50M+ for our clients',
      expectedStatus: 'needs_proof',
      note: 'Aggregate recovery claim needs documentation',
    },
    {
      text: 'Best personal injury lawyers in California',
      expectedStatus: 'blocked',
      note: '"Best" superlative violates bar association rules',
    },
    {
      text: 'Free consultation with no obligation',
      expectedStatus: 'approved',
      note: 'Standard service offering, no problematic claims',
    },
  ],
}

/**
 * E-commerce Examples
 */
const ECOMMERCE_EXAMPLES: IndustryExamples = {
  industry: 'E-commerce / DTC',
  industryId: 'ecommerce',
  claims: [
    {
      text: 'Free shipping on orders over $50',
      expectedStatus: 'approved',
      note: 'Clear conditional offer',
    },
    {
      text: 'Rated 4.8 stars by 10,000+ customers',
      expectedStatus: 'approved',
      note: 'Verifiable customer rating',
    },
    {
      text: 'Lowest prices guaranteed or we\'ll match it',
      expectedStatus: 'needs_proof',
      note: 'Price guarantee needs clear policy documentation',
    },
    {
      text: 'The only sustainable t-shirt you\'ll ever need',
      expectedStatus: 'needs_proof',
      note: '"Only" superlative requires substantiation',
    },
  ],
}

/**
 * Generic Examples
 */
const GENERIC_EXAMPLES: IndustryExamples = {
  industry: 'Generic / Other',
  industryId: 'generic',
  claims: [
    {
      text: 'Join thousands of happy customers',
      expectedStatus: 'approved',
      note: 'General social proof without specific claims',
    },
    {
      text: 'Award-winning customer service team',
      expectedStatus: 'needs_proof',
      note: 'Award claims need evidence of actual award',
    },
    {
      text: 'The best solution for your business needs',
      expectedStatus: 'needs_proof',
      note: '"Best" requires comparative evidence',
    },
    {
      text: 'Risk-free with our money-back guarantee',
      expectedStatus: 'blocked',
      note: '"Risk-free" is misleading - there\'s always some risk',
    },
  ],
}

/**
 * All industry examples
 */
export const ALL_EXAMPLES: IndustryExamples[] = [
  SAAS_EXAMPLES,
  HEALTHCARE_EXAMPLES,
  FINANCIAL_EXAMPLES,
  LEGAL_EXAMPLES,
  ECOMMERCE_EXAMPLES,
  GENERIC_EXAMPLES,
]

/**
 * Get examples for a specific industry
 */
export function getExamplesForIndustry(industryId: string): ExampleClaim[] {
  const industry = ALL_EXAMPLES.find(ex => ex.industryId === industryId)
  return industry?.claims || GENERIC_EXAMPLES.claims
}

/**
 * Get a random example for quick demo
 */
export function getRandomExample(): { claim: ExampleClaim; industry: string } {
  const industry = ALL_EXAMPLES[Math.floor(Math.random() * ALL_EXAMPLES.length)]
  const claim = industry.claims[Math.floor(Math.random() * industry.claims.length)]
  return { claim, industry: industry.industry }
}

/**
 * Get all examples flattened for search
 */
export function getAllExamplesFlat(): Array<ExampleClaim & { industry: string; industryId: string }> {
  return ALL_EXAMPLES.flatMap(industry =>
    industry.claims.map(claim => ({
      ...claim,
      industry: industry.industry,
      industryId: industry.industryId,
    }))
  )
}
