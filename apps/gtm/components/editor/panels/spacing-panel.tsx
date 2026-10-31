'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Box, Link2, Unlink2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface SpacingPanelProps {
  padding: {
    top: number
    right: number
    bottom: number
    left: number
  }
  margin: {
    top: number
    right: number
    bottom: number
    left: number
  }
  gap?: number
  onUpdate: (updates: Partial<{
    padding: { top: number; right: number; bottom: number; left: number }
    margin: { top: number; right: number; bottom: number; left: number }
    gap: number
  }>) => void
}

export function SpacingPanel({
  padding,
  margin,
  gap,
  onUpdate,
}: SpacingPanelProps) {
  const [paddingLinked, setPaddingLinked] = useState(
    padding.top === padding.right && 
    padding.right === padding.bottom && 
    padding.bottom === padding.left
  )
  const [marginLinked, setMarginLinked] = useState(
    margin.top === margin.right && 
    margin.right === margin.bottom && 
    margin.bottom === margin.left
  )

  const updatePadding = (key: keyof typeof padding, value: number) => {
    if (paddingLinked) {
      onUpdate({ padding: { top: value, right: value, bottom: value, left: value } })
    } else {
      onUpdate({ padding: { ...padding, [key]: value } })
    }
  }

  const updateMargin = (key: keyof typeof margin, value: number) => {
    if (marginLinked) {
      onUpdate({ margin: { top: value, right: value, bottom: value, left: value } })
    } else {
      onUpdate({ margin: { ...margin, [key]: value } })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Box className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Spacing</span>
      </div>

      {/* Padding */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Padding</Label>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setPaddingLinked(!paddingLinked)}
          >
            {paddingLinked ? (
              <Link2 className="h-3.5 w-3.5" />
            ) : (
              <Unlink2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {paddingLinked ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">All sides</span>
              <span className="text-xs text-muted-foreground">{padding.top}px</span>
            </div>
            <Slider
              value={[padding.top]}
              onValueChange={([v]) => updatePadding('top', v)}
              min={0}
              max={200}
              step={4}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <div key={side} className="space-y-1">
                <Label className="text-[10px] text-muted-foreground capitalize">{side}</Label>
                <Input
                  type="number"
                  value={padding[side]}
                  onChange={(e) => updatePadding(side, parseInt(e.target.value) || 0)}
                  className="h-8 text-xs"
                  min={0}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Margin */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Margin</Label>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setMarginLinked(!marginLinked)}
          >
            {marginLinked ? (
              <Link2 className="h-3.5 w-3.5" />
            ) : (
              <Unlink2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {marginLinked ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">All sides</span>
              <span className="text-xs text-muted-foreground">{margin.top}px</span>
            </div>
            <Slider
              value={[margin.top]}
              onValueChange={([v]) => updateMargin('top', v)}
              min={0}
              max={200}
              step={4}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <div key={side} className="space-y-1">
                <Label className="text-[10px] text-muted-foreground capitalize">{side}</Label>
                <Input
                  type="number"
                  value={margin[side]}
                  onChange={(e) => updateMargin(side, parseInt(e.target.value) || 0)}
                  className="h-8 text-xs"
                  min={0}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gap */}
      {gap !== undefined && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Gap</Label>
            <span className="text-xs text-muted-foreground">{gap}px</span>
          </div>
          <Slider
            value={[gap]}
            onValueChange={([v]) => onUpdate({ gap: v })}
            min={0}
            max={100}
            step={4}
          />
        </div>
      )}

      {/* Visual Spacing Preview */}
      <div className="pt-3 border-t">
        <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
        <div 
          className="relative border rounded bg-muted/30"
          style={{
            padding: `${Math.min(padding.top, 20)}px ${Math.min(padding.right, 20)}px ${Math.min(padding.bottom, 20)}px ${Math.min(padding.left, 20)}px`,
            margin: `${Math.min(margin.top, 10)}px ${Math.min(margin.right, 10)}px ${Math.min(margin.bottom, 10)}px ${Math.min(margin.left, 10)}px`,
          }}
        >
          <div className="absolute inset-0 border-2 border-dashed border-blue-300 opacity-50" />
          <div className="bg-primary/20 rounded p-2 text-center text-[10px] text-muted-foreground">
            Content
          </div>
        </div>
      </div>
    </div>
  )
}
