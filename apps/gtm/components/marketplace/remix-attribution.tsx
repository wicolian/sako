'use client'

/**
 * Remix Attribution Component
 * 
 * Display "Remixed from" attribution and remix chain for templates.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  GitFork,
  ChevronRight,
  User,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { RemixInfo } from '@/lib/templates/remix-tracker'

interface RemixAttributionProps {
  templateId: string
  originalTemplateId?: string | null
  remixCount?: number
  compact?: boolean
}

export function RemixAttribution({
  templateId,
  originalTemplateId,
  remixCount = 0,
  compact = false,
}: RemixAttributionProps) {
  const [remixChain, setRemixChain] = useState<RemixInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Fetch remix chain on hover/expand
  const fetchRemixChain = async () => {
    if (remixChain.length > 0 || !originalTemplateId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/marketplace/remix-chain?templateId=${templateId}`)
      if (response.ok) {
        const data = await response.json()
        setRemixChain(data.chain || [])
      }
    } catch (error) {
      console.error('Failed to fetch remix chain:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!originalTemplateId && remixCount === 0) {
    return null
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <GitFork className="h-3 w-3" />
              {originalTemplateId && <span>Remix</span>}
              {remixCount > 0 && <span>{remixCount} remixes</span>}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {originalTemplateId
              ? 'This template is a remix'
              : `${remixCount} templates remixed from this`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="space-y-2">
      {/* Remix Attribution Badge */}
      {originalTemplateId && (
        <Popover onOpenChange={(open) => open && fetchRemixChain()}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors">
              <GitFork className="h-4 w-4" />
              <span>Remixed from original</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b">
              <h4 className="font-medium text-sm">Remix Attribution</h4>
              <p className="text-xs text-muted-foreground mt-1">
                This template was created based on existing work
              </p>
            </div>
            <div className="p-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : remixChain.length > 0 ? (
                <RemixChainView chain={remixChain} />
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Unable to load attribution chain
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Remix Count */}
      {remixCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>
            <strong className="text-foreground">{remixCount}</strong>{' '}
            {remixCount === 1 ? 'remix' : 'remixes'} created from this template
          </span>
        </div>
      )}
    </div>
  )
}

interface RemixChainViewProps {
  chain: RemixInfo[]
}

function RemixChainView({ chain }: RemixChainViewProps) {
  return (
    <div className="space-y-2">
      {chain.map((item, index) => (
        <motion.div
          key={item.original_template_id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className={cn(
            'flex items-center gap-3 p-2 rounded-lg',
            'bg-muted/50 hover:bg-muted transition-colors'
          )}
          style={{ marginLeft: `${index * 12}px` }}
        >
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={`/marketplace/template/${item.original_template_id}`}
              className="font-medium text-sm truncate hover:underline flex items-center gap-1"
            >
              {item.original_template_name}
              <ExternalLink className="h-3 w-3" />
            </Link>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{item.original_creator_name || 'Creator'}</span>
              {item.remix_count > 0 && (
                <>
                  <span>•</span>
                  <span>{item.remix_count} remixes</span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      ))}
      {chain.length > 0 && (
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <ChevronRight className="h-3 w-3" />
          <span>Your template</span>
        </div>
      )}
    </div>
  )
}

/**
 * Remix button for template cards
 */
interface RemixButtonProps {
  templateId: string
  templateName: string
  onRemix: () => void
  disabled?: boolean
}

export function RemixButton({
  templateId,
  templateName,
  onRemix,
  disabled,
}: RemixButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onRemix}
            disabled={disabled}
            className="gap-2"
          >
            <GitFork className="h-4 w-4" />
            Remix
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Create your own version of "{templateName}"</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Badge showing template is a remix
 */
interface RemixBadgeProps {
  originalName?: string
  className?: string
}

export function RemixBadge({ originalName, className }: RemixBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'gap-1 bg-primary/10 text-primary hover:bg-primary/20',
        className
      )}
    >
      <GitFork className="h-3 w-3" />
      {originalName ? `Remix of ${originalName}` : 'Remix'}
    </Badge>
  )
}
