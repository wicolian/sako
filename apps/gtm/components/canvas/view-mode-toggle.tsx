'use client'

/**
 * View Mode Toggle Component
 * 
 * Provides a toggle between Canvas (spatial 2D) and Table (structured) views
 * for project assets, matching Jasper Canvas's dual-view functionality.
 */

import { motion } from 'framer-motion'
import { LayoutGrid, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type ViewMode = 'canvas' | 'table'

interface ViewModeToggleProps {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
  variant?: 'default' | 'compact' | 'minimal'
  className?: string
}

export function ViewModeToggle({
  mode,
  onChange,
  variant = 'default',
  className,
}: ViewModeToggleProps) {
  if (variant === 'minimal') {
    return (
      <TooltipProvider>
        <div className={cn('flex items-center gap-1', className)}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mode === 'canvas' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => onChange('canvas')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Canvas View</p>
              <p className="text-xs text-muted-foreground">Spatial 2D organization</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mode === 'table' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => onChange('table')}
              >
                <Table2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Table View</p>
              <p className="text-xs text-muted-foreground">Structured data overview</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-1 bg-muted rounded-lg p-1', className)}>
        <Button
          variant={mode === 'canvas' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2"
          onClick={() => onChange('canvas')}
        >
          <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
          Canvas
        </Button>
        <Button
          variant={mode === 'table' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2"
          onClick={() => onChange('table')}
        >
          <Table2 className="h-3.5 w-3.5 mr-1.5" />
          Table
        </Button>
      </div>
    )
  }

  // Default variant using Tabs
  return (
    <Tabs value={mode} onValueChange={(v) => onChange(v as ViewMode)} className={className}>
      <TabsList className="grid w-[200px] grid-cols-2">
        <TabsTrigger value="canvas" className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Canvas
        </TabsTrigger>
        <TabsTrigger value="table" className="flex items-center gap-2">
          <Table2 className="h-4 w-4" />
          Table
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

/**
 * Animated View Mode Toggle
 * 
 * Premium variant with animated underline indicator.
 */
export function AnimatedViewModeToggle({
  mode,
  onChange,
  className,
}: ViewModeToggleProps) {
  const modes: { id: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'canvas', label: 'Canvas', icon: LayoutGrid },
    { id: 'table', label: 'Table', icon: Table2 },
  ]

  return (
    <div className={cn('flex items-center gap-1 bg-muted/50 rounded-full p-1', className)}>
      {modes.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            'relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
            mode === id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {mode === id && (
            <motion.div
              layoutId="viewmode-indicator"
              className="absolute inset-0 bg-background rounded-full shadow-sm"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {label}
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * View Mode Info Component
 * 
 * Shows description of the current view mode.
 */
export function ViewModeInfo({ mode }: { mode: ViewMode }) {
  const info = {
    canvas: {
      title: 'Canvas Mode',
      description: 'Spatial 2D organization with drag-and-drop positioning, connections between assets, and visual workflow design.',
      tips: [
        'Drag assets to reposition',
        'Connect related assets with lines',
        'Use mini-map for navigation',
        'Double-click to add new assets',
      ],
    },
    table: {
      title: 'Table Mode',
      description: 'Structured overview of all assets with sortable columns, bulk selection, and quick filters.',
      tips: [
        'Click column headers to sort',
        'Use checkboxes for bulk actions',
        'Filter by asset type',
        'Click row to preview asset',
      ],
    },
  }

  const current = info[mode]

  return (
    <div className="p-4 bg-muted/30 rounded-lg border">
      <h4 className="font-medium text-sm mb-1">{current.title}</h4>
      <p className="text-xs text-muted-foreground mb-3">{current.description}</p>
      <div className="space-y-1">
        {current.tips.map((tip, i) => (
          <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
            <span className="text-primary">•</span>
            {tip}
          </p>
        ))}
      </div>
    </div>
  )
}
