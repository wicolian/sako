'use client'

import { useState } from 'react'
import { 
  Instagram, 
  Facebook, 
  Play, 
  Sparkles, 
  Download, 
  Copy, 
  ChevronRight,
  Loader2,
  Image as ImageIcon,
  Film,
  LayoutGrid,
  Clock,
  Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// TikTok icon (custom since lucide doesn't have it)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  )
}

type Platform = 'instagram' | 'facebook' | 'tiktok'
type Format = 'story' | 'reels' | 'carousel' | 'video'

interface AdFormat {
  id: Format
  name: string
  description: string
  icon: React.ReactNode
  dimensions: string
  platforms: Platform[]
}

const AD_FORMATS: AdFormat[] = [
  {
    id: 'story',
    name: 'Story Ad',
    description: '9:16 vertical, 3-5 slides',
    icon: <ImageIcon className="w-5 h-5" />,
    dimensions: '1080x1920',
    platforms: ['instagram', 'facebook'],
  },
  {
    id: 'reels',
    name: 'Reels/Video Ad',
    description: '9:16 vertical, 15-30 seconds',
    icon: <Film className="w-5 h-5" />,
    dimensions: '1080x1920',
    platforms: ['instagram', 'tiktok'],
  },
  {
    id: 'carousel',
    name: 'Carousel Ad',
    description: '1:1 square, 3-10 cards',
    icon: <LayoutGrid className="w-5 h-5" />,
    dimensions: '1080x1080',
    platforms: ['instagram', 'facebook'],
  },
  {
    id: 'video',
    name: 'TikTok Video',
    description: '9:16 vertical, 15-60 seconds',
    icon: <Play className="w-5 h-5" />,
    dimensions: '1080x1920',
    platforms: ['tiktok'],
  },
]

const ARCHETYPES = [
  { id: 'problem-solution', name: 'Problem-Solution' },
  { id: 'testimonial', name: 'Testimonial' },
  { id: 'before-after', name: 'Before & After' },
  { id: 'us-vs-them', name: 'Us vs Them' },
  { id: 'mythbuster', name: 'Mythbuster' },
  { id: 'features', name: 'Features Highlight' },
]

export default function AdsPage() {
  const { toast } = useToast()
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('instagram')
  const [selectedFormat, setSelectedFormat] = useState<Format>('story')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedAds, setGeneratedAds] = useState<any[]>([])

  const [formData, setFormData] = useState({
    productName: '',
    productDescription: '',
    targetAudience: '',
    goal: 'conversions',
    cta: 'Shop Now',
    archetype: 'problem-solution',
    variants: 2,
  })

  const availableFormats = AD_FORMATS.filter((f) =>
    f.platforms.includes(selectedPlatform)
  )

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
    setGeneratedAds([])

    try {
      // Determine API endpoint based on platform and format
      let endpoint = ''
      if (selectedPlatform === 'instagram' && selectedFormat === 'story') {
        endpoint = '/api/ads/instagram/story'
      } else if (selectedPlatform === 'instagram' && selectedFormat === 'reels') {
        endpoint = '/api/ads/instagram/reels'
      } else if (selectedFormat === 'carousel') {
        endpoint = '/api/ads/facebook/carousel'
      } else if (selectedPlatform === 'tiktok') {
        endpoint = '/api/ads/tiktok/video'
      } else {
        // Default to Instagram story for now
        endpoint = '/api/ads/instagram/story'
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign: {
            name: formData.productName,
            audience: formData.targetAudience,
            goal: formData.goal,
            offer: formData.productDescription,
            cta: formData.cta,
          },
          options: {
            variants: formData.variants,
            archetype: formData.archetype,
            tone: 'energetic',
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate ads')
      }

      const data = await response.json()
      setGeneratedAds(data.ads || [])

      toast({
        title: 'Ads generated!',
        description: `Created ${data.ads?.length || 0} ad variant(s)`,
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
        <h1 className="text-3xl font-bold mb-2">Ad Generator</h1>
        <p className="text-muted-foreground">
          Create platform-specific ads for Instagram, Facebook, and TikTok
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
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={selectedPlatform === 'instagram' ? 'default' : 'outline'}
                  className="flex-col h-auto py-4"
                  onClick={() => {
                    setSelectedPlatform('instagram')
                    setSelectedFormat('story')
                  }}
                >
                  <Instagram className="w-6 h-6 mb-1" />
                  <span className="text-xs">Instagram</span>
                </Button>
                <Button
                  variant={selectedPlatform === 'facebook' ? 'default' : 'outline'}
                  className="flex-col h-auto py-4"
                  onClick={() => {
                    setSelectedPlatform('facebook')
                    setSelectedFormat('carousel')
                  }}
                >
                  <Facebook className="w-6 h-6 mb-1" />
                  <span className="text-xs">Facebook</span>
                </Button>
                <Button
                  variant={selectedPlatform === 'tiktok' ? 'default' : 'outline'}
                  className="flex-col h-auto py-4"
                  onClick={() => {
                    setSelectedPlatform('tiktok')
                    setSelectedFormat('video')
                  }}
                >
                  <TikTokIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs">TikTok</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Format Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Ad Format</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {availableFormats.map((format) => (
                <button
                  key={format.id}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                    selectedFormat === format.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => setSelectedFormat(format.id)}
                >
                  {format.icon}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{format.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {format.description}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {format.dimensions}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Product Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input
                  placeholder="e.g., Acme Fitness App"
                  value={formData.productName}
                  onChange={(e) =>
                    setFormData({ ...formData, productName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Description / Key Message</Label>
                <Textarea
                  placeholder="What makes your product special?"
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
                  placeholder="e.g., Busy professionals, ages 25-45"
                  value={formData.targetAudience}
                  onChange={(e) =>
                    setFormData({ ...formData, targetAudience: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Goal</Label>
                  <Select
                    value={formData.goal}
                    onValueChange={(v) => setFormData({ ...formData, goal: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conversions">Conversions</SelectItem>
                      <SelectItem value="awareness">Awareness</SelectItem>
                      <SelectItem value="traffic">Traffic</SelectItem>
                      <SelectItem value="engagement">Engagement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CTA</Label>
                  <Select
                    value={formData.cta}
                    onValueChange={(v) => setFormData({ ...formData, cta: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Shop Now">Shop Now</SelectItem>
                      <SelectItem value="Learn More">Learn More</SelectItem>
                      <SelectItem value="Sign Up">Sign Up</SelectItem>
                      <SelectItem value="Get Started">Get Started</SelectItem>
                      <SelectItem value="Download">Download</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Archetype & Variants */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Content Style</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Content Archetype</Label>
                <Select
                  value={formData.archetype}
                  onValueChange={(v) => setFormData({ ...formData, archetype: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARCHETYPES.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Variants</Label>
                <Select
                  value={String(formData.variants)}
                  onValueChange={(v) =>
                    setFormData({ ...formData, variants: parseInt(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 variant</SelectItem>
                    <SelectItem value="2">2 variants (A/B)</SelectItem>
                    <SelectItem value="3">3 variants</SelectItem>
                  </SelectContent>
                </Select>
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
                Generate Ads
              </>
            )}
          </Button>
        </div>

        {/* Right: Generated Ads */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Generated Ads</CardTitle>
              <CardDescription>
                {generatedAds.length > 0
                  ? `${generatedAds.length} variant(s) generated`
                  : 'Configure your ad and click generate'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {generatedAds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Zap className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-2">No ads generated yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Fill in your product details and click Generate to create
                    platform-optimized ad content.
                  </p>
                </div>
              ) : (
                <Tabs defaultValue="0">
                  <TabsList>
                    {generatedAds.map((ad, idx) => (
                      <TabsTrigger key={idx} value={String(idx)}>
                        Variant {ad.variantLabel || String.fromCharCode(65 + idx)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {generatedAds.map((ad, idx) => (
                    <TabsContent key={idx} value={String(idx)} className="space-y-4">
                      {/* Hook */}
                      {ad.hook && (
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              HOOK (First 3 seconds)
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(ad.hook)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="font-medium">{ad.hook}</p>
                        </div>
                      )}

                      {/* Primary Text */}
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            PRIMARY TEXT
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(ad.primaryText)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p>{ad.primaryText}</p>
                      </div>

                      {/* Script (for video ads) */}
                      {ad.script && (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="px-4 py-2 bg-muted border-b">
                            <span className="text-xs font-medium">VIDEO SCRIPT</span>
                          </div>
                          <div className="divide-y">
                            {ad.script.map((scene: any, sIdx: number) => (
                              <div key={sIdx} className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline">{scene.timestamp}</Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {scene.section || `Scene ${sIdx + 1}`}
                                  </span>
                                </div>
                                <p className="text-sm mb-1">
                                  <strong>Visual:</strong> {scene.visual}
                                </p>
                                <p className="text-sm">
                                  <strong>Audio:</strong> {scene.audio || scene.voiceover}
                                </p>
                                {scene.textOverlay && (
                                  <p className="text-sm mt-1">
                                    <strong>Text:</strong> {scene.textOverlay}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Slides (for story ads) */}
                      {ad.slides && (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="px-4 py-2 bg-muted border-b">
                            <span className="text-xs font-medium">STORY SLIDES</span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 p-4">
                            {ad.slides.map((slide: any, sIdx: number) => (
                              <div
                                key={sIdx}
                                className="aspect-[9/16] bg-muted rounded-lg p-3 flex flex-col justify-between"
                              >
                                <div>
                                  <Badge variant="outline" className="mb-2">
                                    Slide {sIdx + 1}
                                  </Badge>
                                  <p className="text-xs">{slide.textOverlay}</p>
                                </div>
                                {slide.ctaSlide && (
                                  <Badge className="w-fit">CTA Slide</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cards (for carousel) */}
                      {ad.cards && (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="px-4 py-2 bg-muted border-b">
                            <span className="text-xs font-medium">CAROUSEL CARDS</span>
                          </div>
                          <div className="grid grid-cols-4 gap-4 p-4">
                            {ad.cards.map((card: any, cIdx: number) => (
                              <div
                                key={cIdx}
                                className="aspect-square bg-muted rounded-lg p-3 flex flex-col"
                              >
                                <Badge variant="outline" className="mb-2 w-fit">
                                  Card {cIdx + 1}
                                </Badge>
                                <p className="text-sm font-medium">{card.headline}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {card.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hashtags */}
                      {ad.hashtags && ad.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {ad.hashtags.map((tag: string, tIdx: number) => (
                            <Badge key={tIdx} variant="secondary">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* CTA */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div>
                          <span className="text-xs text-muted-foreground">CTA: </span>
                          <span className="font-medium">{ad.callToAction}</span>
                        </div>
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
