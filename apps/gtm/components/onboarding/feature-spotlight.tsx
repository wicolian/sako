'use client'

/**
 * Feature Spotlight Component
 * 
 * Contextual tooltips and spotlight animations for highlighting new features
 * during onboarding and feature announcements.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface SpotlightStep {
  id: string
  target: string // CSS selector for the element to highlight
  title: string
  description: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
}

interface FeatureSpotlightProps {
  steps: SpotlightStep[]
  onComplete?: () => void
  onDismiss?: () => void
  storageKey?: string // Key to persist dismissed state
  className?: string
}

export function FeatureSpotlight({
  steps,
  onComplete,
  onDismiss,
  storageKey = 'feature-spotlight-dismissed',
  className,
}: FeatureSpotlightProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  const currentStepData = steps[currentStep]

  // Check if already dismissed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(storageKey)
      if (!dismissed) {
        setIsVisible(true)
      }
    }
  }, [storageKey])

  // Update target position
  useEffect(() => {
    if (!isVisible || !currentStepData?.target) return

    const updatePosition = () => {
      const element = document.querySelector(currentStepData.target)
      if (element) {
        setTargetRect(element.getBoundingClientRect())
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [isVisible, currentStepData?.target])

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }, [currentStep, steps.length])

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep])

  const handleComplete = useCallback(() => {
    setIsVisible(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, 'true')
    }
    onComplete?.()
  }, [storageKey, onComplete])

  const handleDismiss = useCallback(() => {
    setIsVisible(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, 'true')
    }
    onDismiss?.()
  }, [storageKey, onDismiss])

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!targetRect) return { top: '50%', left: '50%' }

    const position = currentStepData?.position || 'auto'
    const padding = 16
    const tooltipWidth = 320
    const tooltipHeight = 200

    // Auto-detect best position
    let finalPosition = position
    if (position === 'auto') {
      const spaceBelow = window.innerHeight - targetRect.bottom
      const spaceAbove = targetRect.top
      const spaceRight = window.innerWidth - targetRect.right
      const spaceLeft = targetRect.left

      if (spaceBelow >= tooltipHeight + padding) finalPosition = 'bottom'
      else if (spaceAbove >= tooltipHeight + padding) finalPosition = 'top'
      else if (spaceRight >= tooltipWidth + padding) finalPosition = 'right'
      else if (spaceLeft >= tooltipWidth + padding) finalPosition = 'left'
      else finalPosition = 'bottom'
    }

    switch (finalPosition) {
      case 'top':
        return {
          top: `${targetRect.top - padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translate(-50%, -100%)',
        }
      case 'bottom':
        return {
          top: `${targetRect.bottom + padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translate(-50%, 0)',
        }
      case 'left':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.left - padding}px`,
          transform: 'translate(-100%, -50%)',
        }
      case 'right':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.right + padding}px`,
          transform: 'translate(0, -50%)',
        }
      default:
        return {
          top: `${targetRect.bottom + padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translate(-50%, 0)',
        }
    }
  }

  if (!isVisible) return null

  return (
    <>
      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[9998]"
        onClick={handleDismiss}
      />

      {/* Target highlight */}
      {targetRect && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            borderRadius: '8px',
          }}
        >
          {/* Animated ring */}
          <motion.div
            className="absolute inset-0 rounded-lg border-2 border-primary"
            animate={{
              boxShadow: ['0 0 0 0 rgba(99, 102, 241, 0.4)', '0 0 0 8px rgba(99, 102, 241, 0)'],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>
      )}

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        {currentStepData && targetRect && (
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'fixed z-[10000] w-80 bg-card border rounded-xl shadow-2xl',
              className
            )}
            style={getTooltipPosition()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <Badge variant="secondary" className="text-[10px] mb-1">
                    {currentStep + 1} of {steps.length}
                  </Badge>
                  <h3 className="font-semibold text-sm">{currentStepData.title}</h3>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -mr-2 -mt-1"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-sm text-muted-foreground">
                {currentStepData.description}
              </p>

              {currentStepData.action && (
                <Button
                  variant="link"
                  className="p-0 h-auto mt-2 text-primary"
                  onClick={currentStepData.action.onClick}
                  asChild={!!currentStepData.action.href}
                >
                  {currentStepData.action.href ? (
                    <a href={currentStepData.action.href}>
                      {currentStepData.action.label}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </a>
                  ) : (
                    <>
                      {currentStepData.action.label}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t bg-muted/50 rounded-b-xl">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="text-xs"
              >
                <ChevronLeft className="w-3 h-3 mr-1" />
                Back
              </Button>

              <div className="flex gap-1">
                {steps.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full transition-colors',
                      idx === currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
                    )}
                  />
                ))}
              </div>

              <Button
                size="sm"
                onClick={handleNext}
                className="text-xs"
              >
                {currentStep < steps.length - 1 ? (
                  <>
                    Next
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </>
                ) : (
                  'Done'
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/**
 * Hook to manage feature spotlight state
 */
export function useFeatureSpotlight(spotlightId: string) {
  const storageKey = `spotlight-${spotlightId}`
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(storageKey)
      setShouldShow(!dismissed)
    }
  }, [storageKey])

  const dismiss = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, 'true')
      setShouldShow(false)
    }
  }, [storageKey])

  const reset = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey)
      setShouldShow(true)
    }
  }, [storageKey])

  return { shouldShow, dismiss, reset }
}

/**
 * Pre-built spotlight configurations for common features
 */
export const FEATURE_SPOTLIGHTS = {
  newUser: [
    {
      id: 'dashboard',
      target: '[data-sidebar="menu-button"][href="/dashboard"]',
      title: 'Welcome to your Dashboard',
      description: 'This is your command center. Get a quick overview of your campaigns, claims, and recent activity.',
      position: 'right' as const,
    },
    {
      id: 'canvas',
      target: '[data-sidebar="menu-button"][href="/canvas"]',
      title: 'Create with Canvas',
      description: 'Design and organize your campaign assets on an infinite canvas. Drag, drop, and collaborate in real-time.',
      position: 'right' as const,
      action: { label: 'Try Canvas', href: '/canvas' },
    },
    {
      id: 'studio',
      target: '[data-sidebar="menu-button"][href="/studio"]',
      title: 'Build AI Apps in Studio',
      description: 'Create custom AI-powered apps for your team. No coding required - just describe what you need.',
      position: 'right' as const,
      action: { label: 'Open Studio', href: '/studio' },
    },
    {
      id: 'claims',
      target: '[data-sidebar="menu-button"][href="/claims"]',
      title: 'Manage Your Claims',
      description: 'Keep your marketing compliant. Add evidence, track approvals, and ensure every claim is backed by proof.',
      position: 'right' as const,
    },
    {
      id: 'agent',
      target: '[data-sidebar="menu-button"][href="/agent"]',
      title: 'Meet Your AI Agent',
      description: 'Chat with Sako to generate content, answer questions, and automate repetitive tasks.',
      position: 'right' as const,
      action: { label: 'Start chatting', href: '/agent' },
    },
  ],

  studioApps: [
    {
      id: 'app-gallery',
      target: '[data-testid="app-gallery"]',
      title: 'Your App Gallery',
      description: 'All your custom AI apps live here. Click on any app to run it or edit its configuration.',
      position: 'bottom' as const,
    },
    {
      id: 'create-app',
      target: '[data-testid="create-app-button"]',
      title: 'Create Your First App',
      description: 'Click here to build a new AI app. Choose from templates or start from scratch.',
      position: 'bottom' as const,
      action: { label: 'Create app', href: '/studio?new=true' },
    },
  ],

  canvasIntro: [
    {
      id: 'canvas-toolbar',
      target: '[data-testid="canvas-toolbar"]',
      title: 'Canvas Toolbar',
      description: 'Add assets, change views, and access project settings from this toolbar.',
      position: 'bottom' as const,
    },
    {
      id: 'canvas-minimap',
      target: '.react-flow__minimap',
      title: 'Navigate Your Canvas',
      description: 'Use the minimap to navigate large projects. Click and drag to move around.',
      position: 'left' as const,
    },
  ],
}
