/**
 * Comments API
 * 
 * CRUD operations for canvas asset comments.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createComment,
  getAssetComments,
  getProjectComments,
  updateComment,
  deleteComment,
  resolveComment,
  unresolveComment,
  addReaction,
  removeReaction,
  getUserNotifications,
  markNotificationsRead,
} from '@/lib/comments/comment-manager'
import { extractMentionIds } from '@/lib/comments/mentions'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const assetId = searchParams.get('assetId')
    const type = searchParams.get('type') // 'comments' | 'notifications'

    if (type === 'notifications') {
      const unreadOnly = searchParams.get('unreadOnly') === 'true'
      const notifications = await getUserNotifications(user.id, unreadOnly)
      return NextResponse.json({ notifications })
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    if (assetId) {
      const comments = await getAssetComments(projectId, assetId)
      return NextResponse.json({ comments })
    } else {
      const comments = await getProjectComments(projectId)
      return NextResponse.json({ comments })
    }
  } catch (error) {
    console.error('GET /api/comments error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    // Handle different actions
    switch (action) {
      case 'create': {
        const { workspaceId, projectId, assetId, content, parentId, position } = body

        if (!workspaceId || !projectId || !assetId || !content) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          )
        }

        // Extract mentions from content
        const mentions = extractMentionIds(content)

        const comment = await createComment({
          workspace_id: workspaceId,
          project_id: projectId,
          asset_id: assetId,
          user_id: user.id,
          content,
          parent_id: parentId,
          mentions,
          position,
        })

        return NextResponse.json({ comment })
      }

      case 'react': {
        const { commentId, reaction, remove } = body

        if (!commentId || !reaction) {
          return NextResponse.json(
            { error: 'commentId and reaction are required' },
            { status: 400 }
          )
        }

        if (remove) {
          await removeReaction(commentId, user.id, reaction)
          return NextResponse.json({ success: true })
        } else {
          const reactionData = await addReaction(commentId, user.id, reaction)
          return NextResponse.json({ reaction: reactionData })
        }
      }

      case 'markNotificationsRead': {
        const { notificationIds } = body
        await markNotificationsRead(user.id, notificationIds)
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('POST /api/comments error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { commentId, action, content } = body

    if (!commentId) {
      return NextResponse.json(
        { error: 'commentId is required' },
        { status: 400 }
      )
    }

    let comment

    switch (action) {
      case 'resolve':
        comment = await resolveComment(commentId, user.id)
        break

      case 'unresolve':
        comment = await unresolveComment(commentId)
        break

      case 'edit':
        if (!content) {
          return NextResponse.json(
            { error: 'content is required for edit' },
            { status: 400 }
          )
        }
        const mentions = extractMentionIds(content)
        comment = await updateComment(commentId, { content, mentions })
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    return NextResponse.json({ comment })
  } catch (error) {
    console.error('PATCH /api/comments error:', error)
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('commentId')

    if (!commentId) {
      return NextResponse.json(
        { error: 'commentId is required' },
        { status: 400 }
      )
    }

    await deleteComment(commentId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/comments error:', error)
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    )
  }
}
