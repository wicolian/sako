/**
 * Comment Manager
 * 
 * CRUD operations for canvas asset comments with threading support.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { sendCommentMentionEmail } from '@/lib/email'

export interface Comment {
  id: string
  workspace_id: string
  project_id: string
  asset_id: string
  parent_id: string | null
  user_id: string
  content: string
  mentions: string[]
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  position: { x: number; y: number } | null
  created_at: string
  updated_at: string
  // Joined fields
  user?: {
    id: string
    email: string
    name?: string
    avatar_url?: string
  }
  project?: {
    id: string
    name: string
    color?: string | null
    icon?: string | null
  }
  replies?: Comment[]
  reactions?: CommentReaction[]
}

export interface CommentReaction {
  id: string
  comment_id: string
  user_id: string
  reaction: string
  created_at: string
}

interface CommentRow {
  id: string
  workspace_id: string
  project_id: string
  asset_id: string
  parent_id: string | null
  user_id: string
  content: string
  mentions: string[]
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  position: { x: number; y: number } | null
  created_at: string
  updated_at: string
  replies?: CommentRow[]
  reactions?: CommentReaction[]
}

export interface CommentNotification {
  id: string
  comment_id: string
  type: string
  read: boolean
  created_at: string
  comment?: Comment
}

export interface CreateCommentInput {
  workspace_id: string
  project_id: string
  asset_id: string
  user_id: string
  content: string
  parent_id?: string
  mentions?: string[]
  position?: { x: number; y: number }
}

export interface UpdateCommentInput {
  content?: string
  mentions?: string[]
  resolved?: boolean
  resolved_by?: string
}

/**
 * Create a new comment
 */
export async function createComment(input: CreateCommentInput): Promise<Comment> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('asset_comments')
    .insert({
      workspace_id: input.workspace_id,
      project_id: input.project_id,
      asset_id: input.asset_id,
      user_id: input.user_id,
      content: input.content,
      parent_id: input.parent_id || null,
      mentions: input.mentions || [],
      position: input.position || null,
    })
    .select()
    .single()

  if (error) throw error

  // Create notifications for mentioned users
  if (input.mentions && input.mentions.length > 0) {
    await createMentionNotifications(data.id, input.mentions)
  }

  // Create reply notification if this is a reply
  if (input.parent_id) {
    await createReplyNotification(data.id, input.parent_id)
  }

  return data as Comment
}

/**
 * Get comments for an asset
 */
export async function getAssetComments(
  projectId: string,
  assetId: string
): Promise<Comment[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('asset_comments')
    .select(`
      *,
      replies:asset_comments!parent_id(
        *
      ),
      reactions:comment_reactions(*)
    `)
    .eq('project_id', projectId)
    .eq('asset_id', assetId)
    .is('parent_id', null) // Only top-level comments
    .order('created_at', { ascending: true })

  if (error) throw error

  return hydrateComments((data || []) as CommentRow[])
}

/**
 * Get all comments for a project
 */
export async function getProjectComments(projectId: string): Promise<Comment[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('asset_comments')
    .select(`
      *,
      replies:asset_comments!parent_id(
        *
      ),
      reactions:comment_reactions(*)
    `)
    .eq('project_id', projectId)
    .is('parent_id', null)
    .order('created_at', { ascending: false })

  if (error) throw error

  return hydrateComments((data || []) as CommentRow[])
}

/**
 * Get recent comments across a workspace
 */
export async function getWorkspaceComments(workspaceId: string): Promise<Comment[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('asset_comments')
    .select(`
      *,
      replies:asset_comments!parent_id(
        *
      ),
      reactions:comment_reactions(*)
    `)
    .eq('workspace_id', workspaceId)
    .is('parent_id', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  return hydrateComments((data || []) as CommentRow[])
}

/**
 * Get unresolved comments count
 */
export async function getUnresolvedCount(projectId: string): Promise<number> {
  const supabase = createServiceClient()

  const { count, error } = await supabase
    .from('asset_comments')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('resolved', false)
    .is('parent_id', null)

  if (error) throw error

  return count || 0
}

/**
 * Update a comment
 */
export async function updateComment(
  commentId: string,
  input: UpdateCommentInput
): Promise<Comment> {
  const supabase = createServiceClient()

  const updateData: Record<string, unknown> = {}

  if (input.content !== undefined) {
    updateData.content = input.content
  }

  if (input.mentions !== undefined) {
    updateData.mentions = input.mentions
  }

  if (input.resolved !== undefined) {
    updateData.resolved = input.resolved
    if (input.resolved && input.resolved_by) {
      updateData.resolved_by = input.resolved_by
      updateData.resolved_at = new Date().toISOString()
    } else if (!input.resolved) {
      updateData.resolved_by = null
      updateData.resolved_at = null
    }
  }

  const { data, error } = await supabase
    .from('asset_comments')
    .update(updateData)
    .eq('id', commentId)
    .select()
    .single()

  if (error) throw error

  return data as Comment
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('asset_comments')
    .delete()
    .eq('id', commentId)

  if (error) throw error
}

/**
 * Resolve a comment thread
 */
export async function resolveComment(
  commentId: string,
  userId: string
): Promise<Comment> {
  return updateComment(commentId, {
    resolved: true,
    resolved_by: userId,
  })
}

/**
 * Unresolve a comment thread
 */
export async function unresolveComment(commentId: string): Promise<Comment> {
  return updateComment(commentId, {
    resolved: false,
  })
}

/**
 * Add a reaction to a comment
 */
export async function addReaction(
  commentId: string,
  userId: string,
  reaction: string
): Promise<CommentReaction> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('comment_reactions')
    .upsert(
      {
        comment_id: commentId,
        user_id: userId,
        reaction,
      },
      { onConflict: 'comment_id,user_id,reaction' }
    )
    .select()
    .single()

  if (error) throw error

  return data as CommentReaction
}

/**
 * Remove a reaction from a comment
 */
export async function removeReaction(
  commentId: string,
  userId: string,
  reaction: string
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('comment_reactions')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .eq('reaction', reaction)

  if (error) throw error
}

/**
 * Get user's notifications
 */
export async function getUserNotifications(
  userId: string,
  unreadOnly = false
): Promise<CommentNotification[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('comment_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (unreadOnly) {
    query = query.eq('read', false)
  }

  const { data, error } = await query

  if (error) throw error

  const notifications = (data || []) as CommentNotification[]
  if (notifications.length === 0) {
    return notifications
  }

  const commentIds = notifications.map((notification) => notification.comment_id)
  const { data: commentRows, error: commentsError } = await supabase
    .from('asset_comments')
    .select(`
      *,
      reactions:comment_reactions(*)
    `)
    .in('id', commentIds)

  if (commentsError) throw commentsError

  const commentMap = new Map(
    (
      await hydrateComments((commentRows || []) as CommentRow[])
    ).map((comment) => [comment.id, comment])
  )

  return notifications.map((notification) => ({
    ...notification,
    comment: commentMap.get(notification.comment_id),
  }))
}

/**
 * Mark notifications as read
 */
export async function markNotificationsRead(
  userId: string,
  notificationIds?: string[]
): Promise<void> {
  const supabase = createServiceClient()

  let query = supabase
    .from('comment_notifications')
    .update({ read: true })
    .eq('user_id', userId)

  if (notificationIds && notificationIds.length > 0) {
    query = query.in('id', notificationIds)
  }

  const { error } = await query

  if (error) throw error
}

// Internal helper functions

async function createMentionNotifications(
  commentId: string,
  mentionedUserIds: string[]
): Promise<void> {
  const supabase = createServiceClient()

  const notifications = mentionedUserIds.map((userId) => ({
    comment_id: commentId,
    user_id: userId,
    type: 'mention',
  }))

  await supabase.from('comment_notifications').insert(notifications)
  await Promise.all(
    mentionedUserIds.map((userId) =>
      sendCommentNotificationEmail(commentId, userId, 'mention')
    )
  )
}

async function createReplyNotification(
  replyId: string,
  parentId: string
): Promise<void> {
  const supabase = createServiceClient()

  // Get the parent comment's author
  const { data: parentComment } = await supabase
    .from('asset_comments')
    .select('user_id')
    .eq('id', parentId)
    .single()

  if (parentComment) {
    await supabase.from('comment_notifications').insert({
      comment_id: replyId,
      user_id: parentComment.user_id,
      type: 'reply',
    })

    await sendCommentNotificationEmail(replyId, parentComment.user_id, 'reply')
  }
}

async function hydrateComments(comments: CommentRow[]): Promise<Comment[]> {
  if (comments.length === 0) {
    return []
  }

  const supabase = createServiceClient()
  const allComments = comments.flatMap((comment) => [comment, ...(comment.replies || [])])
  const userIds = [...new Set(allComments.map((comment) => comment.user_id))]
  const projectIds = [...new Set(allComments.map((comment) => comment.project_id))]

  const [{ data: profiles }, { data: projects }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .in('id', userIds),
    supabase
      .from('projects')
      .select('id, name, color, icon')
      .in('id', projectIds),
  ])

  const userMap = new Map(
    (profiles || []).map((profile) => [
      profile.id,
      {
        id: profile.id,
        email: profile.email || 'unknown@sako.local',
        name: profile.full_name || undefined,
        avatar_url: profile.avatar_url || undefined,
      },
    ])
  )

  const projectMap = new Map(
    (projects || []).map((project) => [
      project.id,
      {
        id: project.id,
        name: project.name,
        color: project.color,
        icon: project.icon,
      },
    ])
  )

  const decorateComment = (comment: CommentRow): Comment => ({
    ...comment,
    user: userMap.get(comment.user_id),
    project: projectMap.get(comment.project_id),
    replies: (comment.replies || []).map((reply) => ({
      ...reply,
      user: userMap.get(reply.user_id),
      project: projectMap.get(reply.project_id),
      replies: [],
    })),
  })

  return comments.map(decorateComment)
}

async function sendCommentNotificationEmail(
  commentId: string,
  recipientUserId: string,
  notificationType: 'mention' | 'reply'
): Promise<void> {
  const supabase = createServiceClient()

  const { data: comment } = await supabase
    .from('asset_comments')
    .select('id, content, project_id, user_id')
    .eq('id', commentId)
    .single()

  if (!comment || comment.user_id === recipientUserId) {
    return
  }

  const [{ data: recipient }, { data: author }, { data: project }] = await Promise.all([
    supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', recipientUserId)
      .single(),
    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', comment.user_id)
      .single(),
    supabase
      .from('projects')
      .select('id, name')
      .eq('id', comment.project_id)
      .single(),
  ])

  if (!recipient?.email || !project?.id) {
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  await sendCommentMentionEmail({
    to: recipient.email,
    recipientName: recipient.full_name || undefined,
    authorName: author?.full_name || author?.email || 'A teammate',
    commentText: comment.content,
    projectName: project.name,
    projectUrl: `${appUrl}/canvas/${project.id}`,
    notificationType,
  })
}
