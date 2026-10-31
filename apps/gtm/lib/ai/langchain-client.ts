/**
 * LangChain Client Configuration (Jan 2026)
 * 
 * IMPORTANT: This file is ONLY for LangGraph state machine usage.
 * For all other AI tasks, use ai-sdk-client.ts with Vercel AI Gateway.
 * 
 * LangChain is kept here solely for the claim validation pipeline
 * which benefits from LangGraph's state machine capabilities.
 */

import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

// ============================================================================
// Model Configuration (2026 Allowlist - for LangGraph only)
// ============================================================================

// Note: LangChain uses OpenAI SDK directly for LangGraph compatibility
// These models are used ONLY for LangGraph state machines
// For all other AI tasks, use ai-sdk-client.ts with Vercel AI Gateway
const DEFAULT_MODEL = 'gpt-5.4' // Best available for LangGraph (OpenAI direct)
const FAST_MODEL = 'gpt-5.3-chat' // Fast model for LangGraph

// Note: LangChain doesn't yet support AI Gateway routing, so we use OpenAI directly
// The validation-graph.ts has been updated to use ai-sdk-client for most operations

// For production, prefer AI SDK Gateway over LangChain direct calls
// LangChain is only used for LangGraph state machines

export interface LangChainClientOptions {
  model?: string
  temperature?: number
  maxRetries?: number
  streaming?: boolean
}

// ============================================================================
// Client Factory (LangGraph only)
// ============================================================================

/**
 * Create a ChatOpenAI client for LangGraph pipelines
 * @deprecated Prefer AI SDK Gateway for non-LangGraph use cases
 */
export function createChatClient(options: LangChainClientOptions = {}) {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxRetries = 2,
    streaming = false,
  } = options

  return new ChatOpenAI({
    model,
    temperature,
    maxRetries,
    streaming,
    // Uses OPENAI_API_KEY from env for LangGraph compatibility
    // TODO: Migrate to AI Gateway when LangChain supports it
  })
}

/**
 * Create a client with structured output using a Zod schema
 */
export function createStructuredClient<T extends z.ZodType>(
  schema: T,
  options: LangChainClientOptions = {}
) {
  const client = createChatClient(options)
  return client.withStructuredOutput(schema)
}

// ============================================================================
// Zod Schemas for Structured Outputs (LangGraph)
// ============================================================================

// Claims extraction schema (for validation pipeline)
export const ClaimsSchema = z.object({
  claims: z.array(z.object({
    text: z.string().describe('The claim text'),
    claimType: z.enum(['hard', 'soft', 'unverified']).describe('Claim strength classification'),
    category: z.enum(['performance', 'security', 'pricing', 'compliance', 'generic']).describe('Claim category'),
    confidence: z.number().min(0).max(1).describe('AI confidence in this claim'),
    sourceContext: z.string().optional().describe('Which evidence supports this claim'),
  })).describe('List of extracted claims'),
})

export type GeneratedClaims = z.infer<typeof ClaimsSchema>

// Rewrite suggestions schema (for validation pipeline)
export const RewritesSchema = z.object({
  rewrites: z.array(z.object({
    originalClaim: z.string().describe('The original blocked/needs-proof claim'),
    rewrittenClaim: z.string().describe('Compliant version of the claim'),
    explanation: z.string().describe('Why this rewrite is compliant'),
    preservesMeaning: z.boolean().describe('Whether the rewrite preserves the core message'),
  })).describe('Compliant rewrites for blocked claims'),
})

export type GeneratedRewrites = z.infer<typeof RewritesSchema>

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a client with a fast model for simpler tasks
 */
export function createFastClient<T extends z.ZodType>(
  schema: T,
  options: LangChainClientOptions = {}
) {
  return createStructuredClient(schema, {
    ...options,
    model: FAST_MODEL,
  })
}
