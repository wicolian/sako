/**
 * Memory Manager (Feb 2026)
 *
 * CRUD operations and semantic search for Production Memory.
 * Embeddings route through OpenRouter via the unified AI wrapper,
 * providing LangSmith tracing and workspace-level settings.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { embed } from '@/lib/ai/langsmith-ai'
import { MODELS } from '@/lib/ai/ai-sdk-client'
import type {
  MemoryItem,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemorySearchInput,
  MemorySearchResult,
  MemoryStats,
  LearningSignal,
  LearnableContent,
} from './memory-types'
import crypto from 'crypto'

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate embedding for text via OpenRouter (text-embedding-3-large).
 *
 * Routed through the unified langsmith-ai wrapper so embeddings get:
 * - LangSmith tracing
 * - OpenRouter provider routing (fallbacks, cost tracking)
 * - No direct OPENAI_API_KEY dependency
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: MODELS.EMBEDDING,
    value: text,
  })
  return embedding
}

/**
 * Generate content hash for deduplication
 */
function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content.toLowerCase().trim()).digest('hex')
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new memory item
 */
export async function createMemoryItem(
  workspaceId: string,
  input: CreateMemoryInput
): Promise<MemoryItem> {
  const supabase = createServiceClient()
  
  const contentHash = hashContent(input.content)
  
  // Check for duplicates
  const { data: existing } = await supabase
    .from('memory_items')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('content_hash', contentHash)
    .single()
  
  if (existing) {
    throw new Error('Content already exists in memory')
  }
  
  // Generate embedding
  let embedding: number[] | null = null
  try {
    embedding = await generateEmbedding(input.content)
  } catch (error) {
    console.warn('Failed to generate embedding:', error)
  }
  
  const { data, error } = await supabase
    .from('memory_items')
    .insert({
      workspace_id: workspaceId,
      content_type: input.contentType,
      content: input.content,
      content_hash: contentHash,
      embedding,
      context: input.context || {},
      source_type: input.sourceType || 'generated',
      source_id: input.sourceId,
    })
    .select()
    .single()
  
  if (error) {
    throw new Error(`Failed to create memory item: ${error.message}`)
  }
  
  return mapDbMemoryItem(data)
}

/**
 * Get a memory item by ID
 */
export async function getMemoryItem(
  itemId: string,
  workspaceId: string
): Promise<MemoryItem | null> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('memory_items')
    .select('*')
    .eq('id', itemId)
    .eq('workspace_id', workspaceId)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return mapDbMemoryItem(data)
}

/**
 * Update a memory item
 */
export async function updateMemoryItem(
  itemId: string,
  workspaceId: string,
  input: UpdateMemoryInput
): Promise<MemoryItem> {
  const supabase = createServiceClient()
  
  const updateData: Record<string, unknown> = {}
  if (input.status !== undefined) updateData.status = input.status
  if (input.feedbackScore !== undefined) updateData.feedback_score = input.feedbackScore
  if (input.feedbackReasons !== undefined) updateData.feedback_reasons = input.feedbackReasons
  if (input.performance !== undefined) updateData.performance = input.performance
  
  const { data, error } = await supabase
    .from('memory_items')
    .update(updateData)
    .eq('id', itemId)
    .eq('workspace_id', workspaceId)
    .select()
    .single()
  
  if (error) {
    throw new Error(`Failed to update memory item: ${error.message}`)
  }
  
  return mapDbMemoryItem(data)
}

/**
 * Delete a memory item
 */
export async function deleteMemoryItem(
  itemId: string,
  workspaceId: string
): Promise<void> {
  const supabase = createServiceClient()
  
  const { error } = await supabase
    .from('memory_items')
    .delete()
    .eq('id', itemId)
    .eq('workspace_id', workspaceId)
  
  if (error) {
    throw new Error(`Failed to delete memory item: ${error.message}`)
  }
}

// ============================================================================
// Semantic Search
// ============================================================================

/**
 * Search memory items by semantic similarity
 */
export async function searchMemory(
  workspaceId: string,
  input: MemorySearchInput
): Promise<MemorySearchResult[]> {
  const supabase = createServiceClient()
  
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(input.query)
  
  // Search using the database function
  const { data, error } = await supabase.rpc('search_memory_by_embedding', {
    p_workspace_id: workspaceId,
    p_embedding: queryEmbedding,
    p_content_type: input.contentType || null,
    p_limit: input.limit || 10,
  })
  
  if (error) {
    throw new Error(`Memory search failed: ${error.message}`)
  }
  
  // Filter by status if specified
  let results = (data || [])
  if (input.status) {
    results = results.filter((r: Record<string, unknown>) => r.status === input.status)
  }
  
  return results.map((r: Record<string, unknown>) => ({
    item: {
      id: r.id as string,
      workspaceId,
      contentType: r.content_type as MemoryItem['contentType'],
      content: r.content as string,
      contentHash: '',
      context: {},
      status: r.status as MemoryItem['status'],
      feedbackScore: r.feedback_score as number,
      feedbackReasons: [],
      performance: {},
      sourceType: 'generated' as const,
      createdAt: '',
      updatedAt: '',
    },
    similarity: r.similarity as number,
  }))
}

/**
 * Get similar content from memory
 */
export async function getSimilarContent(
  workspaceId: string,
  content: string,
  limit: number = 5
): Promise<MemorySearchResult[]> {
  return searchMemory(workspaceId, {
    query: content,
    status: 'approved',
    limit,
  })
}

// ============================================================================
// Learning
// ============================================================================

/**
 * Learn from content (store approved content for future use)
 */
export async function learnFromContent(
  workspaceId: string,
  content: LearnableContent
): Promise<MemoryItem> {
  return createMemoryItem(workspaceId, {
    contentType: content.contentType,
    content: content.content,
    context: content.context,
    sourceType: content.sourceType,
    sourceId: content.sourceId,
  })
}

/**
 * Process a learning signal (approval, rejection, etc.)
 */
export async function processLearningSignal(
  workspaceId: string,
  signal: LearningSignal
): Promise<MemoryItem> {
  const updates: UpdateMemoryInput = {}
  
  switch (signal.signalType) {
    case 'approval':
      updates.status = 'approved'
      updates.feedbackScore = signal.score || 50
      break
    case 'rejection':
      updates.status = 'rejected'
      updates.feedbackScore = signal.score || -50
      if (signal.reason) {
        updates.feedbackReasons = [signal.reason]
      }
      break
    case 'edit':
      // Content was edited before approval
      updates.feedbackScore = signal.score || 25
      break
    case 'performance':
      // Performance data received
      updates.performance = signal.metadata as MemoryItem['performance']
      break
  }
  
  return updateMemoryItem(signal.itemId, workspaceId, updates)
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get memory statistics for a workspace
 */
export async function getMemoryStats(workspaceId: string): Promise<MemoryStats> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase.rpc('get_memory_stats', {
    p_workspace_id: workspaceId,
  })
  
  if (error) {
    throw new Error(`Failed to get memory stats: ${error.message}`)
  }
  
  const row = data?.[0] || {}
  
  return {
    totalItems: row.total_items || 0,
    approvedItems: row.approved_items || 0,
    rejectedItems: row.rejected_items || 0,
    avgFeedbackScore: row.avg_feedback_score || 0,
    itemsByType: row.items_by_type || {},
  }
}

// ============================================================================
// Helpers
// ============================================================================

function mapDbMemoryItem(data: Record<string, unknown>): MemoryItem {
  return {
    id: data.id as string,
    workspaceId: data.workspace_id as string,
    contentType: data.content_type as MemoryItem['contentType'],
    content: data.content as string,
    contentHash: data.content_hash as string,
    context: (data.context as MemoryItem['context']) || {},
    status: data.status as MemoryItem['status'],
    feedbackScore: data.feedback_score as number,
    feedbackReasons: (data.feedback_reasons as string[]) || [],
    performance: (data.performance as MemoryItem['performance']) || {},
    sourceType: data.source_type as MemoryItem['sourceType'],
    sourceId: data.source_id as string | undefined,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    lastUsedAt: data.last_used_at as string | undefined,
  }
}
