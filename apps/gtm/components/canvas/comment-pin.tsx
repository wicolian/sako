'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Plus, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { Comment } from '@/lib/comments/comment-manager'

interface CommentPinProps {
  comment?: Comment
  position: { x: number; y: number }
  isNew?: boolean
  isSelected?: boolean
  hasReplies?: boolean
  onClick?: () => void
  onCreateComment?: (content: string) => void
  onCancel?: () => void
}

export function CommentPin({
  comment,
  position,
  isNew,
  isSelected,
  hasReplies,
  onClick,
  onCreateComment,
  onCancel,
}: CommentPinProps) {
  const [newContent, setNewContent] = useState('')
  const [isHovered, setIsHovered] = useState(false)

  const handleSubmit = () => {
    if (!newContent.trim()) return
    onCreateComment?.(newContent.trim())
    setNewContent('')
  }

  const isResolved = comment?.resolved
  const replyCount = comment?.replies?.length || 0

  return (
    <div
      className="absolute pointer-events-auto"
      style={{ left: position.x, top: position.y, transform: 'translate(-12px, -12px)' }}
    >
      {/* Pin Icon */}
      {!isNew && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'relative h-6 w-6 rounded-full flex items-center justify-center shadow-lg transition-colors',
            isResolved
              ? 'bg-green-500 text-white'
              : isSelected
              ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
              : 'bg-amber-500 text-white hover:bg-amber-600'
          )}
          onClick={onClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isResolved ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <MessageSquare className="h-3.5 w-3.5" />
          )}

          {/* Reply count badge */}
          {replyCount > 0 && !isResolved && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center">
              {replyCount}
            </span>
          )}
        </motion.button>
      )}

      {/* Preview tooltip on hover */}
      <AnimatePresence>
        {isHovered && comment && !isSelected && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute top-8 left-0 z-50 w-48 p-2 bg-card border rounded-lg shadow-xl"
          >
            <p className="text-xs font-medium truncate">{comment.user?.name || comment.user?.email || 'Unknown'}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {comment.content}
            </p>
            {replyCount > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Comment Form */}
      {isNew && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-0 left-6 z-50 w-64 bg-card border rounded-xl shadow-xl overflow-hidden"
        >
          <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">New Comment</span>
          </div>
          <div className="p-3 space-y-3">
            <Textarea
              placeholder="Add a comment..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="min-h-[80px] text-sm"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={!newContent.trim()}>
                Comment
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
