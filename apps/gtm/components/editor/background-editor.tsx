'use client'

/**
 * Background Editor Component
 * 
 * Configure section backgrounds with images, videos, gradients,
 * blend modes, and mask shapes.
 */

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Image as ImageIcon,
  Video,
  Palette,
  Layers,
  Circle,
  Square,
  Triangle,
  Hexagon,
  X,
  Upload,
  Link,
  Play,
  Pause,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImagePicker, SelectedImage } from '@/components/ui/image-picker'
import { cn } from '@/lib/utils'

export interface BackgroundConfig {
  type: 'none' | 'color' | 'gradient' | 'image' | 'video'
  color?: string
  gradient?: {
    type: 'linear' | 'radial'
    angle?: number
    stops: Array<{ color: string; position: number }>
  }
  image?: {
    url: string
    position: 'center' | 'top' | 'bottom' | 'left' | 'right'
    size: 'cover' | 'contain' | 'auto' | string
    repeat: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y'
    attachment: 'scroll' | 'fixed'
  }
  video?: {
    url: string
    loop: boolean
    muted: boolean
    autoplay: boolean
    poster?: string
  }
  overlay?: {
    enabled: boolean
    color: string
    opacity: number
    blendMode: BlendMode
  }
  mask?: {
    shape: MaskShape
    enabled: boolean
  }
}

type BlendMode = 
  | 'normal' | 'multiply' | 'screen' | 'overlay' 
  | 'darken' | 'lighten' | 'color-dodge' | 'color-burn'
  | 'hard-light' | 'soft-light' | 'difference' | 'exclusion'

type MaskShape = 'none' | 'circle' | 'ellipse' | 'triangle' | 'hexagon' | 'wave'

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
]

const MASK_SHAPES: { value: MaskShape; label: string; icon: typeof Circle }[] = [
  { value: 'none', label: 'None', icon: Square },
  { value: 'circle', label: 'Circle', icon: Circle },
  { value: 'ellipse', label: 'Ellipse', icon: Circle },
  { value: 'triangle', label: 'Triangle', icon: Triangle },
  { value: 'hexagon', label: 'Hexagon', icon: Hexagon },
]

const PRESET_GRADIENTS = [
  { name: 'Sunset', stops: [{ color: '#f97316', position: 0 }, { color: '#ec4899', position: 100 }] },
  { name: 'Ocean', stops: [{ color: '#0ea5e9', position: 0 }, { color: '#6366f1', position: 100 }] },
  { name: 'Forest', stops: [{ color: '#22c55e', position: 0 }, { color: '#14532d', position: 100 }] },
  { name: 'Night', stops: [{ color: '#1e1b4b', position: 0 }, { color: '#0f172a', position: 100 }] },
  { name: 'Aurora', stops: [{ color: '#06b6d4', position: 0 }, { color: '#8b5cf6', position: 50 }, { color: '#ec4899', position: 100 }] },
]

interface BackgroundEditorProps {
  config: BackgroundConfig
  onChange: (config: BackgroundConfig) => void
  className?: string
}

export function BackgroundEditor({
  config,
  onChange,
  className,
}: BackgroundEditorProps) {
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState(config.video?.url || '')

  const updateConfig = useCallback((updates: Partial<BackgroundConfig>) => {
    onChange({ ...config, ...updates })
  }, [config, onChange])

  const handleImageSelect = useCallback((image: SelectedImage) => {
    updateConfig({
      type: 'image',
      image: {
        url: image.url,
        position: 'center',
        size: 'cover',
        repeat: 'no-repeat',
        attachment: 'scroll',
      },
    })
  }, [updateConfig])

  const handleVideoSubmit = useCallback(() => {
    if (videoUrl.trim()) {
      updateConfig({
        type: 'video',
        video: {
          url: videoUrl.trim(),
          loop: true,
          muted: true,
          autoplay: true,
        },
      })
    }
  }, [videoUrl, updateConfig])

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2 pb-2 border-b">
        <Layers className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Background</span>
      </div>

      <Tabs value={config.type} onValueChange={(v) => updateConfig({ type: v as BackgroundConfig['type'] })}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="none" className="text-xs">None</TabsTrigger>
          <TabsTrigger value="color" className="text-xs">Color</TabsTrigger>
          <TabsTrigger value="gradient" className="text-xs">Gradient</TabsTrigger>
          <TabsTrigger value="image" className="text-xs">Image</TabsTrigger>
          <TabsTrigger value="video" className="text-xs">Video</TabsTrigger>
        </TabsList>

        {/* Color Tab */}
        <TabsContent value="color" className="space-y-3 mt-4">
          <Label className="text-xs">Background Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={config.color || '#ffffff'}
              onChange={(e) => updateConfig({ color: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={config.color || '#ffffff'}
              onChange={(e) => updateConfig({ color: e.target.value })}
              className="flex-1 font-mono text-xs"
              placeholder="#ffffff"
            />
          </div>
        </TabsContent>

        {/* Gradient Tab */}
        <TabsContent value="gradient" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="text-xs">Presets</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_GRADIENTS.map((preset) => (
                <button
                  key={preset.name}
                  className="h-8 w-16 rounded border hover:ring-2 ring-primary transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${preset.stops.map(s => `${s.color} ${s.position}%`).join(', ')})`,
                  }}
                  onClick={() => updateConfig({
                    gradient: {
                      type: 'linear',
                      angle: 135,
                      stops: preset.stops,
                    },
                  })}
                  title={preset.name}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Type</Label>
              <Select
                value={config.gradient?.type || 'linear'}
                onValueChange={(v) => updateConfig({
                  gradient: { ...config.gradient!, type: v as 'linear' | 'radial' },
                })}
              >
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Linear</SelectItem>
                  <SelectItem value="radial">Radial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {config.gradient?.type === 'linear' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Angle</Label>
                <span className="text-xs text-muted-foreground">{config.gradient?.angle || 0}°</span>
              </div>
              <Slider
                value={[config.gradient?.angle || 0]}
                onValueChange={([v]) => updateConfig({
                  gradient: { ...config.gradient!, angle: v },
                })}
                min={0}
                max={360}
                step={15}
              />
            </div>
          )}

          {/* Color stops */}
          <div className="space-y-2">
            <Label className="text-xs">Colors</Label>
            <div className="space-y-2">
              {(config.gradient?.stops || [{ color: '#000000', position: 0 }, { color: '#ffffff', position: 100 }]).map((stop, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={stop.color}
                    onChange={(e) => {
                      const stops = [...(config.gradient?.stops || [])]
                      stops[index] = { ...stops[index], color: e.target.value }
                      updateConfig({ gradient: { ...config.gradient!, stops } })
                    }}
                    className="w-10 h-8 p-1 cursor-pointer"
                  />
                  <Input
                    type="number"
                    value={stop.position}
                    onChange={(e) => {
                      const stops = [...(config.gradient?.stops || [])]
                      stops[index] = { ...stops[index], position: parseInt(e.target.value) || 0 }
                      updateConfig({ gradient: { ...config.gradient!, stops } })
                    }}
                    className="w-16 h-8 text-xs"
                    min={0}
                    max={100}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Image Tab */}
        <TabsContent value="image" className="space-y-4 mt-4">
          {config.image?.url ? (
            <div className="space-y-3">
              <div className="relative aspect-video rounded-lg overflow-hidden border">
                <img
                  src={config.image.url}
                  alt="Background"
                  className="w-full h-full object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => updateConfig({ type: 'none', image: undefined })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Position</Label>
                  <Select
                    value={config.image.position}
                    onValueChange={(v) => updateConfig({
                      image: { ...config.image!, position: v as NonNullable<BackgroundConfig['image']>['position'] },
                    })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="top">Top</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px]">Size</Label>
                  <Select
                    value={config.image.size}
                    onValueChange={(v) => updateConfig({
                      image: { ...config.image!, size: v },
                    })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cover">Cover</SelectItem>
                      <SelectItem value="contain">Contain</SelectItem>
                      <SelectItem value="auto">Auto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Fixed on scroll</Label>
                <Switch
                  checked={config.image.attachment === 'fixed'}
                  onCheckedChange={(checked) => updateConfig({
                    image: { ...config.image!, attachment: checked ? 'fixed' : 'scroll' },
                  })}
                />
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full h-24 border-dashed"
              onClick={() => setImagePickerOpen(true)}
            >
              <div className="flex flex-col items-center gap-2">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm">Choose Image</span>
              </div>
            </Button>
          )}
        </TabsContent>

        {/* Video Tab */}
        <TabsContent value="video" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="text-xs">Video URL</Label>
            <div className="flex gap-2">
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
                className="text-xs"
              />
              <Button size="sm" onClick={handleVideoSubmit}>
                Add
              </Button>
            </div>
          </div>

          {config.video?.url && (
            <div className="space-y-3">
              <div className="relative aspect-video rounded-lg overflow-hidden border bg-black">
                <video
                  src={config.video.url}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  autoPlay
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => updateConfig({ type: 'none', video: undefined })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Loop</Label>
                  <Switch
                    checked={config.video.loop}
                    onCheckedChange={(checked) => updateConfig({
                      video: { ...config.video!, loop: checked },
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Autoplay</Label>
                  <Switch
                    checked={config.video.autoplay}
                    onCheckedChange={(checked) => updateConfig({
                      video: { ...config.video!, autoplay: checked },
                    })}
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Overlay Section */}
      {config.type !== 'none' && (
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Color Overlay</Label>
            <Switch
              checked={config.overlay?.enabled}
              onCheckedChange={(checked) => updateConfig({
                overlay: {
                  ...config.overlay,
                  enabled: checked,
                  color: config.overlay?.color || '#000000',
                  opacity: config.overlay?.opacity ?? 50,
                  blendMode: config.overlay?.blendMode || 'normal',
                },
              })}
            />
          </div>

          {config.overlay?.enabled && (
            <div className="space-y-3 pl-2">
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={config.overlay.color}
                  onChange={(e) => updateConfig({
                    overlay: { ...config.overlay!, color: e.target.value },
                  })}
                  className="w-12 h-8 p-1 cursor-pointer"
                />
                <Input
                  value={config.overlay.color}
                  onChange={(e) => updateConfig({
                    overlay: { ...config.overlay!, color: e.target.value },
                  })}
                  className="flex-1 font-mono text-xs h-8"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px]">Opacity</Label>
                  <span className="text-[10px] text-muted-foreground">{config.overlay.opacity}%</span>
                </div>
                <Slider
                  value={[config.overlay.opacity]}
                  onValueChange={([v]) => updateConfig({
                    overlay: { ...config.overlay!, opacity: v },
                  })}
                  min={0}
                  max={100}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px]">Blend Mode</Label>
                <Select
                  value={config.overlay.blendMode}
                  onValueChange={(v) => updateConfig({
                    overlay: { ...config.overlay!, blendMode: v as BlendMode },
                  })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLEND_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mask Shape */}
      {(config.type === 'image' || config.type === 'video') && (
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Mask Shape</Label>
            <Switch
              checked={config.mask?.enabled}
              onCheckedChange={(checked) => updateConfig({
                mask: {
                  enabled: checked,
                  shape: config.mask?.shape || 'none',
                },
              })}
            />
          </div>

          {config.mask?.enabled && (
            <div className="flex gap-1">
              {MASK_SHAPES.map((shape) => {
                const Icon = shape.icon
                return (
                  <Button
                    key={shape.value}
                    variant={config.mask?.shape === shape.value ? 'secondary' : 'outline'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateConfig({
                      mask: { ...config.mask!, shape: shape.value },
                    })}
                    title={shape.label}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <ImagePicker
        open={imagePickerOpen}
        onOpenChange={setImagePickerOpen}
        onSelect={handleImageSelect}
      />
    </div>
  )
}
