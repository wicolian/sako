/**
 * AI SDK Integration (Feb 2026)
 *
 * Uses Vercel AI SDK v6 with OpenRouter as the sole AI provider.
 *
 * Model Routing Strategy (2026 Allowlist):
 * - Quick checks → GPT-5.3 Chat (fast, cheap)
 * - Balanced generation → GPT-5.4
 * - Creative generation → Claude Sonnet 4.6
 * - Structured data → GPT-5.4
 * - Complex reasoning → Claude Opus 4.6
 *
 * IMPORTANT: All model strings are resolved through OpenRouter.
 * The wrapper functions in langsmith-ai.ts handle model resolution
 * and apply global system prompts from workspace/env settings.
 *
 * @see lib/ai/openrouter.ts for provider configuration
 * @see lib/ai/context.ts for workspace-level settings
 */

import { generateText, streamText, generateObject, embed, embedMany } from './langsmith-ai';
import { z, ZodSchema } from 'zod';
import {
  buildAnglesPrompt,
  buildClaimValidatorPrompt,
  buildCopywriterPrompt,
  buildEmailSequencePrompt,
  buildLandingPagePrompt,
  type PromptContext,
} from './prompts-v2';
import { logAICall, calculateCost } from './tracing';

// Re-export MODEL_IDS from openrouter.ts for consistency
export { MODEL_IDS, type ModelTier } from './openrouter';

// ============================================================================
// Model Configuration using AI SDK v6 with latest 2026 models
// Per latest-models-only.mdc - Hard allowlist
// ============================================================================

/**
 * Model IDs for OpenRouter (Mar 2026 Allowlist)
 *
 * These string IDs are passed to generateText/streamText/generateObject,
 * which resolve them through OpenRouter provider in langsmith-ai.ts.
 *
 * IMPORTANT: Keep these as strings (not provider objects) to maintain
 * backward compatibility with DB fields that store model names.
 *
 * @see https://openrouter.ai/models
 */
export const MODELS = {
  // Fast - quick validations, claim checks, short completions
  FAST: 'openai/gpt-5.3-chat',

  // Balanced - HTML generation, general tasks
  BALANCED: 'openai/gpt-5.4',

  // Creative - marketing copy, angles, headlines (1M context)
  CREATIVE: 'anthropic/claude-sonnet-4.6',

  // Structured - JSON/schema outputs, tool calls
  STRUCTURED: 'openai/gpt-5.4',

  // Reasoning - complex multi-step planning, deep analysis (1M+ context)
  REASONING: 'openai/gpt-5.4-pro',

  // Embeddings
  EMBEDDING: 'openai/text-embedding-3-large',
  EMBEDDING_SMALL: 'openai/text-embedding-3-small',
} as const;


// ============================================================================
// Schemas
// ============================================================================

// Schema for generated landing page content
const landingPageSchema = z.object({
  headline: z.string().describe('Main headline for the landing page - punchy, benefit-focused'),
  subheadline: z.string().describe('Supporting subheadline that expands on the value prop'),
  benefits: z.array(z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string().optional().describe('Lucide icon name suggestion'),
  })).describe('List of 3-4 key benefits'),
  cta: z.object({
    text: z.string(),
    action: z.string().optional(),
  }).describe('Call to action button'),
  socialProof: z.string().optional().describe('Social proof statement like "Trusted by 500+ companies"'),
  objectionHandler: z.string().optional().describe('Address common objection or FAQ'),
});

// Schema for generated marketing angles
const anglesSchema = z.object({
  angles: z.array(z.object({
    name: z.string().describe('Short name for this angle, e.g. "Speed Angle"'),
    headline: z.string(),
    subheadline: z.string(),
    benefits: z.array(z.string()),
    emotionalHook: z.string().describe('The core emotion this angle targets'),
    targetPainPoint: z.string().describe('The specific pain point addressed'),
    audienceSegment: z.string().optional().describe('Who this angle resonates with most'),
  })),
});

// Schema for claim rewrites
const rewriteSchema = z.object({
  rewrites: z.array(z.object({
    original: z.string(),
    rewritten: z.string(),
    reasoning: z.string().describe('Why this rewrite is more compliant'),
    riskReduction: z.number().min(0).max(100).describe('Estimated risk score reduction'),
    preservedIntent: z.boolean().describe('Whether the marketing intent is preserved'),
  })),
});

// Schema for quick claim validation
const quickValidationSchema = z.object({
  riskLevel: z.enum(['low', 'medium', 'high']),
  issues: z.array(z.string()),
  suggestion: z.string().optional(),
  category: z.string().optional().describe('Detected claim category: performance, security, health, etc.'),
  requiresEvidence: z.boolean().describe('Whether this claim needs supporting evidence'),
});

export type LandingPageContent = z.infer<typeof landingPageSchema>;
export type MarketingAngles = z.infer<typeof anglesSchema>;
export type ClaimRewrites = z.infer<typeof rewriteSchema>;
export type QuickValidation = z.infer<typeof quickValidationSchema>;

export class StructuredGenerationRoutingError extends Error {
  constructor(message = 'Structured generation is unavailable because no compatible AI provider endpoint accepted the requested schema output. Check OpenRouter routing/provider settings and try again.') {
    super(message)
    this.name = 'StructuredGenerationRoutingError'
  }
}

// ============================================================================
// Generation Functions
// ============================================================================

/**
 * Generate structured landing page content
 * Uses CREATIVE model (Claude Sonnet 4.5)
 */
export async function generateLandingPageContent(
  prompt: string,
  context?: string
): Promise<LandingPageContent> {
  const systemPrompt = buildLandingPagePrompt({
    brandVoice: context,
  });

  const result = await generateObject({
    model: MODELS.CREATIVE,
    schema: landingPageSchema,
    system: systemPrompt,
    prompt,
    temperature: 0.7,
  });

  return result.object as LandingPageContent;
}

/**
 * Generate marketing angles for a campaign
 * Uses CREATIVE model (Claude Sonnet 4.5) for maximum variety
 */
export async function generateMarketingAngles(
  campaign: {
    name: string;
    audience: string;
    goal: string;
    offer?: string;
    industry?: string;
  },
  topPerformingClaims?: string[],
  count = 3
): Promise<MarketingAngles> {
  const claimsContext = topPerformingClaims?.length
    ? `\n\nHigh-performing claims from past campaigns to draw inspiration from:\n${topPerformingClaims.map((c, i) => `${i + 1}. "${c}"`).join('\n')}`
    : '';

  const result = await generateObject({
    model: MODELS.CREATIVE,
    schema: anglesSchema,
    system: buildAnglesPrompt({
      industry: campaign.industry,
      audience: campaign.audience,
    }),
    prompt: `Campaign: ${campaign.name}
Target Audience: ${campaign.audience}
Goal: ${campaign.goal}
${campaign.offer ? `Offer: ${campaign.offer}` : ''}
${campaign.industry ? `Industry: ${campaign.industry}` : ''}
${claimsContext}

Generate ${count} distinctive marketing angles that would resonate with different segments of this audience.

Return angles that avoid generic launch language and feel grounded in the company's actual operating reality.`,
    temperature: 0.85,
  });

  return result.object as MarketingAngles;
}

/**
 * Generate compliant rewrites for flagged claims
 * Uses STRUCTURED model (GPT-5.2) for precise output
 */
export async function generateCompliantRewrites(
  claims: Array<{
    text: string;
    reasonCode: string;
    category?: string;
  }>,
  policyContext?: {
    forbiddenTerms?: string[];
    mode?: 'strict' | 'standard' | 'relaxed';
    industry?: string;
  }
): Promise<ClaimRewrites> {
  const policyStr = policyContext
    ? `Policy: ${policyContext.mode || 'standard'} mode${policyContext.industry ? ` for ${policyContext.industry} industry` : ''}
${policyContext.forbiddenTerms?.length ? `Avoid these terms: ${policyContext.forbiddenTerms.join(', ')}` : ''}`
    : '';

  const result = await generateObject({
    model: MODELS.STRUCTURED,
    schema: rewriteSchema,
    system: `${buildClaimValidatorPrompt(policyContext?.mode || 'standard')}

Rewrite risky claims so they are defensible without draining them of specificity.
- Replace unsubstantiated superlatives with grounded descriptors
- Qualify outcome claims when proof is missing
- Preserve the original sentence rhythm where possible
- Never invent evidence

${policyStr}`,
    prompt: `Rewrite these claims to be compliant while preserving marketing impact:

${claims.map((c, i) => `${i + 1}. "${c.text}"
   Issue: ${c.reasonCode}${c.category ? ` | Category: ${c.category}` : ''}`).join('\n\n')}`,
    temperature: 0.5,
  });

  return result.object as ClaimRewrites;
}

/**
 * Stream landing page HTML generation
 * Uses BALANCED model (GPT-5.2) for reliable HTML output
 */
export async function streamLandingPageHTML(
  content: LandingPageContent,
  brandColors?: { primary: string; secondary: string },
  onChunk?: (chunk: string) => void
): Promise<string> {
  const colorVars = brandColors
    ? `--primary: ${brandColors.primary}; --secondary: ${brandColors.secondary};`
    : '--primary: #9ae83e; --secondary: #1a1a1a;';

  const result = streamText({
    model: MODELS.BALANCED,
    system: `You are an expert frontend developer creating modern, responsive landing pages.

Requirements:
- Use semantic HTML5
- Include inline CSS with CSS custom properties
- Make it fully responsive (mobile-first)
- Add subtle animations for polish
- Use the provided color variables: ${colorVars}
- Output clean, production-ready HTML only - no markdown, no explanations`,
    prompt: `Generate a complete HTML landing page with this content:

Headline: ${content.headline}
Subheadline: ${content.subheadline}
Benefits:
${content.benefits.map(b => `- ${b.title}: ${b.description}`).join('\n')}
CTA: ${content.cta.text}
${content.socialProof ? `Social Proof: ${content.socialProof}` : ''}
${content.objectionHandler ? `Objection Handler: ${content.objectionHandler}` : ''}

Return only the HTML code.`,
  });

  if (onChunk) {
    for await (const chunk of result.textStream) {
      onChunk(chunk);
    }
  }

  return await result.text;
}

/**
 * Quick text generation for simple prompts
 * Uses FAST model (GPT-5.2-Chat) for speed and cost efficiency
 */
export async function quickGenerate(
  prompt: string,
  options?: {
    system?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  const { text } = await generateText({
    model: MODELS.FAST,
    system: options?.system,
    prompt,
  });

  return text;
}

/**
 * Quick claim validation for real-time linting
 * Uses FAST model (GPT-5.2-Chat) for sub-second response
 */
export async function quickClaimCheck(
  claimText: string
): Promise<QuickValidation> {
  const { object } = await generateObject({
    model: MODELS.FAST,
    schema: quickValidationSchema,
    system: buildClaimValidatorPrompt('standard'),
    prompt: `Assess this marketing claim: "${claimText}"`,
    temperature: 0.3,
  });

  return object as QuickValidation;
}

/**
 * Generate email sequence content
 * Uses CREATIVE model (Claude Sonnet 4.5) for engaging copy
 */
export async function generateEmailSequence(
  campaign: {
    name: string;
    audience: string;
    goal: string;
    offer?: string;
  },
  sequenceLength = 3
): Promise<Array<{
  subject: string;
  preheader: string;
  body: string;
  cta: string;
  sendDelay: string;
}>> {
  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: z.object({
      emails: z.array(z.object({
        subject: z.string().describe('Email subject line - compelling, not clickbait'),
        preheader: z.string().describe('Preview text that complements subject'),
        body: z.string().describe('Email body in markdown format'),
        cta: z.string().describe('Call to action text'),
        sendDelay: z.string().describe('When to send relative to previous, e.g. "immediately", "2 days later"'),
      })),
    }),
    system: buildEmailSequencePrompt({
      audience: campaign.audience,
    }),
    prompt: `Create a ${sequenceLength}-email nurture sequence for:

Campaign: ${campaign.name}
Audience: ${campaign.audience}
Goal: ${campaign.goal}
${campaign.offer ? `Offer: ${campaign.offer}` : ''}

Requirements:
- Keep each email under 150 words
- No "Hope this finds you well"
- Email 1 should identify the pain
- Later emails should add proof before a CTA`,
    temperature: 0.75,
  });

  const typed = object as {
    emails: Array<{
      subject: string;
      preheader: string;
      body: string;
      cta: string;
      sendDelay: string;
    }>;
  };

  return typed.emails;
}

/**
 * Batch validate multiple claims efficiently
 * Uses FAST model (GPT-5.2-Chat) with batch processing
 */
export async function batchValidateClaims(
  claims: string[]
): Promise<Array<QuickValidation & { text: string }>> {
  const { object } = await generateObject({
    model: MODELS.FAST,
    schema: z.object({
      validations: z.array(z.object({
        text: z.string(),
        riskLevel: z.enum(['low', 'medium', 'high']),
        issues: z.array(z.string()),
        suggestion: z.string().optional(),
        category: z.string().optional(),
        requiresEvidence: z.boolean(),
      })),
    }),
    system: buildClaimValidatorPrompt('standard'),
    prompt: `Assess these marketing claims:

${claims.map((c, i) => `${i + 1}. "${c}"`).join('\n')}`,
    temperature: 0.2,
  });

  return (object as { validations: Array<QuickValidation & { text: string }> }).validations;
}

/**
 * Generate structured output with any schema
 * Generic wrapper for agents to use
 */
export async function generateStructuredOutput<T>(options: {
  prompt: string;
  schema: ZodSchema<T>;
  system?: string;
  temperature?: number;
}): Promise<T> {
  try {
    const { object } = await generateObject({
      model: MODELS.STRUCTURED,
      schema: options.schema,
      system: options.system,
      prompt: options.prompt,
      temperature: options.temperature ?? 0.5,
    });

    return object as T;
  } catch (error) {
    if (isStructuredRoutingError(error)) {
      throw new StructuredGenerationRoutingError();
    }
    throw error;
  }
}

function isStructuredRoutingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('No endpoints found that can handle the requested parameters') ||
    error.message.includes('provider routing')
  );
}

/**
 * Stream text content
 * For real-time streaming responses
 */
export async function streamTextContent(options: {
  prompt: string;
  system?: string;
  onChunk?: (chunk: string) => void;
}): Promise<string> {
  const result = streamText({
    model: MODELS.BALANCED,
    system: options.system,
    prompt: options.prompt,
  });

  if (options.onChunk) {
    for await (const chunk of result.textStream) {
      options.onChunk(chunk);
    }
  }

  return await result.text;
}

// ============================================================================
// Message Generation Functions (for generate-messages route)
// ============================================================================

export interface Evidence {
  title: string;
  content: string;
  source_type: string;
}

export interface PerformanceData {
  topMessages?: Array<{ text: string; ctr: number }>;
  topAngles?: Array<{ name: string; conversionRate: number }>;
  insights?: string[];
}

const messagesSchema = z.object({
  headline: z.string().describe('Main headline - compelling and benefit-focused'),
  supporting: z.array(z.string()).describe('3-4 supporting points/bullet points'),
  ctas: z.array(z.string()).describe('2-3 call-to-action variations'),
  disclaimers: z.array(z.string()).describe('Required disclaimers if any'),
});

export type GeneratedMessages = z.infer<typeof messagesSchema>;

/**
 * Generate marketing messages for a campaign
 * Uses CREATIVE model (Claude Sonnet 4.5) for engaging copy
 */
export async function generateMessages(
  audience: string,
  goal: string,
  offer: string,
  cta: string,
  options?: {
    forbiddenPhrases?: string[];
    brandVoice?: string;
    industry?: string;
    evidence?: Evidence[];
    performance?: PerformanceData | null;
  }
): Promise<GeneratedMessages> {
  const evidenceContext = options?.evidence?.length
    ? `\n\nAvailable evidence to cite:\n${options.evidence.map(e => `- ${e.title}: ${e.content}`).join('\n')}`
    : '';

  const performanceContext = options?.performance?.topMessages?.length
    ? `\n\nTop performing messages to learn from:\n${options.performance.topMessages.map(m => `- "${m.text}" (${(m.ctr * 100).toFixed(1)}% CTR)`).join('\n')}`
    : '';

  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: messagesSchema,
    system: buildCopywriterPrompt({
      forbiddenPhrases: options?.forbiddenPhrases,
      brandVoice: options?.brandVoice,
      industry: options?.industry,
      evidence: options?.evidence,
      performance: options?.performance
        ? {
            top_performing: options.performance.topMessages?.map((message) => `${message.text} (${(message.ctr * 100).toFixed(1)}% CTR)`),
            underperforming: options.performance.insights,
          }
        : undefined,
      audience,
    }),
    prompt: `Generate marketing messages for:
Audience: ${audience}
Goal: ${goal}
Offer: ${offer}
CTA: ${cta}
${evidenceContext}
${performanceContext}

Requirements:
- Headline should feel native to the brand, not generic SaaS filler
- Supporting points must be specific and defensible
- If you introduce a new factual claim, mark it with [NEW_CLAIM]
- Disclaimers should only be included when needed`,
    temperature: 0.75,
  });

  return object as GeneratedMessages;
}

// ============================================================================
// Angles Generation (for generate-angles route)
// ============================================================================

const fullAnglesSchema = z.object({
  angles: z.array(z.object({
    name: z.string().describe('Short angle name'),
    description: z.string().describe('What this angle is about'),
    rationale: z.string().describe('Why this angle works for this audience'),
    trustScore: z.number().min(0).max(100).describe('Confidence score based on evidence'),
    evidenceCited: z.array(z.string()).optional().describe('Evidence titles used'),
  })),
});

export type FullAngles = z.infer<typeof fullAnglesSchema>;

/**
 * Generate marketing angles with trust scores
 * Uses CREATIVE model (Claude Sonnet 4.5) with evidence grounding
 */
export async function generateAngles(
  audience: string,
  goal: string,
  offer: string,
  existingMessages: string[],
  options?: {
    evidence?: Evidence[];
    industry?: string;
    performance?: PerformanceData | null;
  }
): Promise<FullAngles> {
  const evidenceContext = options?.evidence?.length
    ? `\n\nAvailable evidence to ground claims:\n${options.evidence.map(e => `- ${e.title} (${e.source_type}): ${e.content.substring(0, 200)}...`).join('\n')}`
    : '';

  const performanceContext = options?.performance?.topAngles?.length
    ? `\n\nTop performing angles to learn from:\n${options.performance.topAngles.map(a => `- "${a.name}" (${(a.conversionRate * 100).toFixed(1)}% conversion)`).join('\n')}`
    : '';

  const messagesContext = existingMessages.length
    ? `\n\nExisting campaign messages:\n${existingMessages.map(m => `- ${m}`).join('\n')}`
    : '';

  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: fullAnglesSchema,
    system: buildAnglesPrompt({
      industry: options?.industry,
      evidence: options?.evidence,
      performance: options?.performance
        ? {
            top_performing: options.performance.topAngles?.map((angle) => `${angle.name} (${(angle.conversionRate * 100).toFixed(1)}% conversion)`),
            underperforming: options.performance.insights,
          }
        : undefined,
      audience,
    }),
    prompt: `Generate 3-5 marketing angles for:
Audience: ${audience}
Goal: ${goal}
Offer: ${offer}
${messagesContext}
${evidenceContext}
${performanceContext}`,
    temperature: 0.8,
  });

  return object as FullAngles;
}

// ============================================================================
// Page Blocks Generation (for generate-page route)
// ============================================================================

const pageBlockSchema = z.object({
  type: z.enum(['hero', 'features', 'testimonials', 'pricing', 'faq', 'cta', 'stats', 'comparison']),
  headline: z.string().describe('Block headline - use empty string if not needed'),
  subheadline: z.string().describe('Block subheadline or description - use empty string if not needed'),
  content: z.string().describe('Main content text - use empty string if not needed'),
  items: z.array(z.object({
    title: z.string(),
    description: z.string().describe('Item description - use empty string if not needed'),
    icon: z.string().describe('Icon name - use empty string if not needed'),
  })).describe('List items for features, FAQ, etc. - use empty array if not needed'),
  ctaText: z.string().describe('Call-to-action button text - use empty string if not needed'),
  ctaUrl: z.string().describe('Call-to-action URL - use "#" if not needed'),
  imageUrl: z.string().describe('Image URL for the block - use empty string if not needed'),
  testimonials: z.array(z.object({
    quote: z.string(),
    author: z.string(),
    role: z.string().describe('Author role - use empty string if not applicable'),
    company: z.string().describe('Company name - use empty string if not applicable'),
  })).describe('Testimonials for testimonial blocks - use empty array if not needed'),
  stats: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })).describe('Statistics for stats blocks - use empty array if not needed'),
});

const pageBlocksSchema = z.object({
  blocks: z.array(pageBlockSchema),
});

export type PageBlocks = z.infer<typeof pageBlocksSchema>;

/**
 * Generate landing page blocks structure
 * Uses STRUCTURED model (GPT-5.2) for reliable JSON
 */
export async function generatePageBlocks(
  audience: string,
  goal: string,
  offer: string,
  cta: string,
  messages: string[],
  options?: {
    forbiddenPhrases?: string[];
    brandVoice?: string;
    evidence?: Evidence[];
    pageGoal?: 'lead-gen' | 'demo' | 'purchase' | 'awareness';
    performance?: PerformanceData | null;
  }
): Promise<PageBlocks> {
  const performanceContext = options?.performance?.insights?.length
    ? `\n\nPerformance insights:\n${options.performance.insights.join('\n')}`
    : '';

  const evidenceContext = options?.evidence?.length
    ? `\n\nSocial proof available:\n${options.evidence.filter(e => e.source_type === 'testimonial' || e.source_type === 'case_study').map(e => `- ${e.title}`).join('\n')}`
    : '';

  const system = buildLandingPagePrompt({
    forbiddenPhrases: options?.forbiddenPhrases,
    brandVoice: options?.brandVoice,
    evidence: options?.evidence,
    pageGoal: options?.pageGoal === 'awareness' ? 'lead-gen' : options?.pageGoal,
    audience,
  })
  const prompt = `Generate page blocks for:
Audience: ${audience}
Goal: ${goal}
Offer: ${offer}
CTA: ${cta}

Key messages to incorporate:
${messages.map(m => `- ${m}`).join('\n')}${performanceContext}${evidenceContext}`

  try {
    return await generateStructuredOutput({
      schema: pageBlocksSchema,
      system,
      prompt,
      temperature: 0.5,
    });
  } catch (error) {
    if (!(error instanceof StructuredGenerationRoutingError)) {
      throw error
    }

    const fallbackModels = [MODELS.BALANCED, MODELS.FAST, MODELS.CREATIVE] as const
    let lastError: unknown = error

    for (const model of fallbackModels) {
      try {
        const fallback = await generateText({
          model,
          system: `${system}

Return only valid JSON. Do not use markdown fences. The JSON must match this exact shape:
{
  "blocks": [
    {
      "type": "hero|features|testimonials|pricing|faq|cta|stats|comparison",
      "headline": "string",
      "subheadline": "string",
      "content": "string",
      "items": [{ "title": "string", "description": "string", "icon": "string" }],
      "ctaText": "string",
      "ctaUrl": "string",
      "imageUrl": "string",
      "testimonials": [{ "quote": "string", "author": "string", "role": "string", "company": "string" }],
      "stats": [{ "value": "string", "label": "string" }]
    }
  ]
}

Use empty strings or empty arrays when a field is not needed.`,
          prompt,
        })

        const cleaned = fallback.text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '')
        const parsed = JSON.parse(cleaned) as unknown
        return pageBlocksSchema.parse(parsed)
      } catch (fallbackError) {
        if (isStructuredRoutingError(fallbackError)) {
          lastError = fallbackError
          continue
        }
        throw fallbackError
      }
    }

    throw new StructuredGenerationRoutingError(
      lastError instanceof Error ? lastError.message : undefined,
    )
  }
}

/**
 * Fetch performance data for the learning loop
 */
export async function fetchPerformanceForFeedback(
  campaignId: string,
  supabase: ReturnType<typeof import('@/lib/supabase/service').createServiceClient>
): Promise<PerformanceData | null> {
  try {
    // Get campaign workspace
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('workspace_id')
      .eq('id', campaignId)
      .single();

    if (!campaign) return null;

    // Get top performing messages from other campaigns
    const { data: topMessages } = await supabase
      .from('messages')
      .select('text, ctr')
      .eq('workspace_id', campaign.workspace_id)
      .not('ctr', 'is', null)
      .order('ctr', { ascending: false })
      .limit(5);

    // Get top performing angles
    const { data: topAngles } = await supabase
      .from('angles')
      .select('name, conversion_rate')
      .eq('workspace_id', campaign.workspace_id)
      .not('conversion_rate', 'is', null)
      .order('conversion_rate', { ascending: false })
      .limit(5);

    if (!topMessages?.length && !topAngles?.length) return null;

    return {
      topMessages: topMessages?.map(m => ({ text: m.text, ctr: m.ctr || 0 })),
      topAngles: topAngles?.map(a => ({ name: a.name, conversionRate: a.conversion_rate || 0 })),
      insights: [
        topMessages?.length ? `Your audience responds well to: "${topMessages[0]?.text?.substring(0, 50)}..."` : '',
        topAngles?.length ? `Best performing angle: ${topAngles[0]?.name}` : '',
      ].filter(Boolean),
    };
  } catch (error) {
    console.warn('Could not fetch performance data:', error);
    return null;
  }
}

// ============================================================================
// Embedding Functions
// ============================================================================

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: MODELS.EMBEDDING_SMALL,
    value: text,
  });
  return embedding;
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: MODELS.EMBEDDING_SMALL,
    values: texts,
  });
  return embeddings;
}
