'use client'

/**
 * Suggested Responses Component
 * 
 * Provides AI-generated suggestions for input fields in Studio apps.
 * Features:
 * - Auto-generate examples for any input type
 * - Click to fill functionality
 * - Refresh for new suggestions
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { AppInput } from '@/lib/studio/types'

interface SuggestedResponsesProps {
  input: AppInput
  context?: string
  onSelect: (value: string) => void
  className?: string
}

export function SuggestedResponses({
  input,
  context,
  onSelect,
  className,
}: SuggestedResponsesProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/studio/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          context,
          count: 5,
        }),
      })
      
      if (!res.ok) throw new Error('Failed to generate suggestions')
      const data = await res.json()
      return data.suggestions as string[]
    },
    onSuccess: (data) => {
      setSuggestions(data)
      setIsOpen(true)
    },
  })
  
  const handleGenerate = () => {
    if (suggestions.length > 0) {
      setIsOpen(!isOpen)
    } else {
      generateMutation.mutate()
    }
  }
  
  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation()
    generateMutation.mutate()
  }
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3 mr-1" />
          )}
          {suggestions.length > 0 ? (
            <>
              {isOpen ? 'Hide' : 'Show'} suggestions
              {isOpen ? (
                <ChevronUp className="h-3 w-3 ml-1" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-1" />
              )}
            </>
          ) : (
            'Get AI suggestions'
          )}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2">
        {generateMutation.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-5/6" />
          </div>
        ) : suggestions.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Click to use a suggestion
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleRefresh}
                disabled={generateMutation.isPending}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-primary hover:text-primary-foreground',
                    'max-w-full truncate'
                  )}
                  onClick={() => onSelect(suggestion)}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * Inline Suggestions Component
 * 
 * Shows suggestions directly under an input without collapsible.
 */
interface InlineSuggestionsProps {
  suggestions: string[]
  onSelect: (value: string) => void
  isLoading?: boolean
  onRefresh?: () => void
}

export function InlineSuggestions({
  suggestions,
  onSelect,
  isLoading,
  onRefresh,
}: InlineSuggestionsProps) {
  if (isLoading) {
    return (
      <div className="flex gap-2 mt-1">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-16" />
      </div>
    )
  }
  
  if (suggestions.length === 0) {
    return null
  }
  
  return (
    <div className="mt-1">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Suggestions:</span>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={onRefresh}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            type="button"
            className={cn(
              'px-2 py-0.5 text-xs rounded-full',
              'bg-muted hover:bg-primary hover:text-primary-foreground',
              'transition-colors cursor-pointer',
              'max-w-[200px] truncate'
            )}
            onClick={() => onSelect(suggestion)}
            title={suggestion}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}
