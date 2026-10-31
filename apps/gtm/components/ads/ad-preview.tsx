'use client'

/**
 * Ad Preview Component
 * 
 * Platform-specific ad previews with device frames:
 * - Instagram Story/Reels/Feed
 * - Facebook Carousel/Story/Feed
 * - TikTok Video
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Download,
  Share2,
  Home,
  Search,
  PlusSquare,
  Film,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Platform types
type Platform = 'instagram' | 'facebook' | 'tiktok'
type Format = 'story' | 'reels' | 'feed' | 'carousel' | 'video'

interface BaseAdData {
  platform: Platform
  format: Format
  primaryText?: string
  headline?: string
  callToAction?: string
  imageUrl?: string
}

interface StoryAdData extends BaseAdData {
  format: 'story'
  slides: Array<{
    imageUrl?: string
    textOverlay: string
    position: 'top' | 'center' | 'bottom'
  }>
  swipeUpCta?: string
}

interface ReelsAdData extends BaseAdData {
  format: 'reels'
  videoUrl?: string
  thumbnailUrl?: string
  caption: string
  hashtags: string[]
  audioName?: string
}

interface FeedAdData extends BaseAdData {
  format: 'feed'
  username: string
  userAvatar?: string
  likes?: number
  caption: string
}

interface CarouselAdData extends BaseAdData {
  format: 'carousel'
  cards: Array<{
    imageUrl?: string
    headline: string
    description?: string
  }>
}

interface TikTokAdData extends BaseAdData {
  format: 'video'
  videoUrl?: string
  thumbnailUrl?: string
  caption: string
  hashtags: string[]
  soundName?: string
  likes?: number
  comments?: number
  shares?: number
}

type AdData = StoryAdData | ReelsAdData | FeedAdData | CarouselAdData | TikTokAdData

interface AdPreviewProps {
  data: AdData
  showDeviceFrame?: boolean
  className?: string
}

export function AdPreview({
  data,
  showDeviceFrame = true,
  className,
}: AdPreviewProps) {
  const PreviewComponent = getPreviewComponent(data.platform, data.format)

  const content = <PreviewComponent data={data} />

  if (!showDeviceFrame) {
    return <div className={className}>{content}</div>
  }

  return (
    <div className={cn('flex justify-center', className)}>
      <PhoneFrame platform={data.platform}>{content}</PhoneFrame>
    </div>
  )
}

// Phone device frame
function PhoneFrame({ children, platform }: { children: React.ReactNode; platform: Platform }) {
  return (
    <div className="relative">
      {/* Phone body */}
      <div className="relative w-[280px] h-[580px] bg-black rounded-[40px] p-2 shadow-xl border-4 border-border/50">
        {/* Dynamic island / notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-10" />
        
        {/* Screen */}
        <div className="w-full h-full bg-black rounded-[32px] overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}

// Get the appropriate preview component
function getPreviewComponent(platform: Platform, format: Format) {
  if (platform === 'instagram') {
    switch (format) {
      case 'story':
        return InstagramStoryPreview
      case 'reels':
        return InstagramReelsPreview
      case 'feed':
        return InstagramFeedPreview
      case 'carousel':
        return InstagramCarouselPreview
    }
  }
  if (platform === 'facebook') {
    switch (format) {
      case 'feed':
        return FacebookFeedPreview
      case 'carousel':
        return FacebookCarouselPreview
      case 'story':
        return FacebookStoryPreview
    }
  }
  if (platform === 'tiktok') {
    return TikTokPreview
  }
  return InstagramStoryPreview
}

// Instagram Story Preview
function InstagramStoryPreview({ data }: { data: AdData }) {
  const storyData = data as StoryAdData
  const [currentSlide, setCurrentSlide] = useState(0)
  const slides = storyData.slides || []

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-gray-900 to-gray-800">
      {/* Progress bars */}
      <div className="absolute top-8 left-3 right-3 flex gap-1 z-20">
        {slides.map((_, idx) => (
          <div key={idx} className="flex-1 h-0.5 rounded-full overflow-hidden bg-card/30">
            <div
              className={cn(
                'h-full bg-card transition-all duration-300',
                idx < currentSlide ? 'w-full' : idx === currentSlide ? 'w-1/2' : 'w-0'
              )}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-12 left-3 right-3 flex items-center gap-2 z-20">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
        <div className="flex-1">
          <p className="text-white text-xs font-semibold">Sponsored</p>
        </div>
        <MoreHorizontal className="w-5 h-5 text-white" />
      </div>

      {/* Slide content */}
      <AnimatePresence mode="wait">
        {slides[currentSlide] && (
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {slides[currentSlide].imageUrl ? (
              <img
                src={slides[currentSlide].imageUrl}
                alt="Story"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-700" />
            )}
            <div
              className={cn(
                'absolute left-4 right-4 text-white text-center px-4',
                slides[currentSlide].position === 'top' && 'top-24',
                slides[currentSlide].position === 'center' && 'top-1/2 -translate-y-1/2',
                slides[currentSlide].position === 'bottom' && 'bottom-24'
              )}
            >
              <p className="text-lg font-bold drop-shadow-lg">
                {slides[currentSlide].textOverlay}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <button
        className="absolute left-0 top-1/2 -translate-y-1/2 w-1/3 h-1/2"
        onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
      />
      <button
        className="absolute right-0 top-1/2 -translate-y-1/2 w-1/3 h-1/2"
        onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
      />

      {/* Swipe up CTA */}
      {storyData.swipeUpCta && (
        <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center z-20">
          <ChevronLeft className="w-6 h-6 text-white rotate-90 animate-bounce" />
          <span className="text-white text-xs">{storyData.swipeUpCta}</span>
        </div>
      )}
    </div>
  )
}

// Instagram Reels Preview
function InstagramReelsPreview({ data }: { data: AdData }) {
  const reelsData = data as ReelsAdData
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)

  return (
    <div className="relative w-full h-full bg-black">
      {/* Video content */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500" />

      {/* Header */}
      <div className="absolute top-8 left-3 right-3 flex items-center justify-between z-20">
        <span className="text-white text-sm font-semibold">Reels</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMuted(!isMuted)}>
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-white" />
            ) : (
              <Volume2 className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Right sidebar actions */}
      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5 z-20">
        <button className="flex flex-col items-center">
          <Heart className="w-7 h-7 text-white" />
          <span className="text-white text-xs mt-1">1.2K</span>
        </button>
        <button className="flex flex-col items-center">
          <MessageCircle className="w-7 h-7 text-white" />
          <span className="text-white text-xs mt-1">324</span>
        </button>
        <button className="flex flex-col items-center">
          <Send className="w-7 h-7 text-white" />
        </button>
        <button className="flex flex-col items-center">
          <MoreHorizontal className="w-7 h-7 text-white" />
        </button>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-16 left-3 right-14 z-20">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
          <span className="text-white text-sm font-semibold">brand</span>
          <Badge className="bg-card/20 text-white text-[10px]">Sponsored</Badge>
        </div>
        <p className="text-white text-sm line-clamp-2">{reelsData.caption}</p>
        {reelsData.hashtags && (
          <p className="text-white/70 text-xs mt-1">
            {reelsData.hashtags.map(t => `#${t}`).join(' ')}
          </p>
        )}
        {reelsData.audioName && (
          <div className="flex items-center gap-2 mt-2">
            <div className="w-4 h-4 rounded bg-card/20" />
            <span className="text-white text-xs">{reelsData.audioName}</span>
          </div>
        )}
      </div>

      {/* CTA button */}
      <div className="absolute bottom-4 left-3 right-3 z-20">
        <button className="w-full py-2 bg-card rounded-lg text-sm font-semibold">
          {data.callToAction || 'Shop Now'}
        </button>
      </div>

      {/* Play button overlay */}
      {!isPlaying && (
        <button
          className="absolute inset-0 flex items-center justify-center z-10"
          onClick={() => setIsPlaying(true)}
        >
          <div className="w-16 h-16 rounded-full bg-card/20 flex items-center justify-center">
            <Play className="w-8 h-8 text-white ml-1" fill="white" />
          </div>
        </button>
      )}
    </div>
  )
}

// Instagram Feed Preview
function InstagramFeedPreview({ data }: { data: AdData }) {
  const feedData = data as FeedAdData
  const [liked, setLiked] = useState(false)

  return (
    <div className="w-full h-full bg-card flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{feedData.username || 'brand'}</p>
          <p className="text-xs text-muted-foreground">Sponsored</p>
        </div>
        <MoreHorizontal className="w-5 h-5" />
      </div>

      {/* Image */}
      <div className="aspect-square bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
        {feedData.imageUrl ? (
          <img src={feedData.imageUrl} alt="Post" className="w-full h-full object-cover" />
        ) : (
          <span className="text-white text-lg font-bold">{feedData.headline || 'Your Ad Here'}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-4">
          <button onClick={() => setLiked(!liked)}>
            <Heart className={cn('w-6 h-6', liked && 'fill-red-500 text-red-500')} />
          </button>
          <MessageCircle className="w-6 h-6" />
          <Send className="w-6 h-6" />
        </div>
        <Bookmark className="w-6 h-6" />
      </div>

      {/* Likes */}
      <div className="px-3">
        <p className="text-sm font-semibold">{feedData.likes?.toLocaleString() || '1,234'} likes</p>
      </div>

      {/* Caption */}
      <div className="px-3 py-2 flex-1">
        <p className="text-sm">
          <span className="font-semibold">{feedData.username || 'brand'}</span>{' '}
          {feedData.caption}
        </p>
      </div>

      {/* CTA */}
      <div className="p-3 border-t">
        <button className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold">
          {data.callToAction || 'Learn More'}
        </button>
      </div>
    </div>
  )
}

// Instagram Carousel Preview
function InstagramCarouselPreview({ data }: { data: AdData }) {
  const carouselData = data as CarouselAdData
  const [currentCard, setCurrentCard] = useState(0)
  const cards = carouselData.cards || []

  return (
    <div className="w-full h-full bg-card flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold">brand</p>
          <p className="text-xs text-muted-foreground">Sponsored</p>
        </div>
      </div>

      {/* Carousel */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 flex flex-col items-center justify-center p-6"
          >
            {cards[currentCard] && (
              <>
                <h3 className="text-white text-xl font-bold text-center mb-2">
                  {cards[currentCard].headline}
                </h3>
                {cards[currentCard].description && (
                  <p className="text-white/80 text-sm text-center">
                    {cards[currentCard].description}
                  </p>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        {currentCard > 0 && (
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card shadow flex items-center justify-center"
            onClick={() => setCurrentCard(currentCard - 1)}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {currentCard < cards.length - 1 && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card shadow flex items-center justify-center"
            onClick={() => setCurrentCard(currentCard + 1)}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Dots indicator */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1">
          {cards.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-colors',
                idx === currentCard ? 'bg-blue-500' : 'bg-card/50'
              )}
            />
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="p-3 border-t">
        <button className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold">
          {data.callToAction || 'Shop Now'}
        </button>
      </div>
    </div>
  )
}

// Facebook Feed Preview (new)
function FacebookFeedPreview({ data }: { data: AdData }) {
  const feedData = data as FeedAdData

  return (
    <div className="w-full h-full bg-card flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{feedData.username || 'Brand Page'}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Sponsored</span>
            <span>·</span>
            <span>🌐</span>
          </div>
        </div>
        <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Primary text */}
      {feedData.caption && (
        <div className="px-3 pb-3">
          <p className="text-sm">{feedData.caption}</p>
        </div>
      )}

      {/* Image */}
      <div className="aspect-[4/5] bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        {feedData.imageUrl ? (
          <img src={feedData.imageUrl} alt="Ad" className="w-full h-full object-cover" />
        ) : (
          <span className="text-white text-lg font-bold">{feedData.headline || 'Your Ad'}</span>
        )}
      </div>

      {/* Link preview */}
      <div className="p-3 bg-muted/20 border-t border-b">
        <p className="text-xs text-muted-foreground uppercase">yoursite.com</p>
        <p className="text-sm font-semibold">{data.headline || 'Headline goes here'}</p>
        <p className="text-xs text-muted-foreground">{data.primaryText || 'Description text'}</p>
      </div>

      {/* Reactions */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-1">
          <span className="text-xl">👍❤️</span>
          <span className="text-sm text-muted-foreground">{feedData.likes || 234}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>12 comments</span>
          <span>5 shares</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-around py-2 border-t">
        <button className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
          <span>👍</span> Like
        </button>
        <button className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
          <MessageCircle className="w-4 h-4" /> Comment
        </button>
        <button className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
          <Share2 className="w-4 h-4" /> Share
        </button>
      </div>

      {/* CTA Button */}
      <div className="p-3">
        <button className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-semibold">
          {data.callToAction || 'Learn More'}
        </button>
      </div>
    </div>
  )
}

// Facebook Carousel Preview
function FacebookCarouselPreview({ data }: { data: AdData }) {
  return InstagramCarouselPreview({ data })
}

// Facebook Story Preview
function FacebookStoryPreview({ data }: { data: AdData }) {
  return InstagramStoryPreview({ data })
}

// TikTok Video Preview
function TikTokPreview({ data }: { data: AdData }) {
  const tiktokData = data as TikTokAdData
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <div className="relative w-full h-full bg-black">
      {/* Video content placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-red-500 to-orange-500" />

      {/* Right sidebar */}
      <div className="absolute right-2 bottom-32 flex flex-col items-center gap-4 z-20">
        <div className="w-10 h-10 rounded-full bg-card border-2 border-white overflow-hidden">
          <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-500" />
        </div>
        <button className="flex flex-col items-center">
          <Heart className="w-8 h-8 text-white" />
          <span className="text-white text-xs">{tiktokData.likes || '12.3K'}</span>
        </button>
        <button className="flex flex-col items-center">
          <MessageCircle className="w-8 h-8 text-white" />
          <span className="text-white text-xs">{tiktokData.comments || '234'}</span>
        </button>
        <button className="flex flex-col items-center">
          <Bookmark className="w-8 h-8 text-white" />
          <span className="text-white text-xs">Save</span>
        </button>
        <button className="flex flex-col items-center">
          <Share2 className="w-8 h-8 text-white" />
          <span className="text-white text-xs">{tiktokData.shares || '56'}</span>
        </button>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-16 left-3 right-16 z-20">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white font-bold">@brand</span>
          <Badge className="bg-card/20 text-white text-[10px] border-0">Sponsored</Badge>
        </div>
        <p className="text-white text-sm mb-2">{tiktokData.caption}</p>
        {tiktokData.hashtags && (
          <p className="text-white text-sm">
            {tiktokData.hashtags.map(t => `#${t}`).join(' ')}
          </p>
        )}
        {tiktokData.soundName && (
          <div className="flex items-center gap-2 mt-2">
            <div className="w-4 h-4 rounded bg-card/20 animate-spin" />
            <span className="text-white text-xs truncate">{tiktokData.soundName}</span>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="absolute bottom-4 left-3 right-3 z-20">
        <button className="w-full py-2.5 bg-[#fe2c55] text-white rounded font-semibold text-sm">
          {data.callToAction || 'Shop Now'}
        </button>
      </div>

      {/* Play button */}
      {!isPlaying && (
        <button
          className="absolute inset-0 flex items-center justify-center z-10"
          onClick={() => setIsPlaying(true)}
        >
          <div className="w-16 h-16 rounded-full bg-card/20 flex items-center justify-center">
            <Play className="w-8 h-8 text-white ml-1" fill="white" />
          </div>
        </button>
      )}
    </div>
  )
}

export type { AdData, Platform, Format }
