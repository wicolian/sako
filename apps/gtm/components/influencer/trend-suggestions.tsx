'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp,
  Music2,
  Clock,
  Sparkles,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface TrendSuggestionsProps {
  platform: string
  niche: string
  onSelectTrend?: (trend: string) => void
}

interface Trends {
  trendingFormats: string[]
  trendingTopics: string[]
  trendingSounds: string[]
  recommendedTimes: string[]
}

export function TrendSuggestions({
  platform,
  niche,
  onSelectTrend,
}: TrendSuggestionsProps) {
  const [trends, setTrends] = useState<Trends | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchTrends = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/influencer/trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, niche }),
      })
      if (response.ok) {
        const data = await response.json()
        setTrends(data)
      }
    } catch (error) {
      console.error('Failed to fetch trends:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (platform && niche) {
      fetchTrends()
    }
  }, [platform, niche])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!trends) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Select a platform and enter your niche to see trends
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Trending Now
        </h3>
        <Button variant="ghost" size="sm" onClick={fetchTrends}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Trending Formats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Trending Formats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trends.trendingFormats.map((format, idx) => (
                <TrendItem
                  key={idx}
                  label={format}
                  isHot={idx < 2}
                  onClick={() => onSelectTrend?.(format)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Trending Topics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Trending Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trends.trendingTopics.map((topic, idx) => (
                <TrendItem
                  key={idx}
                  label={topic}
                  isHot={idx < 2}
                  onClick={() => onSelectTrend?.(topic)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Trending Sounds */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Music2 className="h-4 w-4 text-pink-500" />
              Trending Sounds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trends.trendingSounds.map((sound, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm"
                >
                  <Music2 className="h-3 w-3 text-muted-foreground" />
                  {sound}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Best Posting Times */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Best Posting Times
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trends.recommendedTimes.map((time, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-lg text-sm',
                    idx === 0 ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-muted/50'
                  )}
                >
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {time}
                  {idx === 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Best
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TrendItem({
  label,
  isHot,
  onClick,
}: {
  label: string
  isHot?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 p-2 rounded-lg text-sm text-left transition-colors',
        'hover:bg-primary/5',
        isHot ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50'
      )}
    >
      <span className="flex-1">{label}</span>
      {isHot && (
        <Badge variant="default" className="bg-gradient-to-r from-orange-500 to-red-500 text-xs">
          Hot
        </Badge>
      )}
    </button>
  )
}
