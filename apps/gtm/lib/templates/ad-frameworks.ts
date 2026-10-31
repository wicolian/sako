/**
 * Ad Framework Templates (Phase 1.2)
 * 
 * Named marketing frameworks that structure content generation.
 * Inspired by Holo's framework-driven approach.
 */

export interface AdFramework {
  id: string
  name: string
  description: string
  structure: string[]
  best_for: string[]
  example_hooks: string[]
  prompt_injection: string
  icon: string
  category: 'persuasion' | 'storytelling' | 'comparison' | 'social_proof' | 'education'
}

export const AD_FRAMEWORKS: Record<string, AdFramework> = {
  mythbuster: {
    id: 'mythbuster',
    name: 'Mythbuster',
    description: 'Debunk common misconceptions in your industry',
    structure: ['myth_statement', 'truth_reveal', 'proof_point', 'cta'],
    best_for: ['thought_leadership', 'differentiation', 'education'],
    example_hooks: [
      'Think X is true? Think again.',
      'The biggest lie in [industry]',
      'Stop believing this myth about [topic]',
      'Everyone thinks X, but the data shows...',
    ],
    prompt_injection: `Structure this as a myth-busting piece:
1. State the common myth/misconception clearly
2. Reveal the truth with compelling evidence
3. Provide a proof point (stat, case study, expert quote)
4. End with a strong call-to-action`,
    icon: 'Lightbulb',
    category: 'education',
  },

  before_after: {
    id: 'before_after',
    name: 'Before & After',
    description: 'Show transformation from problem state to solution state',
    structure: ['pain_state', 'transformation_moment', 'result_state', 'how_we_help'],
    best_for: ['case_studies', 'product_demos', 'testimonials'],
    example_hooks: [
      'From X to Y in Z days',
      'What changed when they started using...',
      'The transformation was instant',
      'Before: struggling. After: thriving.',
    ],
    prompt_injection: `Structure this as a before/after transformation story:
1. Paint a vivid picture of the "before" state (pain, frustration, struggle)
2. Describe the transformation moment (discovery, implementation)
3. Show the "after" state (results, relief, success)
4. Explain how we make this transformation possible`,
    icon: 'ArrowRight',
    category: 'storytelling',
  },

  us_vs_them: {
    id: 'us_vs_them',
    name: 'Us vs Them (Comparison)',
    description: 'Position against competitors or the old way of doing things',
    structure: ['old_way_problems', 'our_approach', 'key_differences', 'proof'],
    best_for: ['competitive_positioning', 'market_education', 'differentiation'],
    example_hooks: [
      'Still using X? Here\'s why Y is better',
      'The old way vs the new way',
      'Why we built something different',
      'Traditional [X] vs Modern [X]',
    ],
    prompt_injection: `Structure this as a comparison piece:
1. Highlight problems with the old way/competitors (without naming competitors directly)
2. Introduce our different approach
3. List 3-4 key differentiators with specific benefits
4. Provide proof (results, testimonials, data)`,
    icon: 'Scale',
    category: 'comparison',
  },

  social_proof: {
    id: 'social_proof',
    name: 'Testimonials / Social Proof',
    description: 'Let customers speak for you with their success stories',
    structure: ['customer_intro', 'challenge_faced', 'solution_found', 'results_achieved', 'recommendation'],
    best_for: ['trust_building', 'conversion', 'objection_handling'],
    example_hooks: [
      '"I wish I\'d found this sooner"',
      'See why 10,000+ teams chose us',
      'Don\'t take our word for it...',
      'Real results from real customers',
    ],
    prompt_injection: `Structure this as a social proof piece:
1. Briefly introduce the customer (role, company type)
2. Describe the challenge they faced
3. Explain how they found and implemented the solution
4. Share specific, quantified results
5. Include a recommendation/endorsement`,
    icon: 'Users',
    category: 'social_proof',
  },

  best_sellers: {
    id: 'best_sellers',
    name: 'Best-Sellers / Top Picks',
    description: 'Highlight your most popular or successful offerings',
    structure: ['popularity_statement', 'top_pick_intro', 'why_its_popular', 'cta'],
    best_for: ['ecommerce', 'product_marketing', 'conversion'],
    example_hooks: [
      'Our most popular [product/feature]',
      '#1 choice for [audience]',
      'This is what everyone\'s talking about',
      'The [product] that\'s flying off the shelves',
    ],
    prompt_injection: `Structure this as a best-seller highlight:
1. Establish popularity/demand (numbers, social proof)
2. Introduce the top pick with enthusiasm
3. Explain why it's so popular (benefits, unique features)
4. Create urgency and call-to-action`,
    icon: 'Trophy',
    category: 'social_proof',
  },

  top_x_reasons: {
    id: 'top_x_reasons',
    name: 'Top X Reasons',
    description: 'List format that builds compelling case with multiple points',
    structure: ['intro_hook', 'reason_1', 'reason_2', 'reason_3', 'reason_4', 'reason_5', 'conclusion_cta'],
    best_for: ['education', 'seo', 'social_media', 'email'],
    example_hooks: [
      '5 reasons why [audience] are switching to...',
      'Top 3 mistakes when [doing X]',
      '7 signs you need [solution]',
      'The 4 things successful [audience] do differently',
    ],
    prompt_injection: `Structure this as a numbered list of reasons:
1. Start with a compelling intro that promises value
2. Present each reason as a mini-story with benefit
3. Order from good to best (save strongest for last)
4. End with a clear call-to-action that ties reasons together`,
    icon: 'ListOrdered',
    category: 'education',
  },

  problem_solution: {
    id: 'problem_solution',
    name: 'Problem-Solution',
    description: 'Agitate the problem, then present the solution',
    structure: ['problem_intro', 'problem_agitation', 'solution_reveal', 'benefit_stack', 'cta'],
    best_for: ['landing_pages', 'ads', 'email'],
    example_hooks: [
      'Tired of [problem]?',
      'There\'s a better way to [task]',
      'Finally, a solution that actually works',
      'Stop struggling with [problem]',
    ],
    prompt_injection: `Structure this using PAS (Problem-Agitate-Solution):
1. Introduce the problem your audience faces
2. Agitate by describing the consequences of not solving it
3. Reveal the solution with relief
4. Stack benefits to build desire
5. Clear call-to-action`,
    icon: 'Puzzle',
    category: 'persuasion',
  },

  statistics_hook: {
    id: 'statistics_hook',
    name: 'Statistics Hook',
    description: 'Lead with compelling data to establish credibility',
    structure: ['stat_hook', 'context_explanation', 'implication', 'solution_tie_in', 'cta'],
    best_for: ['b2b', 'thought_leadership', 'whitepapers', 'linkedin'],
    example_hooks: [
      '73% of [audience] struggle with...',
      'The $X billion problem no one talks about',
      'Only 1 in 10 companies do this right',
      'New data reveals surprising truth about...',
    ],
    prompt_injection: `Structure this as a data-driven piece:
1. Lead with a compelling, specific statistic
2. Provide context for why this matters
3. Explain the implications for your audience
4. Tie in your solution as the answer
5. Clear call-to-action`,
    icon: 'BarChart',
    category: 'education',
  },

  negative_hook: {
    id: 'negative_hook',
    name: 'Negative Hook / Fear',
    description: 'Use fear of loss or missing out to drive action',
    structure: ['fear_intro', 'consequence_paint', 'escape_route', 'solution_present', 'urgency_cta'],
    best_for: ['urgency', 'insurance', 'security', 'compliance'],
    example_hooks: [
      'Are you making this costly mistake?',
      'The hidden risk in your [area]',
      'Don\'t let this happen to you',
      'Warning: [problem] could be costing you...',
    ],
    prompt_injection: `Structure this as a fear-based piece (use responsibly):
1. Introduce a fear or risk your audience faces
2. Paint the consequences vividly
3. Offer an escape route / hope
4. Present your solution as the safe choice
5. Create urgency to act now`,
    icon: 'AlertTriangle',
    category: 'persuasion',
  },

  faq: {
    id: 'faq',
    name: 'FAQ / Objection Handler',
    description: 'Address common questions and objections directly',
    structure: ['question_1', 'answer_1', 'question_2', 'answer_2', 'question_3', 'answer_3', 'final_cta'],
    best_for: ['landing_pages', 'bottom_funnel', 'sales_enablement'],
    example_hooks: [
      'Your questions, answered',
      '"But what about...?" We\'ve got you.',
      'Everything you wanted to know',
      'The honest answers you deserve',
    ],
    prompt_injection: `Structure this as FAQ/objection handling:
1. List the most common questions/objections
2. Answer each honestly and thoroughly
3. Turn objections into benefits where possible
4. End with confidence-building call-to-action`,
    icon: 'HelpCircle',
    category: 'education',
  },

  whats_inside: {
    id: 'whats_inside',
    name: 'What\'s Inside / Unboxing',
    description: 'Reveal what\'s included to build anticipation',
    structure: ['intro_tease', 'component_1', 'component_2', 'component_3', 'total_value', 'cta'],
    best_for: ['product_launch', 'bundles', 'courses', 'memberships'],
    example_hooks: [
      'Here\'s everything you get...',
      'What\'s inside the [product]?',
      'A sneak peek at what\'s included',
      'Let me show you what you\'ll receive',
    ],
    prompt_injection: `Structure this as a "what's inside" reveal:
1. Tease the value they're about to discover
2. List each component with its individual benefit
3. Build anticipation with each reveal
4. Stack the total value
5. Make the offer irresistible with CTA`,
    icon: 'Package',
    category: 'persuasion',
  },

  story_arc: {
    id: 'story_arc',
    name: 'Story Arc',
    description: 'Tell a compelling narrative with a beginning, middle, and end',
    structure: ['setup', 'conflict', 'turning_point', 'resolution', 'moral_cta'],
    best_for: ['brand_storytelling', 'founder_stories', 'case_studies'],
    example_hooks: [
      'It all started when...',
      'Here\'s the story behind [product]',
      'This is why we built [product]',
      'From [origin] to [current state]',
    ],
    prompt_injection: `Structure this as a compelling story:
1. Set the scene (who, what, when, where)
2. Introduce the conflict or challenge
3. Describe the turning point or discovery
4. Show the resolution and results
5. End with the moral and call-to-action`,
    icon: 'BookOpen',
    category: 'storytelling',
  },

  curiosity_gap: {
    id: 'curiosity_gap',
    name: 'Curiosity Gap',
    description: 'Create intrigue that compels the audience to learn more',
    structure: ['teaser', 'partial_reveal', 'intrigue_build', 'full_reveal_promise', 'cta'],
    best_for: ['email_subject_lines', 'social_ads', 'content_promotion'],
    example_hooks: [
      'The one thing successful [audience] never do',
      'What they don\'t tell you about [topic]',
      'The secret behind [result]',
      'This changed everything for us',
    ],
    prompt_injection: `Structure this to create a curiosity gap:
1. Tease with an intriguing statement
2. Partially reveal information (enough to intrigue, not satisfy)
3. Build intrigue with hints and implications
4. Promise the full reveal
5. CTA to get the answer`,
    icon: 'Eye',
    category: 'persuasion',
  },

  aida: {
    id: 'aida',
    name: 'AIDA Classic',
    description: 'Attention → Interest → Desire → Action',
    structure: ['attention_hook', 'interest_build', 'desire_create', 'action_prompt'],
    best_for: ['ads', 'landing_pages', 'sales_copy'],
    example_hooks: [
      '[Attention-grabbing statement]',
      'Imagine if you could...',
      'What would it mean to...',
      'Ready to [transformation]?',
    ],
    prompt_injection: `Structure this using the AIDA framework:
1. ATTENTION: Grab attention with a bold hook
2. INTEREST: Build interest with relevant information
3. DESIRE: Create desire by showing transformation/benefits
4. ACTION: Prompt immediate action with clear CTA`,
    icon: 'Target',
    category: 'persuasion',
  },

  pas: {
    id: 'pas',
    name: 'PAS Framework',
    description: 'Problem → Agitate → Solution',
    structure: ['problem_identify', 'agitate_pain', 'solution_present'],
    best_for: ['email', 'ads', 'sales_pages'],
    example_hooks: [
      'Struggling with [problem]?',
      'It only gets worse...',
      'Here\'s the fix.',
    ],
    prompt_injection: `Structure this using the PAS framework:
1. PROBLEM: Identify the problem clearly
2. AGITATE: Make the pain feel urgent and real
3. SOLUTION: Present your solution as the relief they need`,
    icon: 'Flame',
    category: 'persuasion',
  },
}

export const FRAMEWORK_CATEGORIES = {
  persuasion: {
    name: 'Persuasion',
    description: 'Frameworks designed to convince and convert',
    frameworks: ['aida', 'pas', 'problem_solution', 'negative_hook', 'whats_inside', 'curiosity_gap'],
  },
  storytelling: {
    name: 'Storytelling',
    description: 'Narrative-driven frameworks for engagement',
    frameworks: ['before_after', 'story_arc'],
  },
  comparison: {
    name: 'Comparison',
    description: 'Position against alternatives',
    frameworks: ['us_vs_them'],
  },
  social_proof: {
    name: 'Social Proof',
    description: 'Leverage trust and popularity',
    frameworks: ['social_proof', 'best_sellers'],
  },
  education: {
    name: 'Education',
    description: 'Inform and establish authority',
    frameworks: ['mythbuster', 'top_x_reasons', 'statistics_hook', 'faq'],
  },
}

/**
 * Get framework by ID
 */
export function getFramework(id: string): AdFramework | undefined {
  return AD_FRAMEWORKS[id]
}

/**
 * Get all frameworks for a category
 */
export function getFrameworksByCategory(category: keyof typeof FRAMEWORK_CATEGORIES): AdFramework[] {
  const categoryInfo = FRAMEWORK_CATEGORIES[category]
  return categoryInfo.frameworks.map((id) => AD_FRAMEWORKS[id]).filter(Boolean)
}

/**
 * Get frameworks best suited for a use case
 */
export function getFrameworksForUseCase(useCase: string): AdFramework[] {
  return Object.values(AD_FRAMEWORKS).filter((framework) =>
    framework.best_for.some((u) => u.toLowerCase().includes(useCase.toLowerCase()))
  )
}

/**
 * Get a random example hook for a framework
 */
export function getRandomHook(frameworkId: string): string | undefined {
  const framework = AD_FRAMEWORKS[frameworkId]
  if (!framework) return undefined
  return framework.example_hooks[Math.floor(Math.random() * framework.example_hooks.length)]
}

/**
 * Get all framework IDs
 */
export function getAllFrameworkIds(): string[] {
  return Object.keys(AD_FRAMEWORKS)
}

export type FrameworkId = keyof typeof AD_FRAMEWORKS
