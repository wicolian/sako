/**
 * Canvas Collaboration (Phase 3.3)
 * 
 * Real-time collaborative canvas for multi-user editing.
 * Uses Supabase Realtime for synchronization.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface CanvasState {
  id: string
  workspace_id: string
  campaign_id: string
  blocks: CanvasBlock[]
  connections: CanvasConnection[]
  viewport: { x: number; y: number; zoom: number }
  updated_at: string
}

export interface CanvasBlock {
  id: string
  type: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  content: Record<string, unknown>
  style?: Record<string, unknown>
  locked?: boolean
  locked_by?: string
}

export interface CanvasConnection {
  id: string
  source_id: string
  target_id: string
  type?: 'flow' | 'reference' | 'dependency'
}

export interface CanvasCursor {
  user_id: string
  user_name: string
  user_color: string
  position: { x: number; y: number }
  selection?: string[] // Block IDs
  updated_at: string
}

export interface CanvasOperation {
  id: string
  type: 'add_block' | 'update_block' | 'delete_block' | 'move_block' | 'add_connection' | 'delete_connection'
  payload: Record<string, unknown>
  user_id: string
  timestamp: string
}

/**
 * Get canvas state for a campaign
 */
export async function getCanvasState(campaignId: string): Promise<CanvasState | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('canvas_states')
    .select('*')
    .eq('campaign_id', campaignId)
    .single()

  if (error) {
    // Canvas state doesn't exist yet
    return null
  }

  return data as CanvasState
}

/**
 * Initialize canvas state for a campaign
 */
export async function initializeCanvas(
  campaignId: string,
  workspaceId: string
): Promise<CanvasState> {
  const supabase = createServiceClient()

  const initialState = {
    campaign_id: campaignId,
    workspace_id: workspaceId,
    blocks: [],
    connections: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }

  const { data, error } = await supabase
    .from('canvas_states')
    .upsert(initialState, { onConflict: 'campaign_id' })
    .select()
    .single()

  if (error) {
    throw new Error('Failed to initialize canvas')
  }

  return data as CanvasState
}

/**
 * Apply an operation to the canvas
 */
export async function applyCanvasOperation(
  campaignId: string,
  operation: Omit<CanvasOperation, 'id' | 'timestamp'>
): Promise<CanvasState> {
  const supabase = createServiceClient()

  // Get current state
  const state = await getCanvasState(campaignId)
  if (!state) {
    throw new Error('Canvas not found')
  }

  // Apply operation
  let blocks = [...state.blocks]
  let connections = [...state.connections]

  switch (operation.type) {
    case 'add_block': {
      const block = operation.payload.block as CanvasBlock
      blocks.push(block)
      break
    }

    case 'update_block': {
      const { id, updates } = operation.payload as { id: string; updates: Partial<CanvasBlock> }
      blocks = blocks.map(b =>
        b.id === id ? { ...b, ...updates } : b
      )
      break
    }

    case 'delete_block': {
      const { id } = operation.payload as { id: string }
      blocks = blocks.filter(b => b.id !== id)
      // Also remove connections
      connections = connections.filter(
        c => c.source_id !== id && c.target_id !== id
      )
      break
    }

    case 'move_block': {
      const { id, position } = operation.payload as { id: string; position: { x: number; y: number } }
      blocks = blocks.map(b =>
        b.id === id ? { ...b, position } : b
      )
      break
    }

    case 'add_connection': {
      const connection = operation.payload.connection as CanvasConnection
      connections.push(connection)
      break
    }

    case 'delete_connection': {
      const { id } = operation.payload as { id: string }
      connections = connections.filter(c => c.id !== id)
      break
    }
  }

  // Save updated state
  const { data, error } = await supabase
    .from('canvas_states')
    .update({
      blocks,
      connections,
      updated_at: new Date().toISOString(),
    })
    .eq('campaign_id', campaignId)
    .select()
    .single()

  if (error) {
    throw new Error('Failed to apply operation')
  }

  // Record operation in history
  await supabase.from('canvas_operations').insert({
    canvas_id: state.id,
    operation_type: operation.type,
    payload: operation.payload,
    user_id: operation.user_id,
    created_at: new Date().toISOString(),
  })

  return data as CanvasState
}

/**
 * Lock a block for editing
 */
export async function lockBlock(
  campaignId: string,
  blockId: string,
  userId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  const state = await getCanvasState(campaignId)
  if (!state) return false

  const block = state.blocks.find(b => b.id === blockId)
  if (!block) return false

  // Check if already locked by someone else
  if (block.locked && block.locked_by !== userId) {
    return false
  }

  // Apply lock
  const blocks = state.blocks.map(b =>
    b.id === blockId ? { ...b, locked: true, locked_by: userId } : b
  )

  const { error } = await supabase
    .from('canvas_states')
    .update({ blocks })
    .eq('campaign_id', campaignId)

  return !error
}

/**
 * Unlock a block
 */
export async function unlockBlock(
  campaignId: string,
  blockId: string,
  userId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  const state = await getCanvasState(campaignId)
  if (!state) return false

  const block = state.blocks.find(b => b.id === blockId)
  if (!block) return false

  // Only the locker can unlock
  if (block.locked_by && block.locked_by !== userId) {
    return false
  }

  const blocks = state.blocks.map(b =>
    b.id === blockId ? { ...b, locked: false, locked_by: undefined } : b
  )

  const { error } = await supabase
    .from('canvas_states')
    .update({ blocks })
    .eq('campaign_id', campaignId)

  return !error
}

/**
 * Broadcast cursor position
 */
export async function broadcastCursor(
  campaignId: string,
  cursor: CanvasCursor
): Promise<void> {
  const supabase = createServiceClient()

  // Update cursor in the presence channel
  await supabase.from('canvas_cursors').upsert({
    campaign_id: campaignId,
    user_id: cursor.user_id,
    user_name: cursor.user_name,
    user_color: cursor.user_color,
    position: cursor.position,
    selection: cursor.selection,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'campaign_id,user_id' })

  // Clean up old cursors (users who left)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  await supabase
    .from('canvas_cursors')
    .delete()
    .eq('campaign_id', campaignId)
    .lt('updated_at', fiveMinutesAgo)
}

/**
 * Get active cursors for a campaign
 */
export async function getActiveCursors(campaignId: string): Promise<CanvasCursor[]> {
  const supabase = createServiceClient()

  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('canvas_cursors')
    .select('*')
    .eq('campaign_id', campaignId)
    .gte('updated_at', oneMinuteAgo)

  if (error) {
    return []
  }

  return data as CanvasCursor[]
}

/**
 * Get canvas operation history
 */
export async function getCanvasHistory(
  campaignId: string,
  limit: number = 50
): Promise<CanvasOperation[]> {
  const supabase = createServiceClient()

  const state = await getCanvasState(campaignId)
  if (!state) return []

  const { data, error } = await supabase
    .from('canvas_operations')
    .select('*')
    .eq('canvas_id', state.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return []
  }

  return data.map(op => ({
    id: op.id,
    type: op.operation_type,
    payload: op.payload,
    user_id: op.user_id,
    timestamp: op.created_at,
  }))
}

/**
 * Undo last operation by user
 */
export async function undoLastOperation(
  campaignId: string,
  userId: string
): Promise<CanvasState | null> {
  const supabase = createServiceClient()

  const state = await getCanvasState(campaignId)
  if (!state) return null

  // Get last operation by this user
  const { data: operations } = await supabase
    .from('canvas_operations')
    .select('*')
    .eq('canvas_id', state.id)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!operations || operations.length === 0) {
    return state
  }

  const lastOp = operations[0]

  // Apply inverse operation
  let inverseType: CanvasOperation['type']
  let inversePayload: Record<string, unknown>

  switch (lastOp.operation_type) {
    case 'add_block':
      inverseType = 'delete_block'
      const blockPayload = lastOp.payload as { block?: { id?: string } }
      inversePayload = { id: blockPayload.block?.id }
      break

    case 'delete_block':
      inverseType = 'add_block'
      inversePayload = { block: lastOp.payload }
      break

    case 'move_block':
      // Would need previous position stored
      return state

    default:
      return state
  }

  // Delete the undone operation
  await supabase
    .from('canvas_operations')
    .delete()
    .eq('id', lastOp.id)

  // Apply inverse
  return applyCanvasOperation(campaignId, {
    type: inverseType,
    payload: inversePayload,
    user_id: userId,
  })
}

/**
 * Generate a unique color for a user
 */
export function generateUserColor(userId: string): string {
  // Generate a deterministic color from user ID
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }

  const hue = hash % 360
  return `hsl(${hue}, 70%, 50%)`
}
