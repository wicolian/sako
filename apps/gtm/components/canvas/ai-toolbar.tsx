'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  RefreshCw,
  Expand,
  Shrink,
  Languages,
  Smile,
  FileText,
  Share2,
  Loader2,
  ChevronDown,
  Check,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type AIAction = 
  | 'rewrite'
  | 'expand'
  | 'summarize'
  | 'repurpose'
  | 'translate'
  | 'change_tone'
  | 'simplify'

interface AIToolbarProps {
  onAction: (action: AIAction, options?: Record<string, unknown>) => Promise<void>
  isProcessing?: boolean
  selectedContent?: string
  className?: string
}

const TONE_OPTIONS = [
  'Professional',
  'Casual',
  'Friendly',
  'Authoritative',
  'Playful',
  'Urgent',
  'Empathetic',
  'Bold',
]

const LANGUAGE_OPTIONS = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
]

const REPURPOSE_OPTIONS = [
  { type: 'email', label: 'Email', icon: '📧' },
  { type: 'social_post', label: 'Social Post', icon: '📱' },
  { type: 'ad_creative', label: 'Ad Copy', icon: '📢' },
  { type: 'blog_post', label: 'Blog Post', icon: '📝' },
  { type: 'video_script', label: 'Video Script', icon: '🎬' },
]

export function AIToolbar({
  onAction,
  isProcessing,
  selectedContent,
  className,
}: AIToolbarProps) {
  const [activeAction, setActiveAction] = useState<AIAction | null>(null)

  const handleAction = async (action: AIAction, options?: Record<string, unknown>) => {
    setActiveAction(action)
    try {
      await onAction(action, options)
    } finally {
      setActiveAction(null)
    }
  }

  const isDisabled = isProcessing || !selectedContent

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'flex items-center gap-1 p-1.5 bg-card border rounded-xl shadow-lg',
          className
        )}
      >
        {/* Rewrite */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => handleAction('rewrite')}
              disabled={isDisabled}
            >
              {activeAction === 'rewrite' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-1.5 text-xs">Rewrite</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Rewrite while keeping the meaning</TooltipContent>
        </Tooltip>

        {/* Expand */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => handleAction('expand')}
              disabled={isDisabled}
            >
              {activeAction === 'expand' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Expand className="h-4 w-4" />
              )}
              <span className="ml-1.5 text-xs">Expand</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add more detail and context</TooltipContent>
        </Tooltip>

        {/* Summarize */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => handleAction('summarize')}
              disabled={isDisabled}
            >
              {activeAction === 'summarize' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shrink className="h-4 w-4" />
              )}
              <span className="ml-1.5 text-xs">Summarize</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create a concise summary</TooltipContent>
        </Tooltip>

        {/* Simplify */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => handleAction('simplify')}
              disabled={isDisabled}
            >
              {activeAction === 'simplify' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              <span className="ml-1.5 text-xs">Simplify</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Make easier to understand</TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Tone Change */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              disabled={isDisabled}
            >
              {activeAction === 'change_tone' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Smile className="h-4 w-4" />
              )}
              <span className="ml-1.5 text-xs">Tone</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {TONE_OPTIONS.map((tone) => (
              <DropdownMenuItem
                key={tone}
                onClick={() => handleAction('change_tone', { tone: tone.toLowerCase() })}
              >
                {tone}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Translate */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              disabled={isDisabled}
            >
              {activeAction === 'translate' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Languages className="h-4 w-4" />
              )}
              <span className="ml-1.5 text-xs">Translate</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {LANGUAGE_OPTIONS.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => handleAction('translate', { language: lang.code, languageName: lang.name })}
              >
                {lang.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Repurpose */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              disabled={isDisabled}
            >
              {activeAction === 'repurpose' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              <span className="ml-1.5 text-xs">Repurpose</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {REPURPOSE_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.type}
                onClick={() => handleAction('repurpose', { targetType: option.type })}
              >
                <span className="mr-2">{option.icon}</span>
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-6 bg-border mx-1" />

        {/* AI Magic */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="h-8 px-3"
              disabled={isDisabled}
            >
              <Wand2 className="h-4 w-4" />
              <span className="ml-1.5 text-xs">AI Enhance</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Auto-improve content with AI</TooltipContent>
        </Tooltip>
      </motion.div>
    </TooltipProvider>
  )
}

/**
 * Floating AI toolbar that appears near selected content
 */
export function FloatingAIToolbar({
  position,
  onAction,
  isProcessing,
  selectedContent,
  onClose,
}: AIToolbarProps & {
  position: { x: number; y: number }
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        className="fixed z-50"
        style={{ left: position.x, top: position.y }}
      >
        <AIToolbar
          onAction={onAction}
          isProcessing={isProcessing}
          selectedContent={selectedContent}
        />
      </motion.div>
    </AnimatePresence>
  )
}
