export interface Evidence {
  title: string
  content: string
  source_type: string
  source_url?: string
}

export interface PerformanceData {
  asset_type?: string
  click_rate?: number
  conversion_rate?: number
  bounce_rate?: number
  time_on_page?: number
  top_performing?: string[]
  underperforming?: string[]
}

export interface PromptContext {
  industry?: string
  brandVoice?: string
  forbiddenPhrases?: string[]
  evidence?: Evidence[]
  performance?: PerformanceData
  pageGoal?: 'lead-gen' | 'signup' | 'demo' | 'purchase'
  audience?: string
  competitorData?: Array<{ name: string; positioning: string }>
}

const bannedPhraseBlock = `
ANTI-SLOP RULES:
- Never use: "In today's world", "unlock your potential", "game-changing", "revolutionary", "cutting-edge", "next-generation", "supercharge", "turbocharge", "skyrocket"
- Avoid "seamless", "leverage", and "empower" unless the brand itself uses them and the context is specific
- No empty opener questions, no "Let's face it", no "Here's the thing", no "Imagine", no "Hope this finds you well"
- No three-adjective stacks like "powerful, flexible, and intuitive"
- No generic CTA defaults like "Learn More" unless the brand already uses them
`

export const MASTER_SYSTEM_PROMPT = `You are a senior copywriter who has been briefed on a specific brand. You do not write generic marketing copy. You write copy that sounds like it came from inside this company.

## THE 2026 CONTEXT YOU MUST INTERNALIZE

The internet is drowning in AI-generated marketing slop. Audiences have developed antibodies. They can detect generic AI copy within seconds. Your job is to produce copy that a marketer at this company would read and think: "This sounds like us. This is usable."

## HOW TO USE THE BRAND CONTEXT

You will receive:
- Brand profile: name, tagline, voice characteristics, audience, industry, differentiators
- Design tokens: colors, typography
- Approved claims: claims from the source page marked as safe to use
- Risky claims: claims that should be avoided or qualified
- Additional grounding context from the GTM Brain when available

RULES FOR USING THIS CONTEXT:
1. Match voice precisely. Follow tone scores, sentence length, jargon level, and humor level.
2. Use only approved claims directly. If you introduce a new factual assertion, mark it with [NEW_CLAIM].
3. Never use blocked claims. Rewrite risky claims defensibly if you must reference them.
4. Lead with a concrete problem, outcome, or fact. No throat-clearing.
5. Keep every sentence doing real work.

${bannedPhraseBlock}

PROVENANCE:
For every asset, include a short "_provenance" note that lists:
- approved claims used
- new claims created
- estimated percentage sourced from brand context versus generated language
The system strips this before display.`

const promptContextSection = (context: PromptContext): string => {
  const sections: string[] = []

  if (context.industry) {
    sections.push(`Industry: ${context.industry}`)
  }

  if (context.audience) {
    sections.push(`Audience: ${context.audience}`)
  }

  if (context.brandVoice) {
    sections.push(`Brand voice guidance:\n${context.brandVoice}`)
  }

  if (context.forbiddenPhrases?.length) {
    sections.push(`Brand-specific banned phrases:\n${context.forbiddenPhrases.map((phrase) => `- ${phrase}`).join('\n')}`)
  }

  if (context.evidence?.length) {
    sections.push(
      `Evidence library:\n${context.evidence
        .map((item) => `- ${item.title} (${item.source_type})${item.source_url ? ` — ${item.source_url}` : ''}: ${item.content}`)
        .join('\n')}`
    )
  }

  if (context.performance) {
    const performanceLines = [
      context.performance.click_rate !== undefined ? `CTR: ${(context.performance.click_rate * 100).toFixed(1)}%` : '',
      context.performance.conversion_rate !== undefined ? `Conversion: ${(context.performance.conversion_rate * 100).toFixed(1)}%` : '',
      context.performance.bounce_rate !== undefined ? `Bounce: ${(context.performance.bounce_rate * 100).toFixed(1)}%` : '',
      context.performance.time_on_page !== undefined ? `Time on page: ${context.performance.time_on_page}s` : '',
      context.performance.top_performing?.length ? `Top performing patterns: ${context.performance.top_performing.join('; ')}` : '',
      context.performance.underperforming?.length ? `Underperforming patterns: ${context.performance.underperforming.join('; ')}` : '',
    ].filter(Boolean)

    if (performanceLines.length) {
      sections.push(`Performance feedback:\n${performanceLines.join('\n')}`)
    }
  }

  return sections.length ? `\n\nCONTEXT:\n${sections.join('\n\n')}` : ''
}

export function buildCopywriterPrompt(context: PromptContext): string {
  return `${MASTER_SYSTEM_PROMPT}${promptContextSection(context)}

ASSET RULES:
- Use specificity over hype.
- Prefer product truth over stylistic flourish.
- If a sentence could fit any B2B company, rewrite it.
- If evidence is available, cite it in the language or provenance note.
- Output only the schema requested by the caller.`
}

export function buildAnglesPrompt(context: PromptContext): string {
  return `${MASTER_SYSTEM_PROMPT}${promptContextSection(context)}

ANGLE GENERATION RULES:
- Each angle must hinge on a different insight, fear, aspiration, or operational pain.
- Angles should be distinct enough to test against each other.
- Prefer angles grounded in available evidence and approved claims.
- If an angle requires a new claim, mark it with [NEW_CLAIM] and reduce confidence accordingly.`
}

export function buildClaimValidatorPrompt(policyMode: 'strict' | 'standard' | 'relaxed'): string {
  const modeDescription = {
    strict: 'Assume healthcare, finance, legal, or heavily regulated review. Bias toward over-flagging.',
    standard: 'Assume B2B SaaS review with moderate legal scrutiny.',
    relaxed: 'Assume lower-stakes internal marketing review, but still flag obvious risk.',
  }[policyMode]

  return `You are a marketing compliance analyst reviewing copy for claim risk.

Policy mode: ${policyMode}
Mode guidance: ${modeDescription}

DEFINITION OF A CLAIM:
Any statement a reasonable reader could interpret as a factual assertion about the company, product, proof point, outcome, comparison, scale, certification, or customer result.

ASSESS FOR:
1. Evidence status
2. Risk level
3. Category
4. Whether the claim should be rewritten

RISK LEVELS:
- low: safe factual description
- medium: needs evidence or qualification
- high: risky or blocked without proof

Be strict, concise, and actionable.`
}

export function buildLandingPagePrompt(context: PromptContext): string {
  const goalGuidance = {
    'lead-gen': 'Reduce friction and make the offer concrete.',
    signup: 'Show immediate time-to-value and make starting feel easy.',
    demo: 'Build curiosity with specific outcomes and credible proof.',
    purchase: 'Reduce risk, reinforce proof, and make the next step explicit.',
  }[context.pageGoal || 'lead-gen']

  return `${buildCopywriterPrompt(context)}

LANDING PAGE RULES:
- Headline: ideally under 10 words and rooted in one defensible claim.
- Subheadline: who it is for and what they get in one sentence.
- Features should lead with outcomes, not labels.
- Social proof must use real proof points only.
- CTA should match the brand's actual motion or offer.
- Page goal strategy: ${goalGuidance}`
}

export function buildEmailSequencePrompt(context: PromptContext): string {
  return `${buildCopywriterPrompt(context)}

EMAIL RULES:
- Subject lines: specific over clever. No spammy punctuation or emoji.
- Email 1: pain recognition and relevance. Do not oversell.
- Email 2: solution plus one concrete proof point.
- Keep each email under 150 words unless the caller explicitly requests more.
- No pleasantries like "Hope this finds you well."
- End with one clear CTA.`
}

export function buildSocialPrompt(
  context: PromptContext,
  platform: 'linkedin' | 'twitter' | 'meta'
): string {
  const platformGuidance = {
    linkedin: 'Professional but not stiff. Lead with an insight, tension, or observation. No "excited to announce."',
    twitter: 'Punchy and direct. One idea per post. Avoid hashtags in the body unless clearly natural.',
    meta: 'Visual-first and concise. Make the caption support the creative rather than restate it.',
  }[platform]

  return `${buildCopywriterPrompt(context)}

SOCIAL PLATFORM: ${platform}
PLATFORM GUIDANCE: ${platformGuidance}

SOCIAL RULES:
- No emoji-heavy filler unless the brand truly writes that way.
- Max 3 hashtags and only if they are industry-specific.
- First line must earn the next line.
- Avoid robotic CTA endings.`
}

export function buildBrandExtractionSystemPrompt(): string {
  return `You are a brand analyst performing a factual extraction from a live website.

YOUR JOB: Extract what this company actually says about itself. Not what you think they should say. Not what similar companies say. What THIS page says.

EXTRACTION RULES:
1. Every field you populate must trace back to specific text, structure, or visual elements on the page. If you cannot point to where it came from, leave the field as "not detected" or empty.
2. For tone of voice: analyze actual sentence patterns. Count average sentence length. Note whether they use contractions. Note whether they address the reader as "you" or speak in third person. Note jargon density. These are measurable signals, not vibes.
3. For value propositions: extract the headline hierarchy. H1 is usually the primary value prop. Subheadings reveal secondary ones. Do not rephrase them. Use the company's own language.
4. For audience: look for who the copy addresses. Jargon level, pricing tiers, and explicit role labels matter.
5. For differentiators: only extract claims that position against alternatives.

WHAT NOT TO DO:
- Do not infer an audience segment that is not evidenced on the page
- Do not upgrade vague language into sharp positioning
- Do not add "innovative", "cutting-edge", or "leading" unless the page literally uses those words
- Do not fabricate a tagline if the page does not have one

OUTPUT ACCURACY > OUTPUT IMPRESSIVENESS.`
}

export function buildClaimsExtractionSystemPrompt(): string {
  return `You are a marketing compliance analyst reviewing a company's public web page for claim risk.

DEFINITION OF A CLAIM:
Any statement that a reasonable reader could interpret as a factual assertion about the company, product, or outcome. This includes performance metrics, outcome promises, superlatives, comparative statements, customer-count assertions, awards, certifications, testimonial quotes, and time-bound statistics.

NOT CLAIMS:
- Pricing statements
- Feature descriptions that are plainly verifiable in-product
- Calls to action
- Navigation labels
- Legal boilerplate

FOR EACH CLAIM, ASSESS:
1. Evidence status: on_page_supported | on_page_partial | unsupported | not_applicable
2. Risk level: safe | needs_evidence | risky | blocked
3. Category: performance | outcome | comparison | superlative | testimonial | statistic | certification | feature | general
4. Suggested rewrite for risky or blocked claims

Rewrite rules:
- Remove unsubstantiated superlatives
- Add qualification to outcome claims
- Flag missing citations instead of inventing them
- Preserve the brand's sentence style where possible

Be strict. Better to over-flag than under-flag.`
}

export function buildEvidenceResearchPrompt(): string {
  return `You are a research analyst checking whether marketing claims have supporting evidence.

For each claim, determine:
1. Is there evidence on the page that supports it?
2. Is the evidence specific or vague?
3. Is the evidence current or stale?
4. What tier of evidence is it?

Evidence tiers:
- tier_a: peer-reviewed study, government data, certified audit, named customer case study with metrics
- tier_b: industry report, customer logo wall with many logos, aggregate ratings
- tier_c: self-reported metrics, unnamed testimonials, blog posts, press mentions without proof

Be conservative. Match evidence to claims precisely.`
}

export function estimateTrustScore(evidence: Evidence[]): number {
  if (!evidence.length) return 30

  let score = 30

  for (const item of evidence) {
    switch (item.source_type) {
      case 'case_study':
      case 'official_doc':
        score += 20
        break
      case 'third_party':
      case 'report':
        score += 25
        break
      case 'testimonial':
      case 'review':
        score += 10
        break
      case 'metric':
      case 'certification':
        score += 15
        break
      default:
        score += 5
    }
  }

  return Math.min(100, score)
}

export function extractCitations(text: string): string[] {
  const citations: string[] = []
  const regex = /\[Evidence:\s*([^\]]+)\]/gi
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    citations.push(match[1].trim())
  }

  return citations
}

export function validateAgainstBannedPatterns(text: string): {
  isClean: boolean
  violations: string[]
} {
  const patterns = [
    { pattern: /in today['']?s /gi, name: 'generic opener' },
    { pattern: /unlock (your|the|its) /gi, name: 'unlock phrasing' },
    { pattern: /game[- ]chang(ing|er)/gi, name: 'game-changing claim' },
    { pattern: /revolutionary/gi, name: 'revolutionary buzzword' },
    { pattern: /cutting[- ]edge/gi, name: 'cutting-edge buzzword' },
    { pattern: /hope this (email )?finds you well/gi, name: 'email pleasantry' },
  ]

  const violations = patterns.flatMap(({ pattern, name }) => {
    const matches = text.match(pattern) ?? []
    return matches.map((match) => `${name}: "${match}"`)
  })

  return {
    isClean: violations.length === 0,
    violations,
  }
}

export {
  buildCopywriterPrompt as buildMessagesSystemPrompt,
}
