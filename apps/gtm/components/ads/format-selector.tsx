'use client'

/**
 * Ad Format Selector Component
 * 
 * Visual format picker with platform-specific recommendations.
 */

import { motion } from 'framer-motion'
import {
  Image as ImageIcon,
  Film,
  LayoutGrid,
  Play,
  Square,
  Smartphone,
  Monitor,
  Check,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type AdPlatform = 'instagram' | 'facebook' | 'tiktok'
export type AdFormat = 'story' | 'reels' | 'feed' | 'carousel' | 'video'

export interface FormatOption {
  id: AdFormat
  name: string
  description: string
  icon: typeof ImageIcon
  aspectRatio: string
  dimensions: { width: number; height: number }
  duration?: string
  platforms: AdPlatform[]
  recommended?: boolean
  bestFor: string[]
}

export const AD_FORMATS: FormatOption[] = [
  {
    id: 'story',
    name: 'Story',
    description: 'Full-screen vertical, 3-5 slides',
    icon: Smartphone,
    aspectRatio: '9:16',
    dimensions: { width: 1080, height: 1920 },
    duration: '15s per slide',
    platforms: ['instagram', 'facebook'],
    bestFor: ['Brand awareness', 'Flash sales', 'Event promotions'],
  },
  {
    id: 'reels',
    name: 'Reels/Shorts',
    description: 'Short-form vertical video',
    icon: Film,
    aspectRatio: '9:16',
    dimensions: { width: 1080, height: 1920 },
    duration: '15-90 seconds',
    platforms: ['instagram', 'tiktok'],
    recommended: true,
    bestFor: ['Product demos', 'Tutorials', 'Viral content'],
  },
  {
    id: 'feed',
    name: 'Feed Post',
    description: 'Classic in-feed image or video',
    icon: Square,
    aspectRatio: '1:1 or 4:5',
    dimensions: { width: 1080, height: 1080 },
    platforms: ['instagram', 'facebook'],
    bestFor: ['Product showcases', 'Announcements', 'Testimonials'],
  },
  {
    id: 'carousel',
    name: 'Carousel',
    description: 'Multi-card swipeable format',
    icon: LayoutGrid,
    aspectRatio: '1:1',
    dimensions: { width: 1080, height: 1080 },
    platforms: ['instagram', 'facebook'],
    bestFor: ['Product collections', 'Step-by-step', 'Storytelling'],
  },
  {
    id: 'video',
    name: 'TikTok Video',
    description: 'Native TikTok style video',
    icon: Play,
    aspectRatio: '9:16',
    dimensions: { width: 1080, height: 1920 },
    duration: '15-60 seconds',
    platforms: ['tiktok'],
    bestFor: ['Trends', 'UGC-style', 'Entertainment'],
  },
]

interface FormatSelectorProps {
  platform: AdPlatform
  selectedFormat: AdFormat
  onSelectFormat: (format: AdFormat) => void
  showRecommendations?: boolean
  className?: string
}

export function FormatSelector({
  platform,
  selectedFormat,
  onSelectFormat,
  showRecommendations = true,
  className,
}: FormatSelectorProps) {
  const availableFormats = AD_FORMATS.filter((f) => f.platforms.includes(platform))

  return (
    <div className={cn('space-y-3', className)}>
      {availableFormats.map((format) => {
        const Icon = format.icon
        const isSelected = selectedFormat === format.id

        return (
          <motion.button
            key={format.id}
            onClick={() => onSelectFormat(format.id)}
            className={cn(
              'w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left',
              isSelected
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20'
            )}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {/* Icon */}
            <div
              className={cn(
                'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0',
                isSelected ? 'bg-primary text-white' : 'bg-muted'
              )}
            >
              <Icon className="w-6 h-6" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">{format.name}</span>
                {format.recommended && showRecommendations && (
                  <Badge variant="default" className="text-[10px] py-0">
                    Recommended
                  </Badge>
                )}
                {isSelected && (
                  <Check className="w-4 h-4 text-primary ml-auto" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {format.description}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {format.aspectRatio}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {format.dimensions.width}×{format.dimensions.height}
                </Badge>
                {format.duration && (
                  <Badge variant="outline" className="text-[10px]">
                    {format.duration}
                  </Badge>
                )}
              </div>
            </div>

            {/* Dimension Preview */}
            <div className="flex-shrink-0">
              <FormatPreviewThumb format={format} isSelected={isSelected} />
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

interface FormatPreviewThumbProps {
  format: FormatOption
  isSelected: boolean
}

function FormatPreviewThumb({ format, isSelected }: FormatPreviewThumbProps) {
  // Calculate proportional dimensions for preview
  const maxSize = 60
  let width: number
  let height: number

  if (format.dimensions.width > format.dimensions.height) {
    width = maxSize
    height = (format.dimensions.height / format.dimensions.width) * maxSize
  } else {
    height = maxSize
    width = (format.dimensions.width / format.dimensions.height) * maxSize
  }

  return (
    <div
      className={cn(
        'rounded border-2 flex items-center justify-center transition-colors',
        isSelected ? 'border-primary bg-primary/10' : 'border-muted-foreground/20 bg-muted'
      )}
      style={{ width, height }}
    >
      {format.id === 'carousel' && (
        <div className="flex gap-0.5">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-4 rounded-sm',
                isSelected ? 'bg-primary/50' : 'bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
      )}
      {format.id === 'story' || format.id === 'reels' || format.id === 'video' ? (
        <Smartphone
          className={cn(
            'w-4 h-4',
            isSelected ? 'text-primary' : 'text-muted-foreground/50'
          )}
        />
      ) : format.id === 'feed' ? (
        <Square
          className={cn(
            'w-4 h-4',
            isSelected ? 'text-primary' : 'text-muted-foreground/50'
          )}
        />
      ) : null}
    </div>
  )
}

/**
 * Compact format selector for toolbars
 */
interface CompactFormatSelectorProps {
  platform: AdPlatform
  selectedFormat: AdFormat
  onSelectFormat: (format: AdFormat) => void
  className?: string
}

export function CompactFormatSelector({
  platform,
  selectedFormat,
  onSelectFormat,
  className,
}: CompactFormatSelectorProps) {
  const availableFormats = AD_FORMATS.filter((f) => f.platforms.includes(platform))

  return (
    <div className={cn('flex gap-1 p-1 bg-muted rounded-lg', className)}>
      {availableFormats.map((format) => {
        const Icon = format.icon
        const isSelected = selectedFormat === format.id

        return (
          <button
            key={format.id}
            onClick={() => onSelectFormat(format.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all',
              isSelected
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={format.name}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{format.name}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Get format dimensions
 */
export function getFormatDimensions(format: AdFormat): { width: number; height: number } {
  const formatConfig = AD_FORMATS.find((f) => f.id === format)
  return formatConfig?.dimensions || { width: 1080, height: 1080 }
}

/**
 * Get recommended format for a platform
 */
export function getRecommendedFormat(platform: AdPlatform): AdFormat {
  const formats = AD_FORMATS.filter((f) => f.platforms.includes(platform))
  const recommended = formats.find((f) => f.recommended)
  return recommended?.id || formats[0]?.id || 'feed'
}
