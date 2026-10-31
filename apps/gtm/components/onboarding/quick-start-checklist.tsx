'use client'

/**
 * Quick Start Checklist Component
 * 
 * Gamified onboarding checklist to guide new users through essential setup steps.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  Trophy,
  Gift,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface ChecklistItem {
  id: string
  title: string
  description: string
  href?: string
  action?: () => void
  isComplete?: boolean
  estimatedMinutes?: number
  reward?: string
}

interface QuickStartChecklistProps {
  items: ChecklistItem[]
  onItemComplete?: (itemId: string) => void
  onAllComplete?: () => void
  storageKey?: string
  title?: string
  className?: string
}

export function QuickStartChecklist({
  items,
  onItemComplete,
  onAllComplete,
  storageKey = 'quick-start-checklist',
  title = 'Quick Start',
  className,
}: QuickStartChecklistProps) {
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set())
  const [isExpanded, setIsExpanded] = useState(true)
  const [isDismissed, setIsDismissed] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)

  // Load completed state from storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          const data = JSON.parse(stored)
          setCompletedItems(new Set(data.completed || []))
          setIsDismissed(data.dismissed || false)
        } catch (e) {
          // Invalid JSON, ignore
        }
      }
    }
  }, [storageKey])

  // Save state to storage
  const saveState = useCallback((completed: string[], dismissed: boolean) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ completed, dismissed })
      )
    }
  }, [storageKey])

  // Mark item as complete
  const markComplete = useCallback((itemId: string) => {
    setCompletedItems((prev) => {
      const next = new Set(prev)
      next.add(itemId)
      saveState(Array.from(next), isDismissed)
      
      // Check if all complete
      if (next.size === items.length) {
        setShowCelebration(true)
        setTimeout(() => setShowCelebration(false), 3000)
        onAllComplete?.()
      }
      
      return next
    })
    onItemComplete?.(itemId)
  }, [items.length, isDismissed, saveState, onItemComplete, onAllComplete])

  // Dismiss checklist
  const handleDismiss = useCallback(() => {
    setIsDismissed(true)
    saveState(Array.from(completedItems), true)
  }, [completedItems, saveState])

  // Calculate progress
  const progress = (completedItems.size / items.length) * 100
  const remainingItems = items.filter((item) => !completedItems.has(item.id))
  const completedCount = completedItems.size

  if (isDismissed) return null

  return (
    <div className={cn('relative', className)}>
      {/* Celebration overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-card/95 rounded-lg"
          >
            <div className="text-center p-6">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
              >
                <Trophy className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
              </motion.div>
              <h3 className="text-xl font-bold mb-2">All Done!</h3>
              <p className="text-muted-foreground mb-4">
                You've completed the quick start guide.
              </p>
              <Button onClick={handleDismiss}>
                <Gift className="w-4 h-4 mr-2" />
                Claim Your Reward
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main card */}
      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground">
                {completedCount} of {items.length} complete
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24">
              <Progress value={progress} className="h-2" />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation()
                handleDismiss()
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Items list */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t"
            >
              <div className="p-2">
                {items.map((item, index) => {
                  const isComplete = completedItems.has(item.id) || item.isComplete

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg transition-colors',
                        isComplete
                          ? 'bg-muted/30'
                          : 'hover:bg-muted/50 cursor-pointer'
                      )}
                      onClick={() => {
                        if (!isComplete) {
                          if (item.action) {
                            item.action()
                          }
                          if (!item.href) {
                            markComplete(item.id)
                          }
                        }
                      }}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {isComplete ? (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground/50" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn(
                              'text-sm font-medium',
                              isComplete && 'text-muted-foreground line-through'
                            )}
                          >
                            {item.title}
                          </span>
                          {item.estimatedMinutes && !isComplete && (
                            <Badge variant="secondary" className="text-[10px]">
                              ~{item.estimatedMinutes} min
                            </Badge>
                          )}
                          {item.reward && !isComplete && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-yellow-500/50 text-amber-500"
                            >
                              <Gift className="w-3 h-3 mr-1" />
                              {item.reward}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>

                      {!isComplete && item.href && (
                        <Link href={item.href}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              markComplete(item.id)
                            }}
                          >
                            Go
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * Default checklist items for new users
 */
export const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'create-brand',
    title: 'Set up your brand',
    description: 'Add your brand colors, voice, and guidelines for consistent content.',
    href: '/settings/brands',
    estimatedMinutes: 3,
  },
  {
    id: 'add-claim',
    title: 'Add your first claim',
    description: 'Create a marketing claim and link it to evidence for compliance.',
    href: '/claims',
    estimatedMinutes: 2,
  },
  {
    id: 'create-campaign',
    title: 'Create a campaign',
    description: 'Build your first marketing campaign with AI-powered content generation.',
    href: '/campaigns',
    estimatedMinutes: 5,
    reward: '+10 credits',
  },
  {
    id: 'connect-integration',
    title: 'Connect an integration',
    description: 'Link your marketing tools for seamless publishing.',
    href: '/settings/integrations',
    estimatedMinutes: 2,
  },
  {
    id: 'invite-team',
    title: 'Invite your team',
    description: 'Add team members to collaborate on campaigns and approvals.',
    href: '/settings/team',
    estimatedMinutes: 1,
  },
  {
    id: 'explore-studio',
    title: 'Build a Studio app',
    description: 'Create a custom AI app tailored to your workflow.',
    href: '/studio',
    estimatedMinutes: 5,
    reward: '+20 credits',
  },
]

/**
 * Hook to manage checklist state programmatically
 */
export function useQuickStartChecklist(storageKey = 'quick-start-checklist') {
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          const data = JSON.parse(stored)
          setCompletedItems(new Set(data.completed || []))
        } catch (e) {
          // Invalid JSON, ignore
        }
      }
    }
  }, [storageKey])

  const markComplete = useCallback((itemId: string) => {
    setCompletedItems((prev) => {
      const next = new Set(prev)
      next.add(itemId)
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(storageKey)
        const data = stored ? JSON.parse(stored) : {}
        localStorage.setItem(
          storageKey,
          JSON.stringify({ ...data, completed: Array.from(next) })
        )
      }
      return next
    })
  }, [storageKey])

  const isComplete = useCallback((itemId: string) => {
    return completedItems.has(itemId)
  }, [completedItems])

  const reset = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey)
    }
    setCompletedItems(new Set())
  }, [storageKey])

  return { completedItems, markComplete, isComplete, reset }
}
