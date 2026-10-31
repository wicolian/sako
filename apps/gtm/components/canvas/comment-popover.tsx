'use client'

import { useState } from 'react'
import { MessageSquare, X, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Comment } from '@/lib/comments/comment-manager'
import { MentionableUser } from '@/lib/comments/mentions'
import { CommentThread, CommentInput } from './comment-thread'

interface CommentPopoverProps {
  assetId: string
  assetName: string
  comments: Comment[]
  currentUserId: string
  workspaceMembers: MentionableUser[]
  onCreateComment: (content: string) => Promise<void>
  onReply: (content: string, parentId: string) => Promise<void>
  onEdit: (commentId: string, content: string) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
  onResolve: (commentId: string) => Promise<void>
  onUnresolve: (commentId: string) => Promise<void>
  onReact: (commentId: string, reaction: string) => Promise<void>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  position?: { x: number; y: number }
}

export function CommentPopover({
  assetId,
  assetName,
  comments,
  currentUserId,
  workspaceMembers,
  onCreateComment,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  onUnresolve,
  onReact,
  isOpen,
  onOpenChange,
  position,
}: CommentPopoverProps) {
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResolved, setShowResolved] = useState(false)

  const unresolvedComments = comments.filter((c) => !c.resolved)
  const resolvedComments = comments.filter((c) => c.resolved)

  const handleSubmit = async () => {
    if (!newComment.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onCreateComment(newComment)
      setNewComment('')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className={cn(
        'fixed z-50 w-[360px] bg-popover border rounded-lg shadow-xl',
        position ? '' : 'right-4 top-20'
      )}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Comments</span>
          {unresolvedComments.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {unresolvedComments.length}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Comment List */}
      <ScrollArea className="max-h-[400px]">
        <div className="p-3 space-y-3">
          {/* New Comment Input */}
          <CommentInput
            value={newComment}
            onChange={setNewComment}
            placeholder={`Comment on "${assetName}"...`}
            workspaceMembers={workspaceMembers}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />

          {/* Unresolved Comments */}
          {unresolvedComments.length === 0 && resolvedComments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No comments yet</p>
              <p className="text-xs mt-1">Be the first to leave feedback</p>
            </div>
          ) : (
            <>
              {unresolvedComments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  workspaceMembers={workspaceMembers}
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onResolve={onResolve}
                  onUnresolve={onUnresolve}
                  onReact={onReact}
                />
              ))}

              {/* Resolved Comments Toggle */}
              {resolvedComments.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowResolved(!showResolved)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                  >
                    {showResolved ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    {resolvedComments.length} resolved comment
                    {resolvedComments.length !== 1 && 's'}
                  </button>

                  <AnimatePresence>
                    {showResolved && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-3 mt-3 overflow-hidden"
                      >
                        {resolvedComments.map((comment) => (
                          <CommentThread
                            key={comment.id}
                            comment={comment}
                            currentUserId={currentUserId}
                            workspaceMembers={workspaceMembers}
                            onReply={onReply}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onResolve={onResolve}
                            onUnresolve={onUnresolve}
                            onReact={onReact}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </motion.div>
  )
}

/**
 * Comment marker badge shown on assets
 */
interface CommentMarkerProps {
  count: number
  hasUnresolved: boolean
  onClick: () => void
}

export function CommentMarker({ count, hasUnresolved, onClick }: CommentMarkerProps) {
  if (count === 0) return null

  return (
    <button
      onClick={onClick}
      className={cn(
        'absolute -top-2 -right-2 flex items-center justify-center',
        'min-w-[20px] h-5 px-1 rounded-full text-xs font-medium',
        'transition-transform hover:scale-110',
        hasUnresolved
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground'
      )}
    >
      <MessageSquare className="h-3 w-3 mr-0.5" />
      {count}
    </button>
  )
}
