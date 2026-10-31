'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bell, Loader2, MessageSquare, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Comment, CommentNotification } from '@/lib/comments/comment-manager'
import type { MentionableUser } from '@/lib/comments/mentions'
import { CommentThread } from '@/components/canvas/comment-thread'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'sonner'

type TabValue = 'inbox' | 'all'
interface WorkspaceMembershipRow {
  workspace_id: string
}

interface WorkspaceMemberRow {
  user_id: string
}

interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
}

export default function CommentsPage() {
  const [activeTab, setActiveTab] = useState<TabValue>('inbox')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [workspaceMembers, setWorkspaceMembers] = useState<MentionableUser[]>([])
  const [notifications, setNotifications] = useState<CommentNotification[]>([])
  const [workspaceComments, setWorkspaceComments] = useState<Comment[]>([])

  useEffect(() => {
    void initialize()
  }, [])

  const initialize = async () => {
    setLoading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return
      }

      setCurrentUserId(user.id)

      const { data: membership, error: membershipError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()
      const typedMembership = membership as WorkspaceMembershipRow | null

      if (membershipError || !typedMembership?.workspace_id) {
        throw membershipError || new Error('Workspace not found')
      }

      setWorkspaceId(typedMembership.workspace_id)

      const { data: memberRows } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', typedMembership.workspace_id)

      const memberIds = ((memberRows || []) as WorkspaceMemberRow[]).map((member) => member.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000'])

      setWorkspaceMembers(
        ((profiles || []) as ProfileRow[]).map((profile) => ({
          id: profile.id,
          email: profile.email || 'unknown@sako.local',
          name: profile.full_name || undefined,
          avatar_url: profile.avatar_url || undefined,
        }))
      )

      await loadCommentsData(typedMembership.workspace_id)
    } catch (error) {
      console.error('Failed to initialize comments page:', error)
      toast.error('Failed to load comments workspace')
    } finally {
      setLoading(false)
    }
  }

  const loadCommentsData = async (resolvedWorkspaceId = workspaceId) => {
    if (!resolvedWorkspaceId) {
      return
    }

    const [notificationsRes, commentsRes] = await Promise.all([
      fetch('/api/comments?type=notifications'),
      fetch(`/api/comments?workspaceId=${resolvedWorkspaceId}`),
    ])

    if (!notificationsRes.ok || !commentsRes.ok) {
      throw new Error('Failed to fetch comments')
    }

    const notificationsJson = await notificationsRes.json()
    const commentsJson = await commentsRes.json()

    setNotifications(notificationsJson.notifications || [])
    setWorkspaceComments(commentsJson.comments || [])
  }

  const refresh = async () => {
    if (!workspaceId) {
      return
    }

    setRefreshing(true)
    try {
      await loadCommentsData(workspaceId)
    } catch (error) {
      console.error('Failed to refresh comments:', error)
      toast.error('Failed to refresh comments')
    } finally {
      setRefreshing(false)
    }
  }

  const markRead = async (notificationIds: string[]) => {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'markNotificationsRead',
        notificationIds,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to mark notifications as read')
    }

    setNotifications((current) =>
      current.map((notification) =>
        notificationIds.includes(notification.id)
          ? { ...notification, read: true }
          : notification
      )
    )
  }

  const runCommentAction = async (
    input: RequestInfo,
    init?: RequestInit
  ) => {
    const response = await fetch(input, init)
    if (!response.ok) {
      throw new Error('Comment action failed')
    }
    await loadCommentsData()
  }

  const handleReply = async (comment: Comment, content: string, parentId: string) => {
    if (!workspaceId) return

    await runCommentAction('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        workspaceId,
        projectId: comment.project_id,
        assetId: comment.asset_id,
        content,
        parentId,
      }),
    })
  }

  const handleEdit = async (commentId: string, content: string) => {
    await runCommentAction('/api/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commentId,
        action: 'edit',
        content,
      }),
    })
  }

  const handleDelete = async (commentId: string) => {
    await runCommentAction(`/api/comments?commentId=${commentId}`, {
      method: 'DELETE',
    })
  }

  const handleResolve = async (commentId: string) => {
    await runCommentAction('/api/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commentId,
        action: 'resolve',
      }),
    })
  }

  const handleUnresolve = async (commentId: string) => {
    await runCommentAction('/api/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commentId,
        action: 'unresolve',
      }),
    })
  }

  const handleReact = async (commentId: string, reaction: string) => {
    await runCommentAction('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'react',
        commentId,
        reaction,
      }),
    })
  }

  const groupedComments = workspaceComments.reduce<Record<string, Comment[]>>((acc, comment) => {
    const key = comment.project?.name || 'Workspace'
    acc[key] = [...(acc[key] || []), comment]
    return acc
  }, {})

  const unreadNotifications = notifications.filter((notification) => !notification.read)

  if (loading || !currentUserId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Comments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review mentions, replies, and recent feedback across your workspace.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)} className="space-y-6">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-2">
            <Bell className="h-4 w-4" />
            Inbox
            {unreadNotifications.length > 0 ? (
              <Badge variant="secondary" className="ml-1">
                {unreadNotifications.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            All
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          {notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications"
              description="Mentions and replies will show up here as your team comments on work."
            />
          ) : (
            notifications.map((notification) => (
              <Card key={notification.id}>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base capitalize">
                        {notification.type === 'mention' ? 'Mention' : 'Reply'}
                      </CardTitle>
                      <CardDescription>
                        {new Date(notification.created_at).toLocaleString()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.read ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void markRead([notification.id])}
                        >
                          Mark read
                        </Button>
                      ) : (
                        <Badge variant="secondary">Read</Badge>
                      )}
                      {notification.comment?.project_id ? (
                        <Button asChild size="sm">
                          <Link href={`/canvas/${notification.comment.project_id}`}>Open project</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {notification.comment ? (
                    <CommentThread
                      comment={notification.comment}
                      currentUserId={currentUserId}
                      workspaceMembers={workspaceMembers}
                      onReply={(content, parentId) => handleReply(notification.comment!, content, parentId)}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onResolve={handleResolve}
                      onUnresolve={handleUnresolve}
                      onReact={handleReact}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      The linked comment is no longer available.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-6">
          {workspaceComments.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No workspace comments yet"
              description="Comments left on project assets will appear here for the full team."
            />
          ) : (
            Object.entries(groupedComments).map(([groupName, comments]) => (
              <section key={groupName} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium">{groupName}</h2>
                    <p className="text-sm text-muted-foreground">
                      {comments.length} recent {comments.length === 1 ? 'thread' : 'threads'}
                    </p>
                  </div>
                  {comments[0]?.project_id ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/canvas/${comments[0].project_id}`}>Open project</Link>
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-4">
                  {comments.map((comment) => (
                    <CommentThread
                      key={comment.id}
                      comment={comment}
                      currentUserId={currentUserId}
                      workspaceMembers={workspaceMembers}
                      onReply={(content, parentId) => handleReply(comment, content, parentId)}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onResolve={handleResolve}
                      onUnresolve={handleUnresolve}
                      onReact={handleReact}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
