/**
 * Idea Archetypes Library (Holo-style content angles)
 * 
 * Codified content angle templates for generating high-converting
 * marketing content across ads, social posts, emails, and landing pages.
 */

export interface IdeaArchetype {
  id: string
  name: string
  description: string
  prompt: string
  bestFor: ('ad' | 'social' | 'email' | 'landing_page' | 'video')[]
  emotionalTrigger: string
  exampleHook: string
}

/**
 * Core content archetypes based on proven marketing frameworks
 */
export const IDEA_ARCHETYPES: IdeaArchetype[] = [
  {
    id: 'mythbuster',
    name: 'Mythbuster',
    description: 'Debunk a common misconception in your industry',
    prompt: `Create content that challenges a widely-held belief or misconception.
Structure: 
1. State the myth ("Most people think...")
2. Reveal the truth with evidence
3. Position your solution as the right approach
Use phrases like "Here's what they don't tell you..." or "The truth about..."`,
    bestFor: ['ad', 'social', 'video'],
    emotionalTrigger: 'Curiosity + Insider knowledge',
    exampleHook: "Stop believing this lie about [topic]...",
  },
  {
    id: 'us-vs-them',
    name: 'Us vs Them',
    description: 'Compare your approach to competitors or the old way',
    prompt: `Create content that positions your approach against the competition or status quo.
Structure:
1. Show the "old way" or competitor approach (pain points)
2. Contrast with your "new way" (benefits)
3. Clear differentiation without being negative
Use comparison tables, before/after, or side-by-side visuals.`,
    bestFor: ['ad', 'landing_page', 'social'],
    emotionalTrigger: 'FOMO + Superiority',
    exampleHook: "Why we do [X] differently than everyone else",
  },
  {
    id: 'testimonial',
    name: 'Testimonial',
    description: 'Customer success story with specific results',
    prompt: `Create content featuring a customer's transformation story.
Structure:
1. Before state (specific problem/pain)
2. Discovery of your solution
3. After state (specific results with numbers)
4. Customer quote or endorsement
Include specific metrics, timeframes, and real outcomes.`,
    bestFor: ['ad', 'social', 'landing_page', 'video'],
    emotionalTrigger: 'Social proof + Trust',
    exampleHook: "How [Customer] achieved [Result] in [Time]",
  },
  {
    id: 'problem-solution',
    name: 'Problem-Solution',
    description: 'Present a pain point and your resolution',
    prompt: `Create content that agitates a problem then presents your solution.
Structure:
1. Identify the pain point (make it relatable)
2. Amplify the consequences of not solving it
3. Introduce your solution as the answer
4. Show the positive outcome
Use emotional language for the problem, logical proof for the solution.`,
    bestFor: ['ad', 'email', 'landing_page', 'video'],
    emotionalTrigger: 'Pain avoidance + Relief',
    exampleHook: "Tired of [Problem]? Here's the fix.",
  },
  {
    id: 'before-after',
    name: 'Before & After',
    description: 'Show transformation with visual or narrative contrast',
    prompt: `Create content showing a clear transformation.
Structure:
1. "Before" state - specific, relatable struggles
2. The turning point / your solution
3. "After" state - specific, desirable outcomes
4. Bridge: How to get from before to after
Works best with visual contrast or specific timeline.`,
    bestFor: ['ad', 'social', 'video', 'landing_page'],
    emotionalTrigger: 'Aspiration + Possibility',
    exampleHook: "From [Bad State] to [Good State] in [Time]",
  },
  {
    id: 'top-x-reasons',
    name: 'Top X Reasons',
    description: 'Listicle format with numbered benefits or tips',
    prompt: `Create content in a numbered list format.
Structure:
1. Compelling headline with specific number (odd numbers often perform better)
2. Each point should stand alone but build toward a conclusion
3. Mix of expected and surprising reasons
4. Final point should be the strongest
Use numbers 3, 5, 7, or 10 for best engagement.`,
    bestFor: ['social', 'email', 'video'],
    emotionalTrigger: 'Curiosity + Completeness',
    exampleHook: "7 reasons why [Target] are switching to [Solution]",
  },
  {
    id: 'negative-hook',
    name: 'Negative Hook',
    description: 'Contrarian or warning-style opening',
    prompt: `Create content with a contrarian or warning-based hook.
Structure:
1. Start with "Don't", "Stop", "Warning", or a contrarian statement
2. Explain why the common approach is wrong
3. Reveal the better alternative
4. Provide proof or reasoning
Negative framing grabs attention, positive solution provides value.`,
    bestFor: ['ad', 'social', 'video'],
    emotionalTrigger: 'Fear + Urgency',
    exampleHook: "Stop doing [Common Practice] immediately",
  },
  {
    id: 'statistics',
    name: 'Statistics',
    description: 'Data-driven proof point with specific numbers',
    prompt: `Create content anchored around compelling statistics.
Structure:
1. Lead with a surprising or impressive statistic
2. Provide context for why it matters
3. Connect it to your audience's situation
4. Show how your solution relates to this data
Use specific numbers (not rounded), cite sources when possible.`,
    bestFor: ['ad', 'social', 'landing_page', 'email'],
    emotionalTrigger: 'Authority + Credibility',
    exampleHook: "[X]% of [Target] are making this mistake",
  },
  {
    id: 'faq',
    name: 'FAQ',
    description: 'Address common questions and objections',
    prompt: `Create content that proactively answers common questions.
Structure:
1. Identify the most common question or objection
2. Provide a clear, helpful answer
3. Add unexpected value or insight
4. Guide toward next step
Address objections as opportunities to educate.`,
    bestFor: ['social', 'email', 'landing_page'],
    emotionalTrigger: 'Trust + Clarity',
    exampleHook: "The #1 question we get about [Topic]",
  },
  {
    id: 'best-sellers',
    name: 'Best-sellers',
    description: 'Highlight most popular items or features',
    prompt: `Create content showcasing your most popular offerings.
Structure:
1. Introduce the "most popular" or "best-selling" items
2. Explain why they're favorites (social proof)
3. Highlight key benefits of each
4. Create urgency or scarcity if applicable
Leverage herd mentality and proven success.`,
    bestFor: ['ad', 'email', 'landing_page'],
    emotionalTrigger: 'Social proof + FOMO',
    exampleHook: "Our customers' top 3 favorite [products/features]",
  },
  {
    id: 'features',
    name: 'Features',
    description: 'Highlight specific product capabilities',
    prompt: `Create content focusing on a specific feature or capability.
Structure:
1. Name the feature clearly
2. Explain what it does (simple terms)
3. Show the benefit (what's in it for them)
4. Demonstrate or visualize it in action
Always connect features to outcomes.`,
    bestFor: ['ad', 'landing_page', 'email'],
    emotionalTrigger: 'Value + Utility',
    exampleHook: "This one feature saves our users [X] hours/week",
  },
  {
    id: 'media',
    name: 'Media',
    description: 'Press mentions, awards, or social proof',
    prompt: `Create content leveraging third-party validation.
Structure:
1. Reference the media mention, award, or recognition
2. Quote the key endorsement
3. Explain what it means for your audience
4. Use as credibility to support your claims
Third-party validation is more trusted than self-promotion.`,
    bestFor: ['ad', 'social', 'landing_page'],
    emotionalTrigger: 'Authority + Trust',
    exampleHook: "As seen in [Publication] / Award-winning [Product]",
  },
  {
    id: 'whats-inside',
    name: "What's Inside",
    description: 'Reveal what customers actually get',
    prompt: `Create content that unpacks what's included in your offering.
Structure:
1. Tease the full package/bundle
2. List out each component with its value
3. Show the total value vs. price (value stack)
4. Create urgency to act
Transparency builds trust and perceived value.`,
    bestFor: ['ad', 'landing_page', 'email'],
    emotionalTrigger: 'Value + Transparency',
    exampleHook: "Everything you get when you [buy/sign up]",
  },
  {
    id: 'notes',
    name: 'Notes',
    description: 'Behind-the-scenes insights and authenticity',
    prompt: `Create content with a personal, behind-the-scenes feel.
Structure:
1. Share something authentic/vulnerable
2. Explain your process or thinking
3. Connect it to your audience's experience
4. Keep it conversational and real
Authenticity creates connection and loyalty.`,
    bestFor: ['social', 'email', 'video'],
    emotionalTrigger: 'Connection + Authenticity',
    exampleHook: "A note from our founder about [Topic]",
  },
]

/**
 * Get archetypes suitable for a specific content type
 */
export function getArchetypesForContentType(
  contentType: 'ad' | 'social' | 'email' | 'landing_page' | 'video'
): IdeaArchetype[] {
  return IDEA_ARCHETYPES.filter((archetype) =>
    archetype.bestFor.includes(contentType)
  )
}

/**
 * Get a random archetype suitable for a content type
 */
export function getRandomArchetype(
  contentType?: 'ad' | 'social' | 'email' | 'landing_page' | 'video'
): IdeaArchetype {
  const archetypes = contentType
    ? getArchetypesForContentType(contentType)
    : IDEA_ARCHETYPES
  return archetypes[Math.floor(Math.random() * archetypes.length)]
}

/**
 * Get archetype by ID
 */
export function getArchetypeById(id: string): IdeaArchetype | undefined {
  return IDEA_ARCHETYPES.find((a) => a.id === id)
}

/**
 * Build a prompt using an archetype and brand context
 */
export function buildArchetypePrompt(
  archetype: IdeaArchetype,
  context: {
    brandName?: string
    product?: string
    audience?: string
    goal?: string
    tone?: string
  }
): string {
  const parts = [
    `Create content using the "${archetype.name}" archetype.`,
    '',
    '## Archetype Guidelines',
    archetype.prompt,
    '',
    '## Emotional Trigger',
    archetype.emotionalTrigger,
    '',
    '## Example Hook Style',
    archetype.exampleHook,
  ]

  if (context.brandName || context.product) {
    parts.push('', '## Brand Context')
    if (context.brandName) parts.push(`Brand: ${context.brandName}`)
    if (context.product) parts.push(`Product/Service: ${context.product}`)
    if (context.audience) parts.push(`Target Audience: ${context.audience}`)
    if (context.goal) parts.push(`Goal: ${context.goal}`)
    if (context.tone) parts.push(`Tone: ${context.tone}`)
  }

  return parts.join('\n')
}

/**
 * Archetype categories for UI filtering
 */
export const ARCHETYPE_CATEGORIES = {
  emotional: ['mythbuster', 'negative-hook', 'problem-solution', 'before-after'],
  social_proof: ['testimonial', 'statistics', 'media', 'best-sellers'],
  educational: ['features', 'faq', 'whats-inside', 'top-x-reasons'],
  authentic: ['notes', 'us-vs-them'],
} as const

/**
 * Get category for an archetype
 */
export function getArchetypeCategory(
  archetypeId: string
): keyof typeof ARCHETYPE_CATEGORIES | null {
  for (const [category, ids] of Object.entries(ARCHETYPE_CATEGORIES)) {
    if (ids.includes(archetypeId as never)) {
      return category as keyof typeof ARCHETYPE_CATEGORIES
    }
  }
  return null
}
