'use client'

/**
 * Image Remix Component
 * 
 * Generate AI variations of an existing image with style transfer options.
 */

import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  RefreshCw,
  Loader2,
  Check,
  X,
  Wand2,
  Palette,
  Sun,
  Moon,
  Contrast,
  Crop,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ImageRemixProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  onSelect: (imageUrl: string) => void
}

interface RemixStyle {
  id: string
  name: string
  icon: typeof Sparkles
  prompt: string
}

const REMIX_STYLES: RemixStyle[] = [
  { id: 'enhance', name: 'Enhance', icon: Sparkles, prompt: 'Enhance the image quality and colors' },
  { id: 'vibrant', name: 'Vibrant', icon: Sun, prompt: 'Make colors more vibrant and saturated' },
  { id: 'muted', name: 'Muted', icon: Moon, prompt: 'Apply muted, desaturated tones' },
  { id: 'warm', name: 'Warm', icon: Palette, prompt: 'Apply warm color grading' },
  { id: 'cool', name: 'Cool', icon: Palette, prompt: 'Apply cool color grading' },
  { id: 'dramatic', name: 'Dramatic', icon: Contrast, prompt: 'Add dramatic contrast and shadows' },
  { id: 'minimal', name: 'Minimal', icon: Crop, prompt: 'Simplify and clean up the composition' },
]

interface Variation {
  id: string
  url: string
  style: string
  selected: boolean
}

export function ImageRemix({
  open,
  onOpenChange,
  imageUrl,
  onSelect,
}: ImageRemixProps) {
  const [selectedStyle, setSelectedStyle] = useState<string>('enhance')
  const [customPrompt, setCustomPrompt] = useState('')
  const [variationCount, setVariationCount] = useState(4)
  const [variations, setVariations] = useState<Variation[]>([])
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null)

  // Generate variations mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const style = REMIX_STYLES.find(s => s.id === selectedStyle)
      const prompt = customPrompt.trim() || style?.prompt || 'Create variations'

      const response = await fetch('/api/images/remix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          prompt,
          style: selectedStyle,
          count: variationCount,
        }),
      })

      if (!response.ok) throw new Error('Failed to generate variations')
      return response.json()
    },
    onSuccess: (data) => {
      const newVariations: Variation[] = data.variations.map((url: string, index: number) => ({
        id: `var-${Date.now()}-${index}`,
        url,
        style: selectedStyle,
        selected: false,
      }))
      setVariations(newVariations)
      toast.success(`Generated ${newVariations.length} variations`)
    },
    onError: () => {
      toast.error('Failed to generate variations')
    },
  })

  const handleSelect = useCallback(() => {
    if (selectedVariation) {
      const variation = variations.find(v => v.id === selectedVariation)
      if (variation) {
        onSelect(variation.url)
        onOpenChange(false)
      }
    }
  }, [selectedVariation, variations, onSelect, onOpenChange])

  const handleDownload = useCallback(async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `remix-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(downloadUrl)
    } catch {
      toast.error('Failed to download image')
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Image Remix
          </DialogTitle>
          <DialogDescription>
            Generate AI variations of your image with different styles
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 flex-1 overflow-hidden">
          {/* Left Panel - Original & Controls */}
          <div className="w-80 flex flex-col gap-4">
            {/* Original Image */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Original</Label>
              <div className="relative aspect-video rounded-lg overflow-hidden border">
                <img
                  src={imageUrl}
                  alt="Original"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Style Selection */}
            <div className="space-y-2">
              <Label>Style</Label>
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMIX_STYLES.map((style) => {
                    const Icon = style.icon
                    return (
                      <SelectItem key={style.id} value={style.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {style.name}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Prompt */}
            <div className="space-y-2">
              <Label>Custom Instructions (optional)</Label>
              <Textarea
                placeholder="Add specific instructions for the remix..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Variation Count */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Variations</Label>
                <Badge variant="secondary">{variationCount}</Badge>
              </div>
              <Slider
                value={[variationCount]}
                onValueChange={([v]) => setVariationCount(v)}
                min={1}
                max={4}
                step={1}
              />
            </div>

            {/* Generate Button */}
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="w-full"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Variations
                </>
              )}
            </Button>
          </div>

          {/* Right Panel - Variations */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-muted-foreground">
                {variations.length > 0 ? `${variations.length} Variations` : 'Variations will appear here'}
              </Label>
              {variations.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1">
              {generateMutation.isPending ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <motion.div
                    className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="h-8 w-8 text-primary" />
                  </motion.div>
                  <p className="text-sm text-muted-foreground">Creating variations...</p>
                </div>
              ) : variations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Wand2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">
                    Select a style and click "Generate Variations" to create AI remixes
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <AnimatePresence mode="popLayout">
                    {variations.map((variation, index) => (
                      <motion.div
                        key={variation.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: index * 0.1 }}
                        className={cn(
                          'relative aspect-video rounded-lg overflow-hidden border-2 cursor-pointer group transition-all',
                          selectedVariation === variation.id
                            ? 'border-primary ring-2 ring-primary/20'
                            : 'border-transparent hover:border-primary/50'
                        )}
                        onClick={() => setSelectedVariation(variation.id)}
                      >
                        <img
                          src={variation.url}
                          alt={`Variation ${index + 1}`}
                          className="w-full h-full object-cover"
                        />

                        {/* Selection indicator */}
                        {selectedVariation === variation.id && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center"
                          >
                            <Check className="h-4 w-4 text-white" />
                          </motion.div>
                        )}

                        {/* Hover actions */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownload(variation.url)
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Style badge */}
                        <Badge
                          variant="secondary"
                          className="absolute bottom-2 left-2 text-[10px]"
                        >
                          {REMIX_STYLES.find(s => s.id === variation.style)?.name}
                        </Badge>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>

            {/* Action Buttons */}
            {variations.length > 0 && (
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSelect}
                  disabled={!selectedVariation}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Use Selected
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
