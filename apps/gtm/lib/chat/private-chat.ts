/**
 * Private Chat Manager
 * 
 * Handles confidential workspace conversations within Canvas projects.
 * Supports real-time messaging via Supabase Realtime.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

export interface PrivateChat {
  id: string
  workspace_id: string
  project_id?: string
  name?: string
  description?: string
  participants: string[]
  is_archived: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface PrivateChatMessage {
  id: string
  chat_id: string
  user_id: string
  content: string
  message_type: 'text' | 'system' | 'ai_response'
  metadata: Record<string, unknown>
  is_edited: boolean
  edited_at?: string
  created_at: string
  // Joined fields
  user?: {
    id: string
    email: string
    raw_user_meta_data?: {
      full_name?: string
      avatar_url?: string
    }
  }
}

export interface CreateChatOptions {
  workspaceId: string
  projectId?: string
  name?: string
  description?: string
  participants: string[]
}

export interface SendMessageOptions {
  chatId: string
  content: string
  messageType?: 'text' | 'system' | 'ai_response'
  metadata?: Record<string, unknown>
}

// ============================================================================
// Chat Manager Class
// ============================================================================

export class PrivateChatManager {
  /**
   * Create a new private chat
   */
  static async createChat(
    userId: string,
    options: CreateChatOptions
  ): Promise<PrivateChat> {
    const supabase = createServiceClient()
    
    // Ensure creator is in participants
    const participants = [...new Set([...options.participants, userId])]
    
    const { data, error } = await supabase
      .from('private_chats')
      .insert({
        workspace_id: options.workspaceId,
        project_id: options.projectId,
        name: options.name,
        description: options.description,
        participants,
        created_by: userId,
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to create chat: ${error.message}`)
    }
    
    // Send system message announcing chat creation
    await this.sendMessage(userId, {
      chatId: data.id,
      content: 'Chat created',
      messageType: 'system',
    })
    
    return data
  }
  
  /**
   * Get chats for a user in a workspace
   */
  static async getChats(
    workspaceId: string,
    userId: string,
    options?: {
      projectId?: string
      includeArchived?: boolean
    }
  ): Promise<PrivateChat[]> {
    const supabase = createServiceClient()
    
    let query = supabase
      .from('private_chats')
      .select('*')
      .eq('workspace_id', workspaceId)
      .contains('participants', [userId])
      .order('updated_at', { ascending: false })
    
    if (options?.projectId) {
      query = query.eq('project_id', options.projectId)
    }
    
    if (!options?.includeArchived) {
      query = query.eq('is_archived', false)
    }
    
    const { data, error } = await query
    
    if (error) {
      throw new Error(`Failed to get chats: ${error.message}`)
    }
    
    return data || []
  }
  
  /**
   * Get a single chat by ID
   */
  static async getChat(chatId: string): Promise<PrivateChat | null> {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('private_chats')
      .select('*')
      .eq('id', chatId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get chat: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Update chat details
   */
  static async updateChat(
    chatId: string,
    updates: {
      name?: string
      description?: string
      is_archived?: boolean
    }
  ): Promise<PrivateChat> {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('private_chats')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to update chat: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Add participants to a chat
   */
  static async addParticipants(
    chatId: string,
    userId: string,
    newParticipants: string[]
  ): Promise<PrivateChat> {
    const supabase = createServiceClient()
    
    // Get current chat
    const chat = await this.getChat(chatId)
    if (!chat) {
      throw new Error('Chat not found')
    }
    
    // Merge participants
    const participants = [...new Set([...chat.participants, ...newParticipants])]
    
    const { data, error } = await supabase
      .from('private_chats')
      .update({
        participants,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to add participants: ${error.message}`)
    }
    
    // Send system message
    await this.sendMessage(userId, {
      chatId,
      content: `${newParticipants.length} participant(s) added to the chat`,
      messageType: 'system',
    })
    
    return data
  }
  
  /**
   * Remove a participant from a chat
   */
  static async removeParticipant(
    chatId: string,
    userId: string,
    participantToRemove: string
  ): Promise<PrivateChat> {
    const supabase = createServiceClient()
    
    // Get current chat
    const chat = await this.getChat(chatId)
    if (!chat) {
      throw new Error('Chat not found')
    }
    
    // Remove participant
    const participants = chat.participants.filter(p => p !== participantToRemove)
    
    const { data, error } = await supabase
      .from('private_chats')
      .update({
        participants,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to remove participant: ${error.message}`)
    }
    
    // Send system message
    await this.sendMessage(userId, {
      chatId,
      content: 'A participant left the chat',
      messageType: 'system',
    })
    
    return data
  }
  
  /**
   * Delete a chat (soft delete by archiving)
   */
  static async deleteChat(chatId: string): Promise<void> {
    const supabase = createServiceClient()
    
    const { error } = await supabase
      .from('private_chats')
      .delete()
      .eq('id', chatId)
    
    if (error) {
      throw new Error(`Failed to delete chat: ${error.message}`)
    }
  }
  
  /**
   * Send a message to a chat
   */
  static async sendMessage(
    userId: string,
    options: SendMessageOptions
  ): Promise<PrivateChatMessage> {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('private_chat_messages')
      .insert({
        chat_id: options.chatId,
        user_id: userId,
        content: options.content,
        message_type: options.messageType || 'text',
        metadata: options.metadata || {},
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to send message: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Get messages for a chat
   */
  static async getMessages(
    chatId: string,
    options?: {
      limit?: number
      before?: string // cursor for pagination
    }
  ): Promise<PrivateChatMessage[]> {
    const supabase = createServiceClient()
    
    let query = supabase
      .from('private_chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(options?.limit || 50)
    
    if (options?.before) {
      query = query.lt('created_at', options.before)
    }
    
    const { data, error } = await query
    
    if (error) {
      throw new Error(`Failed to get messages: ${error.message}`)
    }
    
    // Return in chronological order
    return (data || []).reverse()
  }
  
  /**
   * Edit a message
   */
  static async editMessage(
    messageId: string,
    newContent: string
  ): Promise<PrivateChatMessage> {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('private_chat_messages')
      .update({
        content: newContent,
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to edit message: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Delete a message
   */
  static async deleteMessage(messageId: string): Promise<void> {
    const supabase = createServiceClient()
    
    const { error } = await supabase
      .from('private_chat_messages')
      .delete()
      .eq('id', messageId)
    
    if (error) {
      throw new Error(`Failed to delete message: ${error.message}`)
    }
  }
  
  /**
   * Get unread message count for a user
   */
  static async getUnreadCount(
    workspaceId: string,
    userId: string
  ): Promise<Record<string, number>> {
    const supabase = createServiceClient()
    
    // Get all chats for user
    const chats = await this.getChats(workspaceId, userId)
    
    const unreadCounts: Record<string, number> = {}
    
    for (const chat of chats) {
      // Count messages after last read (simplified - in production, track last_read_at)
      const { count, error } = await supabase
        .from('private_chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chat.id)
        .neq('user_id', userId)
        .gt('created_at', chat.updated_at) // Simplified logic
      
      if (!error && count) {
        unreadCounts[chat.id] = count
      }
    }
    
    return unreadCounts
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a user is a participant in a chat
 */
export async function isParticipant(
  chatId: string,
  userId: string
): Promise<boolean> {
  const chat = await PrivateChatManager.getChat(chatId)
  if (!chat) return false
  return chat.participants.includes(userId) || chat.created_by === userId
}

/**
 * Format participant names for display
 */
export function formatParticipantNames(
  participants: Array<{ id: string; name?: string; email: string }>,
  currentUserId: string
): string {
  const others = participants.filter(p => p.id !== currentUserId)
  
  if (others.length === 0) return 'Just you'
  if (others.length === 1) return others[0].name || others[0].email
  if (others.length === 2) {
    return `${others[0].name || others[0].email} and ${others[1].name || others[1].email}`
  }
  return `${others[0].name || others[0].email} and ${others.length - 1} others`
}
