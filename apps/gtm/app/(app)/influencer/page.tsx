'use client'

import { useState } from 'react'
import {
  Video,
  Sparkles,
  Loader2,
  Instagram,
  Play,
  Users,
  ShoppingBag,
  Star,
  Repeat2,
  Package,
  TrendingUp,
  LayoutGrid,
  Film,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { UGCPreview } from '@/components/influencer/ugc-preview'
import { TrendSuggestions } from '@/components/influencer/trend-suggestions'
import type { UGCFormat, UGCStyle, UGCGenerationResult } from '@/lib/assets/influencer-generator'

// TikTok icon
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  )
}

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', icon: TikTokIcon },
  { id: 'instagram_reels', label: 'Instagram Reels', icon: Instagram },
  { id: 'instagram_stories', label: 'Instagram Stories', icon: Instagram },
  { id: 'youtube_shorts', label: 'YouTube Shorts', icon: Play },
] as const

const FORMATS: Array<{
  id: UGCFormat
  label: string
  description: string
  icon: React.ElementType
}> = [
  { id: 'talking_head', label: 'Talking Head', description: 'Direct to camera review', icon: Users },
  { id: 'product_review', label: 'Product Review', description: 'Honest review with pros/cons', icon: Star },
  { id: 'before_after', label: 'Before & After', description: 'Transformation showcase', icon: Repeat2 },
  { id: 'unboxing', label: 'Unboxing', description: 'First impressions opening', icon: Package },
  { id: 'trend_jacking', label: 'Trend Jacking', description: 'Ride viral trends', icon: TrendingUp },
  { id: 'carousel', label: 'Carousel', description: 'Multi-slide educational', icon: LayoutGrid },
  { id: 'story_series', label: 'Story Series', description: 'Multi-part narrative', icon: Film },
]

const STYLES: Array<{ id: UGCStyle; label: string; description: string }> = [
  { id: 'authentic', label: 'Authentic', description: 'Natural and relatable' },
  { id: 'polished', label: 'Polished', description: 'High quality but personal' },
  { id: 'raw', label: 'Raw', description: 'Unfiltered and spontaneous' },
  { id: 'aesthetic', label: 'Aesthetic', description: 'Visually pleasing' },
  { id: 'comedic', label: 'Comedic', description: 'Funny and entertaining' },
  { id: 'educational', label: 'Educational', description: 'Informative and clear' },
]

export default function InfluencerPage() {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<UGCGenerationResult | null>(null)

  const [formData, setFormData] = useState({
    productName: '',
    productDescription: '',
    targetAudience: '',
    platform: 'tiktok' as typeof PLATFORMS[number]['id'],
    format: 'talking_head' as UGCFormat,
    style: 'authentic' as UGCStyle,
    duration: 30,
    keyMessages: '',
    trendToJack: '',
    niche: 'general',
  })

  const handleGenerate = async () => {
    if (!formData.productName.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please enter your product name',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    setResult(null)

    try {
      const response = await fetch('/api/influencer/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: formData.productName,
          productDescription: formData.productDescription,
          targetAudience: formData.targetAudience,
          format: formData.format,
          style: formData.style,
          platform: formData.platform,
          duration: formData.duration,
          keyMessages: formData.keyMessages
            ? formData.keyMessages.split('\n').filter(Boolean)
            : undefined,
          trendToJack: formData.trendToJack || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate content')
      }

      const data = await response.json()
      setResult(data)

      toast({
        title: 'Content generated!',
        description: `Created ${formData.format.replace('_', ' ')} script for ${formData.platform}`,
      })
    } catch (error) {
      console.error('Generation error:', error)
      toast({
        title: 'Generation failed',
        description: 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copied to clipboard' })
  }

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Video className="h-8 w-8 text-primary" />
          Influencer Content Generator
        </h1>
        <p className="text-muted-foreground">
          Create authentic UGC-style videos, reels, carousels, and stories
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Configuration */}
        <div className="lg:col-span-1 space-y-6">
          {/* Platform Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Platform</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map((platform) => (
                  <Button
                    key={platform.id}
                    variant={formData.platform === platform.id ? 'default' : 'outline'}
                    className="flex-col h-auto py-3"
                    onClick={() =>
                      setFormData({ ...formData, platform: platform.id })
                    }
                  >
                    <platform.icon className="w-5 h-5 mb-1" />
                    <span className="text-xs">{platform.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Format Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Content Format</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {FORMATS.map((format) => (
                <button
                  key={format.id}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                    formData.format === format.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => setFormData({ ...formData, format: format.id })}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    formData.format === format.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>
                    <format.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{format.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {format.description}
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Product Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input
                  placeholder="e.g., Acme Skincare Serum"
                  value={formData.productName}
                  onChange={(e) =>
                    setFormData({ ...formData, productName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Description / Key Benefits</Label>
                <Textarea
                  placeholder="What makes this product special?"
                  value={formData.productDescription}
                  onChange={(e) =>
                    setFormData({ ...formData, productDescription: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <Input
                  placeholder="e.g., Women 25-35 interested in skincare"
                  value={formData.targetAudience}
                  onChange={(e) =>
                    setFormData({ ...formData, targetAudience: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Niche (for trends)</Label>
                <Input
                  placeholder="e.g., beauty, fitness, tech"
                  value={formData.niche}
                  onChange={(e) =>
                    setFormData({ ...formData, niche: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Style & Options */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Style</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Content Style</Label>
                <Select
                  value={formData.style}
                  onValueChange={(v) =>
                    setFormData({ ...formData, style: v as UGCStyle })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map((style) => (
                      <SelectItem key={style.id} value={style.id}>
                        <div>
                          <div className="font-medium">{style.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {style.description}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (seconds)</Label>
                <Select
                  value={String(formData.duration)}
                  onValueChange={(v) =>
                    setFormData({ ...formData, duration: parseInt(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 seconds</SelectItem>
                    <SelectItem value="30">30 seconds</SelectItem>
                    <SelectItem value="45">45 seconds</SelectItem>
                    <SelectItem value="60">60 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Key Messages (one per line)</Label>
                <Textarea
                  placeholder="e.g.&#10;Hydrates for 24 hours&#10;Dermatologist approved&#10;Only $29"
                  value={formData.keyMessages}
                  onChange={(e) =>
                    setFormData({ ...formData, keyMessages: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Trend to Jack (optional)</Label>
                <Input
                  placeholder="e.g., Get ready with me trend"
                  value={formData.trendToJack}
                  onChange={(e) =>
                    setFormData({ ...formData, trendToJack: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Content
              </>
            )}
          </Button>
        </div>

        {/* Right: Preview & Trends */}
        <div className="lg:col-span-2 space-y-6">
          {/* Generated Content */}
          {result ? (
            <Card>
              <CardHeader>
                <CardTitle>Generated Content</CardTitle>
                <CardDescription>
                  {result.format.replace('_', ' ')} for {result.platform}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UGCPreview result={result} onCopy={copyToClipboard} />
              </CardContent>
            </Card>
          ) : (
            <Card className="min-h-[400px] flex items-center justify-center">
              <CardContent className="text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 mx-auto">
                  <Video className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-2">No content generated yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Fill in your product details and click Generate to create
                  authentic UGC-style content scripts.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Trend Suggestions */}
          <TrendSuggestions
            platform={formData.platform}
            niche={formData.niche || 'general'}
            onSelectTrend={(trend) =>
              setFormData({ ...formData, trendToJack: trend })
            }
          />
        </div>
      </div>
    </div>
  )
}
