'use client'

/**
 * Breakpoint Toolbar Component
 * 
 * Toggle between desktop, tablet, and mobile viewports
 * with breakpoint-specific style overrides.
 */

import { motion } from 'framer-motion'
import { Monitor, Tablet, Smartphone, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type Breakpoint = 'desktop' | 'tablet' | 'mobile'

export interface BreakpointConfig {
  id: Breakpoint
  label: string
  icon: typeof Monitor
  width: number
  minWidth: string
}

export const BREAKPOINTS: BreakpointConfig[] = [
  { id: 'desktop', label: 'Desktop', icon: Monitor, width: 1280, minWidth: '1024px' },
  { id: 'tablet', label: 'Tablet', icon: Tablet, width: 768, minWidth: '768px' },
  { id: 'mobile', label: 'Mobile', icon: Smartphone, width: 375, minWidth: '0px' },
]

interface BreakpointToolbarProps {
  activeBreakpoint: Breakpoint
  onBreakpointChange: (breakpoint: Breakpoint) => void
  hasOverrides?: Partial<Record<Breakpoint, boolean>>
  className?: string
}

export function BreakpointToolbar({
  activeBreakpoint,
  onBreakpointChange,
  hasOverrides = {},
  className,
}: BreakpointToolbarProps) {
  const activeConfig = BREAKPOINTS.find(b => b.id === activeBreakpoint) || BREAKPOINTS[0]

  return (
    <div className={cn('flex items-center gap-1 bg-card border rounded-lg p-0.5', className)}>
      {BREAKPOINTS.map((breakpoint) => {
        const Icon = breakpoint.icon
        const isActive = activeBreakpoint === breakpoint.id
        const hasOverride = hasOverrides[breakpoint.id]

        return (
          <Tooltip key={breakpoint.id}>
            <TooltipTrigger asChild>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                className={cn('h-8 px-2 relative', isActive && 'shadow-sm')}
                onClick={() => onBreakpointChange(breakpoint.id)}
              >
                <Icon className="h-4 w-4" />
                {hasOverride && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary"
                  />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <div className="font-medium">{breakpoint.label}</div>
              <div className="text-muted-foreground">{breakpoint.width}px</div>
              {hasOverride && (
                <div className="text-primary text-[10px] mt-0.5">Has custom styles</div>
              )}
            </TooltipContent>
          </Tooltip>
        )
      })}
      
      {/* Width indicator */}
      <Badge variant="outline" className="ml-1 text-[10px] font-mono">
        {activeConfig.width}px
      </Badge>
    </div>
  )
}

/**
 * Detailed breakpoint selector with custom width input
 */
interface BreakpointSelectorProps {
  activeBreakpoint: Breakpoint
  onBreakpointChange: (breakpoint: Breakpoint) => void
  customWidth?: number
  onCustomWidthChange?: (width: number) => void
}

export function BreakpointSelector({
  activeBreakpoint,
  onBreakpointChange,
  customWidth,
  onCustomWidthChange,
}: BreakpointSelectorProps) {
  const activeConfig = BREAKPOINTS.find(b => b.id === activeBreakpoint) || BREAKPOINTS[0]
  const Icon = activeConfig.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Icon className="h-4 w-4" />
          <span>{activeConfig.label}</span>
          <Badge variant="secondary" className="text-[10px] font-mono">
            {customWidth || activeConfig.width}px
          </Badge>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {BREAKPOINTS.map((breakpoint) => {
          const BpIcon = breakpoint.icon
          return (
            <DropdownMenuItem
              key={breakpoint.id}
              onClick={() => {
                onBreakpointChange(breakpoint.id)
                onCustomWidthChange?.(breakpoint.width)
              }}
              className={cn(
                activeBreakpoint === breakpoint.id && 'bg-primary/10'
              )}
            >
              <BpIcon className="h-4 w-4 mr-2" />
              <span className="flex-1">{breakpoint.label}</span>
              <span className="text-xs text-muted-foreground font-mono">
                {breakpoint.width}px
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Get viewport width for a breakpoint
 */
export function getBreakpointWidth(breakpoint: Breakpoint): number {
  const config = BREAKPOINTS.find(b => b.id === breakpoint)
  return config?.width || 1280
}

/**
 * Get CSS media query for a breakpoint
 */
export function getBreakpointMediaQuery(breakpoint: Breakpoint): string {
  switch (breakpoint) {
    case 'mobile':
      return '@media (max-width: 767px)'
    case 'tablet':
      return '@media (min-width: 768px) and (max-width: 1023px)'
    case 'desktop':
    default:
      return '@media (min-width: 1024px)'
  }
}
