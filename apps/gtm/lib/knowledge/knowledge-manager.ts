/**
 * Knowledge Base Manager
 * 
 * CRUD operations for knowledge items with semantic search support.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { generateEmbedding as generateTextEmbedding } from '@/lib/ai/ai-sdk-client'

export interface KnowledgeItem {
  id: string
  workspace_id: string
  title: string
  description?: string
  content: string
  content_type: 'document' | 'url' | 'manual' | 'data'
  source_url?: string
  file_path?: string
  file_name?: string
  file_size?: number
  mime_type?: string
  metadata: Record<string, unknown>
  tags: string[]
  chunk_index: number
  parent_id?: string
  status: 'processing' | 'active' | 'error' | 'archived'
  error_message?: string
  reference_count: number
  last_referenced_at?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateKnowledgeInput {
  title: string
  description?: string
  content: string
  content_type: KnowledgeItem['content_type']
  source_url?: string
  file_path?: string
  file_name?: string
  file_size?: number
  mime_type?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

/**
 * Create a new knowledge item
 */
export async function createKnowledgeItem(
  workspaceId: string,
  userId: string,
  input: CreateKnowledgeInput
): Promise<KnowledgeItem | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('knowledge_items')
    .insert({
      workspace_id: workspaceId,
      title: input.title,
      description: input.description,
      content: input.content,
      content_type: input.content_type,
      source_url: input.source_url,
      file_path: input.file_path,
      file_name: input.file_name,
      file_size: input.file_size,
      mime_type: input.mime_type,
      tags: input.tags || [],
      metadata: input.metadata || {},
      chunk_index: 0,
      status: 'processing', // Will be updated after embedding generation
      reference_count: 0,
      created_by: userId,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create knowledge item:', error)
    return null
  }

  // Generate embedding in background (simplified for now)
  await generateEmbedding(data.id, input.content)

  return data as KnowledgeItem
}

/**
 * Get knowledge item by ID
 */
export async function getKnowledgeItem(itemId: string): Promise<KnowledgeItem | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('id', itemId)
    .single()

  if (error) {
    return null
  }

  return data as KnowledgeItem
}

/**
 * Get all knowledge items for a workspace
 */
export async function getWorkspaceKnowledge(
  workspaceId: string,
  options?: {
    contentType?: string
    status?: string
    tags?: string[]
    limit?: number
    offset?: number
  }
): Promise<KnowledgeItem[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('knowledge_items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('parent_id', null) // Only root items, not chunks

  if (options?.contentType) {
    query = query.eq('content_type', options.contentType)
  }
  if (options?.status) {
    query = query.eq('status', options.status)
  }
  if (options?.tags && options.tags.length > 0) {
    query = query.contains('tags', options.tags)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }

  const { data, error } = await query.order('updated_at', { ascending: false })

  if (error) {
    console.error('Failed to get knowledge items:', error)
    return []
  }

  return data as KnowledgeItem[]
}

/**
 * Update knowledge item
 */
export async function updateKnowledgeItem(
  itemId: string,
  updates: Partial<KnowledgeItem>
): Promise<KnowledgeItem | null> {
  const supabase = createServiceClient()

  // Remove readonly fields
  const { id, workspace_id, created_by, created_at, reference_count, last_referenced_at, ...validUpdates } = updates as KnowledgeItem

  const { data, error } = await supabase
    .from('knowledge_items')
    .update(validUpdates)
    .eq('id', itemId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update knowledge item:', error)
    return null
  }

  // Re-generate embedding if content changed
  if (updates.content) {
    await generateEmbedding(itemId, updates.content)
  }

  return data as KnowledgeItem
}

/**
 * Delete knowledge item
 */
export async function deleteKnowledgeItem(itemId: string): Promise<boolean> {
  const supabase = createServiceClient()

  // Delete chunks first
  await supabase
    .from('knowledge_items')
    .delete()
    .eq('parent_id', itemId)

  const { error } = await supabase
    .from('knowledge_items')
    .delete()
    .eq('id', itemId)

  return !error
}

/**
 * Search knowledge items by text (full-text search)
 */
export async function searchKnowledge(
  workspaceId: string,
  query: string,
  limit: number = 10
): Promise<KnowledgeItem[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .limit(limit)

  if (error) {
    console.error('Failed to search knowledge:', error)
    return []
  }

  return data as KnowledgeItem[]
}

/**
 * Get knowledge stats for a workspace
 */
export async function getKnowledgeStats(workspaceId: string): Promise<{
  total: number
  byType: Record<string, number>
  byStatus: Record<string, number>
  recentlyUpdated: number
}> {
  const supabase = createServiceClient()

  // Get total count
  const { count: total } = await supabase
    .from('knowledge_items')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .is('parent_id', null)

  // Get counts by type
  const { data: typeData } = await supabase
    .from('knowledge_items')
    .select('content_type')
    .eq('workspace_id', workspaceId)
    .is('parent_id', null)

  const byType: Record<string, number> = {}
  for (const item of typeData || []) {
    byType[item.content_type] = (byType[item.content_type] || 0) + 1
  }

  // Get counts by status
  const { data: statusData } = await supabase
    .from('knowledge_items')
    .select('status')
    .eq('workspace_id', workspaceId)
    .is('parent_id', null)

  const byStatus: Record<string, number> = {}
  for (const item of statusData || []) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1
  }

  // Get recently updated count (last 7 days)
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const { count: recentlyUpdated } = await supabase
    .from('knowledge_items')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .is('parent_id', null)
    .gte('updated_at', weekAgo.toISOString())

  return {
    total: total || 0,
    byType,
    byStatus,
    recentlyUpdated: recentlyUpdated || 0,
  }
}

/**
 * Generate and store embedding for a knowledge item using text-embedding-3-small (1536-dim).
 * Items are set to 'processing' on creation and 'active' once the embedding is stored,
 * making them retrievable via the search_knowledge RPC.
 */
async function generateEmbedding(itemId: string, content: string): Promise<void> {
  const supabase = createServiceClient()

  try {
    const embedding = await generateTextEmbedding(content)

    await supabase
      .from('knowledge_items')
      .update({ embedding, status: 'active' })
      .eq('id', itemId)
  } catch (error) {
    console.error('Failed to generate embedding for knowledge item:', itemId, error)
    await supabase
      .from('knowledge_items')
      .update({ status: 'error', error_message: 'Embedding generation failed' })
      .eq('id', itemId)
  }
}

/**
 * Increment reference count for knowledge items
 */
export async function trackKnowledgeReference(itemIds: string[]): Promise<void> {
  const supabase = createServiceClient()

  for (const itemId of itemIds) {
    await supabase.rpc('increment_knowledge_reference', { p_item_id: itemId })
  }
}
