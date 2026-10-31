'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { motion } from 'framer-motion'
import {
  FileText,
  Mail,
  Share2,
  Image,
  Video,
  Presentation,
  MoreHorizontal,
  Copy,
  Trash2,
  Edit3,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface AssetNodeData extends Record<string, unknown> {
  id: string
  name: string
  type: 'landing_page' | 'email' | 'social_post' | 'ad_creative' | 'video_script' | 'sales_deck'
  status: 'draft' | 'review' | 'approved' | 'published'
  content?: Record<string, unknown>
  isSelected?: boolean
  commentCount?: number
  hasUnresolvedComments?: boolean
  onSelect?: () => void
  onEdit?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  onRegenerate?: () => void
  onOpenComments?: () => void
}

const ASSET_CONFIG = {
  landing_page: {
    icon: FileText,
    label: 'Landing Page',
    gradient: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  email: {
    icon: Mail,
    label: 'Email',
    gradient: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  social_post: {
    icon: Share2,
    label: 'Social Post',
    gradient: 'from-pink-500 to-rose-500',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
  },
  ad_creative: {
    icon: Image,
    label: 'Ad Creative',
    gradient: 'from-purple-500 to-violet-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  video_script: {
    icon: Video,
    label: 'Video Script',
    gradient: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  sales_deck: {
    icon: Presentation,
    label: 'Sales Deck',
    gradient: 'from-indigo-500 to-blue-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
  },
}

const STATUS_CONFIG = {
  draft: {
    icon: Edit3,
    label: 'Draft',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  review: {
    icon: Clock,
    label: 'In Review',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  approved: {
    icon: CheckCircle2,
    label: 'Approved',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  published: {
    icon: Send,
    label: 'Published',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
}

interface AssetNodeProps {
  data: AssetNodeData
  selected?: boolean
}

function AssetNodeComponent({ data, selected }: AssetNodeProps) {
  const config = ASSET_CONFIG[data.type]
  const statusConfig = STATUS_CONFIG[data.status]
  const Icon = config.icon
  const StatusIcon = statusConfig.icon

  return (
    <>
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'w-[280px] rounded-xl border-2 bg-card shadow-lg transition-all',
          selected ? 'border-primary ring-2 ring-primary/20' : config.borderColor,
          'hover:shadow-xl'
        )}
      >
        {/* Header */}
        <div className={cn('p-3 rounded-t-xl border-b', config.bgColor)}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br',
                  config.gradient
                )}
              >
                <Icon className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{config.label}</p>
                <p className="font-medium text-sm line-clamp-1">{data.name}</p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={data.onEdit}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={data.onRegenerate}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Regenerate with AI
                </DropdownMenuItem>
                <DropdownMenuItem onClick={data.onDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={data.onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content Preview */}
        <div className="p-3">
          {data.content?.headline ? (
            <div className="space-y-1">
              <p className="text-sm font-medium line-clamp-2">
                {String(data.content.headline)}
              </p>
              {data.content.subheadline ? (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {String(data.content.subheadline)}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs">Click to generate content</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 pb-3 flex items-center justify-between">
          <Badge
            variant="secondary"
            className={cn('text-[10px]', statusConfig.bgColor, statusConfig.color)}
          >
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>

          {/* Comment indicator */}
          {(data.commentCount ?? 0) > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-6 px-1.5 text-xs',
                data.hasUnresolvedComments ? 'text-primary' : 'text-muted-foreground'
              )}
              onClick={data.onOpenComments}
            >
              <MessageSquare className={cn('h-3 w-3 mr-1', data.hasUnresolvedComments && 'fill-primary/20')} />
              {data.commentCount}
            </Button>
          )}
          
          {selected && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={data.onOpenComments}
                title="Comments"
              >
                <MessageSquare className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={data.onRegenerate}
              >
                <Sparkles className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={data.onEdit}
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
    </>
  )
}

export const AssetNode = memo(AssetNodeComponent)
