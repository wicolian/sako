'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Play, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PAGE_TRANSITIONS, type PageTransition, type TransitionType } from '@/lib/website/transitions'

interface TransitionPickerProps {
  value: string
  duration: number
  onTransitionChange: (transitionId: string) => void
  onDurationChange: (duration: number) => void
}

export function TransitionPicker({
  value,
  duration,
  onTransitionChange,
  onDurationChange,
}: TransitionPickerProps) {
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const selectedTransition = PAGE_TRANSITIONS.find(t => t.id === value) || PAGE_TRANSITIONS[0]

  const playPreview = () => {
    setIsPreviewPlaying(true)
    setTimeout(() => setIsPreviewPlaying(false), duration + 100)
  }

  // Group transitions by type
  const transitionGroups: { type: TransitionType; label: string; transitions: PageTransition[] }[] = [
    { type: 'instant', label: 'None', transitions: PAGE_TRANSITIONS.filter(t => t.type === 'instant') },
    { type: 'fade', label: 'Fade', transitions: PAGE_TRANSITIONS.filter(t => t.type === 'fade') },
    { type: 'slide', label: 'Slide', transitions: PAGE_TRANSITIONS.filter(t => t.type === 'slide') },
    { type: 'scale', label: 'Scale', transitions: PAGE_TRANSITIONS.filter(t => t.type === 'scale') },
    { type: 'blur', label: 'Blur', transitions: PAGE_TRANSITIONS.filter(t => t.type === 'blur') },
    { type: 'push', label: 'Push', transitions: PAGE_TRANSITIONS.filter(t => t.type === 'push') },
    { type: 'wipe', label: 'Wipe', transitions: PAGE_TRANSITIONS.filter(t => t.type === 'wipe') },
  ]

  return (
    <div className="space-y-4">
      {/* Transition Selector */}
      <div className="space-y-2">
        <Label className="text-xs">Page Transition</Label>
        <Select value={value} onValueChange={onTransitionChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select transition" />
          </SelectTrigger>
          <SelectContent>
            {transitionGroups.map(group => (
              group.transitions.length > 0 && (
                <div key={group.type}>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {group.label}
                  </div>
                  {group.transitions.map(transition => (
                    <SelectItem key={transition.id} value={transition.id}>
                      {transition.name}
                    </SelectItem>
                  ))}
                </div>
              )
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Duration Slider */}
      {selectedTransition.type !== 'instant' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Duration</Label>
            <span className="text-xs text-muted-foreground">{duration}ms</span>
          </div>
          <Slider
            value={[duration]}
            onValueChange={([v]) => onDurationChange(v)}
            min={100}
            max={1000}
            step={50}
          />
        </div>
      )}

      {/* Preview */}
      {selectedTransition.type !== 'instant' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Preview</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={playPreview}
              disabled={isPreviewPlaying}
            >
              {isPreviewPlaying ? (
                <RotateCcw className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1" />
              )}
              Play
            </Button>
          </div>

          <div className="relative h-24 bg-muted rounded-lg overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={isPreviewPlaying ? 'playing' : 'idle'}
                className="absolute inset-2 bg-background rounded border shadow-sm flex items-center justify-center"
                initial={getInitialAnimation(selectedTransition)}
                animate={getAnimateAnimation(selectedTransition)}
                exit={getExitAnimation(selectedTransition)}
                transition={{
                  duration: duration / 1000,
                  ease: selectedTransition.easing === 'ease-in-out' ? 'easeInOut' : 
                        selectedTransition.easing === 'ease-out' ? 'easeOut' : 'linear',
                }}
              >
                <div className="text-xs text-muted-foreground">
                  {isPreviewPlaying ? 'Page 2' : 'Page 1'}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Transition Visual Grid */}
      <div className="space-y-2">
        <Label className="text-xs">Quick Select</Label>
        <div className="grid grid-cols-4 gap-2">
          {PAGE_TRANSITIONS.filter(t => t.type !== 'instant').slice(0, 8).map(transition => (
            <button
              key={transition.id}
              onClick={() => onTransitionChange(transition.id)}
              className={cn(
                'aspect-square rounded-lg border p-1 transition-all',
                'hover:border-primary hover:bg-primary/5',
                value === transition.id && 'border-primary bg-primary/10'
              )}
              title={transition.name}
            >
              <TransitionIcon type={transition.type} direction={transition.direction} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Helper functions for Framer Motion animations
function getInitialAnimation(transition: PageTransition) {
  switch (transition.type) {
    case 'fade':
      return { opacity: 0 }
    case 'slide':
      return {
        x: transition.direction === 'left' ? '100%' : transition.direction === 'right' ? '-100%' : 0,
        y: transition.direction === 'up' ? '100%' : transition.direction === 'down' ? '-100%' : 0,
      }
    case 'scale':
      return { scale: 0.9, opacity: 0 }
    case 'blur':
      return { filter: 'blur(10px)', opacity: 0 }
    case 'push':
      return { x: transition.direction === 'left' ? '100%' : '-100%' }
    case 'wipe':
      return { clipPath: transition.direction === 'left' ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)' }
    default:
      return {}
  }
}

function getAnimateAnimation(transition: PageTransition) {
  switch (transition.type) {
    case 'fade':
      return { opacity: 1 }
    case 'slide':
    case 'push':
      return { x: 0, y: 0 }
    case 'scale':
      return { scale: 1, opacity: 1 }
    case 'blur':
      return { filter: 'blur(0px)', opacity: 1 }
    case 'wipe':
      return { clipPath: 'inset(0 0 0 0)' }
    default:
      return {}
  }
}

function getExitAnimation(transition: PageTransition) {
  switch (transition.type) {
    case 'fade':
      return { opacity: 0 }
    case 'slide':
      return {
        x: transition.direction === 'left' ? '-100%' : transition.direction === 'right' ? '100%' : 0,
        y: transition.direction === 'up' ? '-100%' : transition.direction === 'down' ? '100%' : 0,
      }
    case 'scale':
      return { scale: 1.1, opacity: 0 }
    case 'blur':
      return { filter: 'blur(10px)', opacity: 0 }
    case 'push':
      return { x: transition.direction === 'left' ? '-30%' : '30%', opacity: 0.5 }
    case 'wipe':
      return { clipPath: transition.direction === 'left' ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' }
    default:
      return {}
  }
}

// Visual icon component for transition types
function TransitionIcon({ type, direction }: { type: TransitionType; direction?: string }) {
  const baseClass = 'w-full h-full flex items-center justify-center'

  switch (type) {
    case 'fade':
      return (
        <div className={baseClass}>
          <div className="w-3 h-3 rounded bg-primary/30" />
          <div className="w-3 h-3 rounded bg-primary ml-1" />
        </div>
      )
    case 'slide':
      return (
        <div className={baseClass}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary">
            <path
              fill="currentColor"
              d={direction === 'left' ? 'M14 7l-5 5 5 5V7z' : 
                 direction === 'right' ? 'M10 17l5-5-5-5v10z' :
                 direction === 'up' ? 'M7 14l5-5 5 5H7z' : 'M7 10l5 5 5-5H7z'}
            />
          </svg>
        </div>
      )
    case 'scale':
      return (
        <div className={baseClass}>
          <div className="w-2 h-2 rounded bg-primary/30" />
          <div className="absolute w-4 h-4 rounded bg-primary/60" />
        </div>
      )
    case 'blur':
      return (
        <div className={baseClass}>
          <div className="w-4 h-4 rounded bg-primary blur-[2px]" />
        </div>
      )
    case 'push':
      return (
        <div className={baseClass}>
          <div className="w-2 h-3 rounded-sm bg-primary/30" />
          <div className="w-2 h-3 rounded-sm bg-primary ml-0.5" />
        </div>
      )
    case 'wipe':
      return (
        <div className={baseClass}>
          <div className="w-4 h-3 rounded-sm overflow-hidden bg-muted">
            <div className="w-1/2 h-full bg-primary" />
          </div>
        </div>
      )
    default:
      return (
        <div className={baseClass}>
          <div className="w-3 h-3 rounded bg-muted-foreground/20" />
        </div>
      )
  }
}
