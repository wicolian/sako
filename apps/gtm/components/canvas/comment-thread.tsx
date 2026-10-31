'use client'

import { useState, useRef, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  Send,
  MoreHorizontal,
  Check,
  CheckCheck,
  Trash2,
  Edit2,
  Reply,
  ThumbsUp,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Comment } from '@/lib/comments/comment-manager'
import {
  mentionsToDisplayText,
  getMentionSearchQuery,
  insertMention,
  filterMentionableUsers,
  type MentionableUser,
} from '@/lib/comments/mentions'

interface CommentThreadProps {
  comment: Comment
  currentUserId: string
  workspaceMembers: MentionableUser[]
  onReply: (content: string, parentId: string) => Promise<void>
  onEdit: (commentId: string, content: string) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
  onResolve: (commentId: string) => Promise<void>
  onUnresolve: (commentId: string) => Promise<void>
  onReact: (commentId: string, reaction: string) => Promise<void>
}

export function CommentThread({
  comment,
  currentUserId,
  workspaceMembers,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  onUnresolve,
  onReact,
}: CommentThreadProps) {
  const [isReplying, setIsReplying] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const handleReply = async () => {
    if (!replyContent.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onReply(replyContent, comment.id)
      setReplyContent('')
      setIsReplying(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = async (commentId: string) => {
    if (!editContent.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onEdit(commentId, editContent)
      setEditingId(null)
      setEditContent('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const startEditing = (c: Comment) => {
    setEditingId(c.id)
    setEditContent(c.content)
  }

  return (
    <div className={cn(
      'rounded-lg border bg-card',
      comment.resolved && 'opacity-60'
    )}>
      {/* Main Comment */}
      <div className="p-3">
        <CommentItem
          comment={comment}
          currentUserId={currentUserId}
          workspaceMembers={workspaceMembers}
          isEditing={editingId === comment.id}
          editContent={editContent}
          onEditContentChange={setEditContent}
          onStartEdit={() => startEditing(comment)}
          onCancelEdit={() => setEditingId(null)}
          onSaveEdit={() => handleEdit(comment.id)}
          onDelete={() => onDelete(comment.id)}
          onReact={(reaction) => onReact(comment.id, reaction)}
          isSubmitting={isSubmitting}
        />

        {/* Resolution Status */}
        {comment.resolved ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCheck className="h-3.5 w-3.5 text-green-500" />
            <span>Resolved</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => onUnresolve(comment.id)}
            >
              Reopen
            </Button>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setIsReplying(!isReplying)}
            >
              <Reply className="h-3.5 w-3.5 mr-1" />
              Reply
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onResolve(comment.id)}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Resolve
            </Button>
          </div>
        )}
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="border-t bg-muted/30">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="p-3 pl-8 border-b last:border-b-0">
              <CommentItem
                comment={reply}
                currentUserId={currentUserId}
                workspaceMembers={workspaceMembers}
                isEditing={editingId === reply.id}
                editContent={editContent}
                onEditContentChange={setEditContent}
                onStartEdit={() => startEditing(reply)}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={() => handleEdit(reply.id)}
                onDelete={() => onDelete(reply.id)}
                onReact={(reaction) => onReact(reply.id, reaction)}
                isSubmitting={isSubmitting}
                isReply
              />
            </div>
          ))}
        </div>
      )}

      {/* Reply Input */}
      <AnimatePresence>
        {isReplying && !comment.resolved && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t overflow-hidden"
          >
            <div className="p-3">
              <CommentInput
                value={replyContent}
                onChange={setReplyContent}
                placeholder="Write a reply..."
                workspaceMembers={workspaceMembers}
                onSubmit={handleReply}
                onCancel={() => {
                  setIsReplying(false)
                  setReplyContent('')
                }}
                isSubmitting={isSubmitting}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface CommentItemProps {
  comment: Comment
  currentUserId: string
  workspaceMembers: MentionableUser[]
  isEditing: boolean
  editContent: string
  onEditContentChange: (content: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onDelete: () => void
  onReact: (reaction: string) => void
  isSubmitting: boolean
  isReply?: boolean
}

function CommentItem({
  comment,
  currentUserId,
  workspaceMembers,
  isEditing,
  editContent,
  onEditContentChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReact,
  isSubmitting,
  isReply,
}: CommentItemProps) {
  const isOwner = comment.user_id === currentUserId
  const displayContent = mentionsToDisplayText(comment.content)
  const userInitial = comment.user?.name?.charAt(0) || comment.user?.email?.charAt(0) || 'U'

  const likeCount = comment.reactions?.filter((r) => r.reaction === 'like').length || 0
  const hasLiked = comment.reactions?.some(
    (r) => r.user_id === currentUserId && r.reaction === 'like'
  )

  if (isEditing) {
    return (
      <CommentInput
        value={editContent}
        onChange={onEditContentChange}
        placeholder="Edit your comment..."
        workspaceMembers={workspaceMembers}
        onSubmit={onSaveEdit}
        onCancel={onCancelEdit}
        isSubmitting={isSubmitting}
        submitLabel="Save"
      />
    )
  }

  return (
    <div className="flex gap-2.5">
      <Avatar className="h-7 w-7 flex-shrink-0">
        <AvatarImage src={comment.user?.avatar_url} />
        <AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {comment.user?.name || comment.user?.email?.split('@')[0] || 'User'}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onStartEdit}>
                  <Edit2 className="h-3.5 w-3.5 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">
          {displayContent}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 px-2 text-xs',
              hasLiked && 'text-primary'
            )}
            onClick={() => onReact('like')}
          >
            <ThumbsUp className={cn('h-3 w-3 mr-1', hasLiked && 'fill-current')} />
            {likeCount > 0 && likeCount}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface CommentInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  workspaceMembers: MentionableUser[]
  onSubmit: () => void
  onCancel?: () => void
  isSubmitting: boolean
  submitLabel?: string
}

export function CommentInput({
  value,
  onChange,
  placeholder = 'Write a comment...',
  workspaceMembers,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel = 'Send',
}: CommentInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionableUser[]>([])
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)

  useEffect(() => {
    if (mentionQuery !== null) {
      const filtered = filterMentionableUsers(workspaceMembers, mentionQuery)
      setMentionSuggestions(filtered.slice(0, 5))
      setSelectedMentionIndex(0)
    } else {
      setMentionSuggestions([])
    }
  }, [mentionQuery, workspaceMembers])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart
    onChange(newValue)

    // Check for mention trigger
    const query = getMentionSearchQuery(newValue, cursorPos)
    setMentionQuery(query)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMentionIndex((prev) =>
          prev < mentionSuggestions.length - 1 ? prev + 1 : 0
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMentionIndex((prev) =>
          prev > 0 ? prev - 1 : mentionSuggestions.length - 1
        )
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectMention(mentionSuggestions[selectedMentionIndex])
      } else if (e.key === 'Escape') {
        setMentionQuery(null)
      }
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSubmit()
    }
  }

  const selectMention = (user: MentionableUser) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const { newContent, newCursorPosition } = insertMention(value, cursorPos, user)
    onChange(newContent)
    setMentionQuery(null)

    // Set cursor position after mention
    setTimeout(() => {
      textarea.selectionStart = newCursorPosition
      textarea.selectionEnd = newCursorPosition
      textarea.focus()
    }, 0)
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="min-h-[60px] resize-none pr-20"
        rows={2}
      />
      <div className="absolute bottom-2 right-2 flex items-center gap-1">
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          size="sm"
          className="h-7"
          onClick={onSubmit}
          disabled={!value.trim() || isSubmitting}
        >
          <Send className="h-3.5 w-3.5 mr-1" />
          {submitLabel}
        </Button>
      </div>

      {/* Mention Suggestions */}
      <AnimatePresence>
        {mentionSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-lg shadow-lg overflow-hidden z-50"
          >
            {mentionSuggestions.map((user, index) => (
              <button
                key={user.id}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted',
                  index === selectedMentionIndex && 'bg-muted'
                )}
                onClick={() => selectMention(user)}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {user.name?.charAt(0) || user.email.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="truncate">
                  <div className="font-medium truncate">
                    {user.name || user.email.split('@')[0]}
                  </div>
                  {user.name && (
                    <div className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
