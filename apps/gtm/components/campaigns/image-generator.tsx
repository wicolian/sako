'use client'

import { useState } from 'react'
import { 
  Image as ImageIcon, 
  Loader2, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Trash2,
  X,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface GeneratedImage {
  id: string
  url: string
  prompt: string
  enhancedPrompt: string
  style: string
  size: string
}

interface ImageGeneratorProps {
  campaignId?: string
  brandId?: string
  onImageSelect?: (image: GeneratedImage) => void
  className?: string
}

const IMAGE_STYLES = [
  { value: 'photography', label: 'Photography', description: 'Professional photographic style' },
  { value: 'illustration', label: 'Illustration', description: 'Digital artwork style' },
  { value: '3d', label: '3D Render', description: 'Three-dimensional look' },
  { value: 'flat_design', label: 'Flat Design', description: 'Modern 2D style' },
  { value: 'abstract', label: 'Abstract', description: 'Creative and artistic' },
]

const IMAGE_SIZES = [
  { value: '1080x1080', label: 'Square', dimensions: '1080×1080' },
  { value: '1200x628', label: 'Landscape', dimensions: '1200×628' },
  { value: '1080x1920', label: 'Portrait', dimensions: '1080×1920' },
  { value: '1920x1080', label: 'Wide', dimensions: '1920×1080' },
  { value: '800x800', label: 'Small Square', dimensions: '800×800' },
]

export function ImageGenerator({
  campaignId,
  brandId,
  onImageSelect,
  className,
}: ImageGeneratorProps) {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState<string>('corporate')
  const [size, setSize] = useState<string>('square')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const generateImages = async (generateVariations = false) => {
    if (!prompt.trim()) {
      toast({
        title: 'Prompt required',
        description: 'Please enter a description for the image',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          campaignId,
          brandId,
          style,
          dimensions: size,
          negativePrompt: negativePrompt || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Generation failed')
      }

      const data = await response.json()
      
      if (generateVariations && data.images) {
        setGeneratedImages(prev => [...data.images, ...prev])
        toast({
          title: 'Images generated',
          description: `${data.count} variations created`,
        })
      } else if (data.image) {
        setGeneratedImages(prev => [data.image, ...prev])
        toast({
          title: 'Image generated',
          description: 'Your image is ready',
        })
      }
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const selectImage = (image: GeneratedImage) => {
    setSelectedImage(image)
    onImageSelect?.(image)
    toast({
      title: 'Image selected',
      description: 'Image added to your campaign',
    })
  }

  const removeImage = (imageId: string) => {
    setGeneratedImages(prev => prev.filter(img => img.id !== imageId))
    if (selectedImage?.id === imageId) {
      setSelectedImage(null)
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Image Generator
          </CardTitle>
          <CardDescription>
            Generate brand-consistent images for your campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Describe your image</Label>
            <Textarea
              id="prompt"
              placeholder="e.g., A modern office team collaborating around a digital whiteboard, professional atmosphere, natural lighting"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Be specific about subjects, setting, mood, and lighting
            </p>
          </div>

          {/* Style & Size Selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex flex-col">
                        <span>{s.label}</span>
                        <span className="text-xs text-muted-foreground">{s.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Size</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_SIZES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex items-center justify-between gap-2">
                        <span>{s.label}</span>
                        <span className="text-xs text-muted-foreground">{s.dimensions}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Options */}
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-muted-foreground"
            >
              {showAdvanced ? 'Hide' : 'Show'} advanced options
            </Button>
            
            {showAdvanced && (
              <div className="mt-4 space-y-2">
                <Label htmlFor="negative">Negative prompt (what to avoid)</Label>
                <Input
                  id="negative"
                  placeholder="e.g., blurry, distorted, watermark, text"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Generate Buttons */}
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={() => generateImages(false)} 
              disabled={isGenerating || !prompt.trim()}
              className="flex-1"
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate Image
            </Button>
            <Button 
              variant="outline"
              onClick={() => generateImages(true)} 
              disabled={isGenerating || !prompt.trim()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              3 Variations
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Images Grid */}
      {generatedImages.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Generated Images ({generatedImages.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {generatedImages.map((image) => (
              <Card 
                key={image.id} 
                className={cn(
                  "overflow-hidden cursor-pointer transition-all",
                  selectedImage?.id === image.id && "ring-2 ring-primary"
                )}
              >
                <div className="relative aspect-square bg-muted">
                  <img
                    src={image.url}
                    alt={image.prompt}
                    className="object-cover w-full h-full"
                  />
                  {selectedImage?.id === image.id && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {IMAGE_STYLES.find(s => s.value === image.style)?.label || image.style}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {IMAGE_SIZES.find(s => s.value === image.size)?.label || image.size}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {image.prompt}
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="default" 
                      className="flex-1"
                      onClick={() => selectImage(image)}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Use
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => window.open(image.url, '_blank')}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => removeImage(image.id)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {generatedImages.length === 0 && !isGenerating && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-1">No images generated yet</h3>
            <p className="text-sm text-muted-foreground">
              Enter a prompt above to generate your first image
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Compact image generator for inline use
 */
export function InlineImageGenerator({
  onImageSelect,
}: {
  onImageSelect: (url: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Image
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Image</DialogTitle>
          <DialogDescription>
            Create a custom image for your content
          </DialogDescription>
        </DialogHeader>
        <ImageGenerator
          onImageSelect={(image) => {
            onImageSelect(image.url)
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
