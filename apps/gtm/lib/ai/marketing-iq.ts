/**
 * Marketing IQ Library (Phase 1.7)
 * 
 * Codified marketing best practices and frameworks.
 * Domain expertise encoded in prompts.
 */

export interface CopywritingFramework {
  name: string
  fullName: string
  steps: string[]
  description: string
  bestFor: string[]
  example: string
}

export interface ConversionPrinciple {
  name: string
  description: string
  tactics: string[]
  examples: string[]
}

export interface IndustryCompliance {
  industry: string
  forbiddenClaims: string[]
  requiredDisclaimers: string[]
  bestPractices: string[]
  regulatoryBodies: string[]
}

export const MARKETING_IQ = {
  /**
   * Classic copywriting frameworks
   */
  copywriting_frameworks: {
    AIDA: {
      name: 'AIDA',
      fullName: 'Attention-Interest-Desire-Action',
      steps: [
        'ATTENTION: Grab attention with a bold hook',
        'INTEREST: Build interest with relevant information',
        'DESIRE: Create desire by showing transformation/benefits',
        'ACTION: Prompt immediate action with clear CTA',
      ],
      description: 'The classic advertising formula that guides prospects through the buying journey',
      bestFor: ['ads', 'landing_pages', 'sales_emails'],
      example: 'Attention: "Tired of wasting hours on manual data entry?" → Interest: "Our AI automates 90% of the work" → Desire: "Imagine getting 3 hours back every day" → Action: "Start your free trial today"',
    } as CopywritingFramework,

    PAS: {
      name: 'PAS',
      fullName: 'Problem-Agitation-Solution',
      steps: [
        'PROBLEM: Identify the problem clearly',
        'AGITATE: Make the pain feel urgent and real',
        'SOLUTION: Present your solution as the relief they need',
      ],
      description: 'Works by amplifying pain before offering relief',
      bestFor: ['email', 'ads', 'sales_pages', 'cold_outreach'],
      example: 'Problem: "Manual reporting takes 10+ hours every week" → Agitate: "That\'s 500+ hours a year—time you\'ll never get back" → Solution: "Automate it all in 5 minutes with our dashboard builder"',
    } as CopywritingFramework,

    BAB: {
      name: 'BAB',
      fullName: 'Before-After-Bridge',
      steps: [
        'BEFORE: Paint a picture of the current painful state',
        'AFTER: Show the ideal future state',
        'BRIDGE: Explain how you get them there',
      ],
      description: 'Simple transformation storytelling that creates emotional contrast',
      bestFor: ['case_studies', 'testimonials', 'landing_pages'],
      example: 'Before: "Spending weekends catching up on work" → After: "Leaving the office at 5pm with everything done" → Bridge: "Our productivity system makes it possible"',
    } as CopywritingFramework,

    PASTOR: {
      name: 'PASTOR',
      fullName: 'Problem-Amplify-Story-Transformation-Offer-Response',
      steps: [
        'PROBLEM: Identify the pain point',
        'AMPLIFY: Make it feel urgent',
        'STORY: Share a relatable story',
        'TRANSFORMATION: Show the change possible',
        'OFFER: Present your solution',
        'RESPONSE: Call to action',
      ],
      description: 'Extended framework for longer-form sales content',
      bestFor: ['webinars', 'long_sales_pages', 'video_scripts'],
      example: 'A comprehensive journey from problem identification through social proof to offer',
    } as CopywritingFramework,

    '4Ps': {
      name: '4Ps',
      fullName: 'Picture-Promise-Prove-Push',
      steps: [
        'PICTURE: Paint a vivid picture of the ideal outcome',
        'PROMISE: Make a specific promise',
        'PROVE: Provide evidence',
        'PUSH: Push toward action',
      ],
      description: 'Great for benefit-focused copy with social proof',
      bestFor: ['product_pages', 'feature_announcements', 'ads'],
      example: 'Picture: "Imagine never worrying about cash flow again" → Promise: "We guarantee 95% collection rate" → Prove: "Join 2,000+ businesses who\'ve collected $50M+" → Push: "Get started free"',
    } as CopywritingFramework,

    FAB: {
      name: 'FAB',
      fullName: 'Features-Advantages-Benefits',
      steps: [
        'FEATURES: What it has/does',
        'ADVANTAGES: Why that matters',
        'BENEFITS: How it improves their life',
      ],
      description: 'Translates features into benefits customers care about',
      bestFor: ['product_descriptions', 'feature_pages', 'comparison_content'],
      example: 'Feature: "256-bit encryption" → Advantage: "Bank-level security" → Benefit: "Peace of mind knowing your data is safe"',
    } as CopywritingFramework,
  },

  /**
   * Cialdini's principles + marketing extensions
   */
  conversion_principles: [
    {
      name: 'Social Proof',
      description: 'People follow others\' actions, especially similar others',
      tactics: [
        'Customer testimonials with photos and names',
        'Case studies with specific results',
        'Usage numbers ("Join 50,000+ teams")',
        'Logos of recognizable customers',
        'Real-time activity ("John from NYC just signed up")',
        'Reviews and ratings',
      ],
      examples: [
        '"Trusted by 500+ companies including Stripe, Notion, and Linear"',
        '"4.9/5 rating from 2,000+ reviews"',
        '"See why 50,000 marketers switched to us"',
      ],
    } as ConversionPrinciple,

    {
      name: 'Scarcity',
      description: 'Limited availability increases perceived value',
      tactics: [
        'Limited-time offers with countdown timers',
        'Limited spots/seats available',
        'Limited edition products',
        'Waitlists for new features',
        'Early bird pricing',
      ],
      examples: [
        '"Only 3 spots left at this price"',
        '"Offer ends in 24 hours"',
        '"Join 200 others on the waitlist"',
      ],
    } as ConversionPrinciple,

    {
      name: 'Authority',
      description: 'Expert endorsement and credentials build trust',
      tactics: [
        'Industry certifications and compliance badges',
        'Expert endorsements and quotes',
        'Media mentions and press logos',
        'Years in business',
        'Team credentials',
      ],
      examples: [
        '"SOC 2 Type II certified"',
        '"Recommended by Gartner"',
        '"As seen in TechCrunch, Forbes, and Wired"',
      ],
    } as ConversionPrinciple,

    {
      name: 'Reciprocity',
      description: 'Give value first, and people feel obligated to give back',
      tactics: [
        'Free tools and calculators',
        'Valuable content (guides, templates)',
        'Free trials without credit card',
        'Personalized demos',
        'Free audits or assessments',
      ],
      examples: [
        '"Free ROI calculator—no email required"',
        '"Download our 50-page industry report"',
        '"Get a free website audit"',
      ],
    } as ConversionPrinciple,

    {
      name: 'Commitment & Consistency',
      description: 'Small commitments lead to larger ones',
      tactics: [
        'Micro-conversions (save, like, follow)',
        'Progressive profiling',
        'Free tier that builds habits',
        'Public commitments',
        'Progress tracking',
      ],
      examples: [
        '"Start with our free plan, upgrade when ready"',
        '"Complete your profile to unlock features"',
        '"You\'ve already saved 10 items—create an account to keep them"',
      ],
    } as ConversionPrinciple,

    {
      name: 'Liking',
      description: 'We buy from people and brands we like',
      tactics: [
        'Relatable brand voice',
        'Behind-the-scenes content',
        'Team photos and stories',
        'Shared values and mission',
        'Humor and personality',
      ],
      examples: [
        '"Built by marketers, for marketers"',
        '"We\'re on the same mission as you"',
        '"Hey, we\'re just a small team trying to make [X] suck less"',
      ],
    } as ConversionPrinciple,

    {
      name: 'Unity',
      description: 'Shared identity creates belonging',
      tactics: [
        'Community building',
        'Exclusive member benefits',
        'Insider language',
        'User-generated content',
        'Events and meetups',
      ],
      examples: [
        '"Join the community of 10,000 growth marketers"',
        '"Built for indie hackers, by indie hackers"',
        '"Become part of the movement"',
      ],
    } as ConversionPrinciple,
  ],

  /**
   * Industry-specific compliance knowledge
   */
  industry_compliance: {
    healthcare: {
      industry: 'Healthcare / Health Tech',
      forbiddenClaims: [
        'Claims to cure, treat, or prevent disease (without FDA approval)',
        'Guaranteed health outcomes',
        'Comparison claims without clinical evidence',
        'Testimonials implying typical results',
      ],
      requiredDisclaimers: [
        '"This is not medical advice. Consult your healthcare provider."',
        '"These statements have not been evaluated by the FDA."',
        '"Individual results may vary."',
      ],
      bestPractices: [
        'Focus on features rather than health outcomes',
        'Use hedging language ("may help", "designed to support")',
        'Reference clinical studies when available',
        'Clear separation of marketing vs medical claims',
      ],
      regulatoryBodies: ['FDA', 'FTC', 'HIPAA'],
    } as IndustryCompliance,

    finance: {
      industry: 'Financial Services / FinTech',
      forbiddenClaims: [
        'Guaranteed returns or profits',
        'Risk-free investments',
        'Specific performance predictions',
        'Comparison without substantiation',
      ],
      requiredDisclaimers: [
        '"Past performance is not indicative of future results."',
        '"Investments carry risk of loss."',
        '"Not FDIC insured. May lose value."',
      ],
      bestPractices: [
        'Balance benefit claims with risk disclosures',
        'Use historical data with proper context',
        'Avoid superlatives about performance',
        'Clearly distinguish between products',
      ],
      regulatoryBodies: ['SEC', 'FINRA', 'FTC', 'CFPB'],
    } as IndustryCompliance,

    saas: {
      industry: 'B2B SaaS',
      forbiddenClaims: [
        'Unsubstantiated "#1" claims',
        'ROI guarantees without evidence',
        'Absolute security claims ("unhackable")',
        'False feature comparisons',
      ],
      requiredDisclaimers: [
        '"Results may vary based on implementation."',
        '"Based on customer-reported data."',
        '"Pricing subject to change."',
      ],
      bestPractices: [
        'Use specific numbers from case studies',
        'Qualify claims ("up to", "on average")',
        'Provide clear pricing transparency',
        'Be honest about limitations',
      ],
      regulatoryBodies: ['FTC', 'GDPR (EU)', 'CCPA (California)'],
    } as IndustryCompliance,
  },

  /**
   * Power words and phrases by category
   */
  power_words: {
    urgency: ['Now', 'Today', 'Instant', 'Fast', 'Quick', 'Limited', 'Hurry', 'Last chance', 'Don\'t miss', 'Act now'],
    exclusivity: ['Exclusive', 'Members-only', 'VIP', 'Insider', 'Private', 'Elite', 'Premier', 'Invitation-only'],
    value: ['Free', 'Bonus', 'Save', 'Discount', 'Deal', 'Value', 'Worth', 'Bargain', 'No-cost', 'Complimentary'],
    trust: ['Guaranteed', 'Proven', 'Certified', 'Verified', 'Trusted', 'Authentic', 'Official', 'Secure'],
    curiosity: ['Secret', 'Hidden', 'Discover', 'Reveal', 'Unlock', 'Uncover', 'Little-known', 'Behind-the-scenes'],
    emotion: ['Love', 'Hate', 'Fear', 'Joy', 'Surprise', 'Anger', 'Relief', 'Pride', 'Hope', 'Anxious'],
    results: ['Results', 'Transform', 'Achieve', 'Success', 'Win', 'Boost', 'Increase', 'Improve', 'Maximize'],
  },

  /**
   * Words to avoid in marketing copy
   */
  words_to_avoid: [
    'Revolutionary', // Overused, lacks meaning
    'Synergy', // Corporate jargon
    'Leverage', // Vague
    'Best-in-class', // Unsubstantiated claim
    'World-class', // Unsubstantiated claim
    'Cutting-edge', // Overused
    'Game-changer', // Overused
    'Disruptive', // Overused
    'Innovative', // Show, don\'t tell
    'Solutions', // Vague
    'Utilize', // Just say "use"
    'Optimize', // Often vague
    'Empower', // Overused
    'Robust', // Vague
    'Seamless', // Overused
  ],
}

/**
 * Get the Marketing IQ context for AI prompts
 */
export function getMarketingIQContext(options?: {
  includeFrameworks?: boolean
  includePrinciples?: boolean
  includeCompliance?: string
  includePowerWords?: boolean
}): string {
  const sections: string[] = []

  sections.push('## MARKETING IQ (Best Practices)')

  if (options?.includeFrameworks !== false) {
    sections.push(`
### COPYWRITING FRAMEWORKS
${Object.values(MARKETING_IQ.copywriting_frameworks)
  .map(f => `- **${f.name}** (${f.fullName}): ${f.description}`)
  .join('\n')}`)
  }

  if (options?.includePrinciples !== false) {
    sections.push(`
### CONVERSION PRINCIPLES
${MARKETING_IQ.conversion_principles
  .slice(0, 4)
  .map(p => `- **${p.name}**: ${p.description}`)
  .join('\n')}`)
  }

  if (options?.includeCompliance) {
    const compliance = MARKETING_IQ.industry_compliance[options.includeCompliance as keyof typeof MARKETING_IQ.industry_compliance]
    if (compliance) {
      sections.push(`
### COMPLIANCE (${compliance.industry})
**Avoid:**
${compliance.forbiddenClaims.map(c => `- ${c}`).join('\n')}

**Required Disclaimers:**
${compliance.requiredDisclaimers.map(d => `- ${d}`).join('\n')}`)
    }
  }

  if (options?.includePowerWords) {
    sections.push(`
### POWER WORDS TO USE
- Urgency: ${MARKETING_IQ.power_words.urgency.slice(0, 5).join(', ')}
- Trust: ${MARKETING_IQ.power_words.trust.slice(0, 5).join(', ')}
- Results: ${MARKETING_IQ.power_words.results.slice(0, 5).join(', ')}`)
  }

  sections.push(`
### WORDS TO AVOID
${MARKETING_IQ.words_to_avoid.slice(0, 8).join(', ')}`)

  return sections.join('\n')
}

export type IndustryKey = keyof typeof MARKETING_IQ.industry_compliance
export type FrameworkKey = keyof typeof MARKETING_IQ.copywriting_frameworks
