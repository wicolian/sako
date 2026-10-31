/**
 * Request Manager
 * 
 * CRUD operations and workflow state machine for the Request OS.
 */

import { createServiceClient } from '@/lib/supabase/service'
import type {
  Request,
  CreateRequestInput,
  UpdateRequestInput,
  AddFeedbackInput,
  RequestListOptions,
  RequestStats,
  RequestStatus,
  FeedbackEntry,
} from './request-types'

// ============================================================================
// Status Workflow
// ============================================================================

const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  new: ['in_progress', 'cancelled'],
  in_progress: ['review', 'new', 'cancelled'],
  review: ['approved', 'in_progress', 'cancelled'],
  approved: ['done', 'in_progress'],
  done: [], // Terminal state
  cancelled: [], // Terminal state
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(from: RequestStatus, to: RequestStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to)
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new request
 */
export async function createRequest(
  workspaceId: string,
  userId: string,
  input: CreateRequestInput
): Promise<Request> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('requests')
    .insert({
      workspace_id: workspaceId,
      requester_id: userId,
      assignee_id: input.assigneeId,
      asset_type: input.assetType,
      title: input.title,
      brief: input.brief,
      priority: input.priority || 'normal',
      due_date: input.dueDate,
      source: input.source || 'app',
      source_metadata: input.sourceMetadata || {},
    })
    .select()
    .single()
  
  if (error) {
    throw new Error(`Failed to create request: ${error.message}`)
  }
  
  return mapDbRequest(data)
}

/**
 * Get a request by ID
 */
export async function getRequest(
  requestId: string,
  workspaceId: string
): Promise<Request | null> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .eq('id', requestId)
    .eq('workspace_id', workspaceId)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return mapDbRequest(data)
}

/**
 * List requests with filters
 */
export async function listRequests(
  workspaceId: string,
  options: RequestListOptions = {}
): Promise<{ requests: Request[]; total: number }> {
  const supabase = createServiceClient()
  
  let query = supabase
    .from('requests')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
  
  // Apply filters
  if (options.filters?.status?.length) {
    query = query.in('status', options.filters.status)
  }
  if (options.filters?.assetType?.length) {
    query = query.in('asset_type', options.filters.assetType)
  }
  if (options.filters?.priority?.length) {
    query = query.in('priority', options.filters.priority)
  }
  if (options.filters?.assigneeId) {
    query = query.eq('assignee_id', options.filters.assigneeId)
  }
  if (options.filters?.requesterId) {
    query = query.eq('requester_id', options.filters.requesterId)
  }
  if (options.filters?.search) {
    query = query.ilike('title', `%${options.filters.search}%`)
  }
  
  // Apply sorting
  const sortBy = options.sortBy || 'created_at'
  const sortOrder = options.sortOrder === 'asc' ? true : false
  query = query.order(sortBy, { ascending: sortOrder })
  
  // Apply pagination
  if (options.limit) {
    query = query.limit(options.limit)
  }
  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
  }
  
  const { data, error, count } = await query
  
  if (error) {
    throw new Error(`Failed to list requests: ${error.message}`)
  }
  
  return {
    requests: (data || []).map(mapDbRequest),
    total: count || 0,
  }
}

/**
 * Update a request
 */
export async function updateRequest(
  requestId: string,
  workspaceId: string,
  input: UpdateRequestInput
): Promise<Request> {
  const supabase = createServiceClient()
  
  // If status change, validate transition
  if (input.status) {
    const existing = await getRequest(requestId, workspaceId)
    if (existing && !isValidTransition(existing.status, input.status)) {
      throw new Error(`Invalid status transition from ${existing.status} to ${input.status}`)
    }
  }
  
  const updateData: Record<string, unknown> = {}
  if (input.title !== undefined) updateData.title = input.title
  if (input.brief !== undefined) updateData.brief = input.brief
  if (input.priority !== undefined) updateData.priority = input.priority
  if (input.dueDate !== undefined) updateData.due_date = input.dueDate
  if (input.assigneeId !== undefined) updateData.assignee_id = input.assigneeId
  if (input.status !== undefined) updateData.status = input.status
  
  const { data, error } = await supabase
    .from('requests')
    .update(updateData)
    .eq('id', requestId)
    .eq('workspace_id', workspaceId)
    .select()
    .single()
  
  if (error) {
    throw new Error(`Failed to update request: ${error.message}`)
  }
  
  return mapDbRequest(data)
}

/**
 * Add feedback to a request
 */
export async function addFeedback(
  requestId: string,
  workspaceId: string,
  userId: string,
  userName: string,
  input: AddFeedbackInput
): Promise<Request> {
  const supabase = createServiceClient()
  
  // Get existing feedback
  const existing = await getRequest(requestId, workspaceId)
  if (!existing) {
    throw new Error('Request not found')
  }
  
  const newFeedback: FeedbackEntry = {
    id: crypto.randomUUID(),
    userId,
    userName,
    content: input.content,
    type: input.type,
    createdAt: new Date().toISOString(),
  }
  
  const updatedFeedback = [...existing.feedback, newFeedback]
  
  const { data, error } = await supabase
    .from('requests')
    .update({ feedback: updatedFeedback })
    .eq('id', requestId)
    .eq('workspace_id', workspaceId)
    .select()
    .single()
  
  if (error) {
    throw new Error(`Failed to add feedback: ${error.message}`)
  }
  
  return mapDbRequest(data)
}

/**
 * Get request statistics
 */
export async function getRequestStats(workspaceId: string): Promise<RequestStats> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('requests')
    .select('status, priority, asset_type, due_date, created_at, completed_at')
    .eq('workspace_id', workspaceId)
  
  if (error) {
    throw new Error(`Failed to get stats: ${error.message}`)
  }
  
  const requests = data || []
  
  const byStatus: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  const byAssetType: Record<string, number> = {}
  let overdueCount = 0
  let completedWithTime = 0
  let totalCompletionTime = 0
  
  const now = new Date()
  
  for (const req of requests) {
    byStatus[req.status] = (byStatus[req.status] || 0) + 1
    byPriority[req.priority] = (byPriority[req.priority] || 0) + 1
    byAssetType[req.asset_type] = (byAssetType[req.asset_type] || 0) + 1
    
    // Check overdue
    if (req.due_date && !['done', 'cancelled'].includes(req.status)) {
      if (new Date(req.due_date) < now) {
        overdueCount++
      }
    }
    
    // Calculate completion time
    if (req.completed_at && req.created_at) {
      const completionMs = new Date(req.completed_at).getTime() - new Date(req.created_at).getTime()
      totalCompletionTime += completionMs
      completedWithTime++
    }
  }
  
  return {
    total: requests.length,
    byStatus: byStatus as RequestStats['byStatus'],
    byPriority: byPriority as RequestStats['byPriority'],
    byAssetType: byAssetType as RequestStats['byAssetType'],
    overdueCount,
    avgCompletionTimeHours: completedWithTime > 0
      ? Math.round(totalCompletionTime / completedWithTime / (1000 * 60 * 60))
      : undefined,
  }
}

// ============================================================================
// Helpers
// ============================================================================

function mapDbRequest(data: Record<string, unknown>): Request {
  return {
    id: data.id as string,
    workspaceId: data.workspace_id as string,
    requesterId: data.requester_id as string,
    assigneeId: data.assignee_id as string | undefined,
    assetType: data.asset_type as Request['assetType'],
    title: data.title as string,
    brief: data.brief as Request['brief'],
    priority: data.priority as Request['priority'],
    dueDate: data.due_date as string | undefined,
    status: data.status as Request['status'],
    kitId: data.kit_id as string | undefined,
    feedback: (data.feedback as FeedbackEntry[]) || [],
    source: data.source as Request['source'],
    sourceMetadata: data.source_metadata as Request['sourceMetadata'],
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    completedAt: data.completed_at as string | undefined,
  }
}
