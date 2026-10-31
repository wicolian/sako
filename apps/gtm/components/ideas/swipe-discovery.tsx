'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from 'framer-motion'
import { 
  Heart, 
  X, 
  RefreshCw, 
  Sparkles, 
  ChevronUp,
  Loader2,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface ContentIdea {
  id: string
  content: string
  type: 'headline' | 'angle' | 'hook' | 'cta' | 'concept'
  category?: string
  framework?: string
  tone?: string
  targetAudience?: string
  status: 'pending' | 'saved' | 'skipped'
}

interface SwipeDiscoveryProps {
  ideas: ContentIdea[]
  onSave: (idea: ContentIdea) => Promise<void>
  onSkip: (idea: ContentIdea) => void
  onRequestMore: () => Promise<void>
  onGenerateVariations: (idea: ContentIdea) => Promise<void>
  campaignId?: string
  isLoading?: boolean
  className?: string
}

// ============================================================================
// Constants
// ============================================================================

const SWIPE_THRESHOLD = 100
const ROTATION_FACTOR = 0.1
const VELOCITY_THRESHOLD = 500

const TYPE_LABELS: Record<ContentIdea['type'], { label: string; color: string }> = {
  headline: { label: 'Headline', color: 'bg-blue-500' },
  angle: { label: 'Angle', color: 'bg-purple-500' },
  hook: { label: 'Hook', color: 'bg-amber-500' },
  cta: { label: 'CTA', color: 'bg-emerald-500' },
  concept: { label: 'Concept', color: 'bg-pink-500' },
}

// ============================================================================
// Swipe Card Component
// ============================================================================

interface SwipeCardProps {
  idea: ContentIdea
  onSwipe: (direction: 'left' | 'right' | 'up') => void
  isTop: boolean
  index: number
}

function SwipeCard({ idea, onSwipe, isTop, index }: SwipeCardProps) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  
  // Rotate based on horizontal drag
  const rotate = useTransform(x, [-200, 200], [-15, 15])
  
  // Opacity indicators
  const likeOpacity = useTransform(x, [0, 100], [0, 1])
  const skipOpacity = useTransform(x, [-100, 0], [1, 0])
  const variationsOpacity = useTransform(y, [-100, 0], [1, 0])
  
  // Background color shift
  const backgroundColor = useTransform(
    x,
    [-100, 0, 100],
    ['rgba(239, 68, 68, 0.1)', 'rgba(255, 255, 255, 0)', 'rgba(34, 197, 94, 0.1)']
  )

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info
    
    // Check for vertical swipe up
    if (offset.y < -SWIPE_THRESHOLD || velocity.y < -VELOCITY_THRESHOLD) {
      onSwipe('up')
      return
    }
    
    // Check for horizontal swipes
    if (Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > VELOCITY_THRESHOLD) {
      onSwipe(offset.x > 0 ? 'right' : 'left')
    }
  }

  const typeConfig = TYPE_LABELS[idea.type]

  return (
    <motion.div
      className={cn(
        "absolute w-full cursor-grab active:cursor-grabbing",
        !isTop && "pointer-events-none"
      )}
      style={{
        x,
        y,
        rotate,
        zIndex: 10 - index,
        scale: 1 - index * 0.05,
        translateY: index * 8,
      }}
      drag={isTop}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={1}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1 - index * 0.05, opacity: 1 }}
      exit={{ 
        x: x.get() > 0 ? 300 : x.get() < 0 ? -300 : 0,
        y: y.get() < -50 ? -300 : 0,
        opacity: 0,
        transition: { duration: 0.3 }
      }}
    >
      <motion.div style={{ backgroundColor }}>
        <Card className="overflow-hidden shadow-lg">
          {/* Swipe Indicators */}
          {isTop && (
            <>
              <motion.div 
                className="absolute top-4 right-4 z-10"
                style={{ opacity: likeOpacity }}
              >
                <Badge className="bg-emerald-500 text-white text-lg px-4 py-2 rotate-12">
                  SAVE
                </Badge>
              </motion.div>
              <motion.div 
                className="absolute top-4 left-4 z-10"
                style={{ opacity: skipOpacity }}
              >
                <Badge className="bg-red-500 text-white text-lg px-4 py-2 -rotate-12">
                  SKIP
                </Badge>
              </motion.div>
              <motion.div 
                className="absolute top-4 left-1/2 -translate-x-1/2 z-10"
                style={{ opacity: variationsOpacity }}
              >
                <Badge className="bg-purple-500 text-white text-lg px-4 py-2">
                  VARIATIONS
                </Badge>
              </motion.div>
            </>
          )}

          <CardContent className="p-6 space-y-4">
            {/* Type Badge */}
            <div className="flex items-center gap-2">
              <Badge className={cn("text-white", typeConfig.color)}>
                {typeConfig.label}
              </Badge>
              {idea.framework && (
                <Badge variant="outline">{idea.framework}</Badge>
              )}
            </div>

            {/* Content */}
            <p className="text-xl font-medium leading-relaxed">
              {idea.content}
            </p>

            {/* Metadata */}
            <div className="flex flex-wrap gap-2 pt-2">
              {idea.category && (
                <Badge variant="secondary" className="text-xs">
                  {idea.category}
                </Badge>
              )}
              {idea.tone && (
                <Badge variant="secondary" className="text-xs">
                  {idea.tone}
                </Badge>
              )}
              {idea.targetAudience && (
                <Badge variant="secondary" className="text-xs">
                  {idea.targetAudience}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function SwipeDiscovery({
  ideas,
  onSave,
  onSkip,
  onRequestMore,
  onGenerateVariations,
  campaignId,
  isLoading = false,
  className,
}: SwipeDiscoveryProps) {
  const { toast } = useToast()
  const [deck, setDeck] = useState<ContentIdea[]>(ideas)
  const [savedCount, setSavedCount] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  // Update deck when ideas change
  useEffect(() => {
    setDeck(ideas.filter(i => i.status === 'pending'))
  }, [ideas])

  const currentIdea = deck[0]

  const handleSwipe = useCallback(async (direction: 'left' | 'right' | 'up') => {
    if (!currentIdea || isProcessing) return

    setIsProcessing(true)

    try {
      if (direction === 'right') {
        // Save
        await onSave(currentIdea)
        setSavedCount(prev => prev + 1)
        toast({
          title: 'Saved!',
          description: 'Idea added to your campaign',
        })
      } else if (direction === 'left') {
        // Skip
        onSkip(currentIdea)
      } else if (direction === 'up') {
        // Generate variations
        await onGenerateVariations(currentIdea)
        toast({
          title: 'Generating variations',
          description: 'Creating new ideas based on this one',
        })
      }

      // Remove from deck
      setDeck(prev => prev.slice(1))

      // Request more if running low
      if (deck.length <= 3) {
        onRequestMore()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process idea',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [currentIdea, isProcessing, deck.length, onSave, onSkip, onGenerateVariations, onRequestMore, toast])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleSwipe('right')
      if (e.key === 'ArrowLeft') handleSwipe('left')
      if (e.key === 'ArrowUp') handleSwipe('up')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSwipe])

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* Stats */}
      <div className="w-full max-w-sm mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-emerald-500" />
          <span className="font-medium">{savedCount} saved</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{deck.length} remaining</span>
        </div>
      </div>

      {/* Card Stack */}
      <div className="relative w-full max-w-sm h-[400px]">
        {isLoading ? (
          <Card className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading ideas...</p>
            </div>
          </Card>
        ) : deck.length === 0 ? (
          <Card className="w-full h-full flex items-center justify-center">
            <div className="text-center p-6">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-medium mb-2">All caught up!</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You&apos;ve reviewed all ideas. Want more?
              </p>
              <Button onClick={onRequestMore}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate More Ideas
              </Button>
            </div>
          </Card>
        ) : (
          <AnimatePresence>
            {deck.slice(0, 3).map((idea, index) => (
              <SwipeCard
                key={idea.id}
                idea={idea}
                onSwipe={handleSwipe}
                isTop={index === 0}
                index={index}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Action Buttons */}
      {deck.length > 0 && !isLoading && (
        <div className="flex items-center gap-4 mt-6">
          <Button
            variant="outline"
            size="lg"
            className="rounded-full h-14 w-14 p-0"
            onClick={() => handleSwipe('left')}
            disabled={isProcessing}
          >
            <X className="h-6 w-6 text-red-500" />
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            className="rounded-full h-12 w-12 p-0"
            onClick={() => handleSwipe('up')}
            disabled={isProcessing}
          >
            <ChevronUp className="h-5 w-5 text-purple-500" />
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            className="rounded-full h-14 w-14 p-0"
            onClick={() => handleSwipe('right')}
            disabled={isProcessing}
          >
            <Heart className="h-6 w-6 text-emerald-500" />
          </Button>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 text-center text-sm text-muted-foreground max-w-sm">
        <p className="flex items-center justify-center gap-1">
          <Info className="h-4 w-4" />
          Swipe right to save, left to skip, up for variations
        </p>
        <p className="mt-1">Or use arrow keys: ← → ↑</p>
      </div>
    </div>
  )
}
