'use client'

import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Type, Bold, Italic, Underline } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TypographyPanelProps {
  fontFamily: string
  fontSize: number
  fontWeight: string
  lineHeight: number
  letterSpacing: number
  textTransform: string
  onUpdate: (updates: Partial<{
    fontFamily: string
    fontSize: number
    fontWeight: string
    lineHeight: number
    letterSpacing: number
    textTransform: string
  }>) => void
}

const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro' },
  { value: 'Raleway', label: 'Raleway' },
  { value: 'Merriweather', label: 'Merriweather' },
]

const FONT_WEIGHTS = [
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi Bold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra Bold' },
]

const TEXT_TRANSFORMS = [
  { value: 'none', label: 'None' },
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'lowercase', label: 'lowercase' },
  { value: 'capitalize', label: 'Capitalize' },
]

export function TypographyPanel({
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textTransform,
  onUpdate,
}: TypographyPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Type className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Typography</span>
      </div>

      {/* Font Family */}
      <div className="space-y-2">
        <Label className="text-xs">Font Family</Label>
        <Select
          value={fontFamily}
          onValueChange={(v) => onUpdate({ fontFamily: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontFamily: font.value }}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Font Size */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Font Size</Label>
          <span className="text-xs text-muted-foreground">{fontSize}px</span>
        </div>
        <Slider
          value={[fontSize]}
          onValueChange={([v]) => onUpdate({ fontSize: v })}
          min={10}
          max={96}
          step={1}
        />
      </div>

      {/* Font Weight */}
      <div className="space-y-2">
        <Label className="text-xs">Font Weight</Label>
        <Select
          value={fontWeight}
          onValueChange={(v) => onUpdate({ fontWeight: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_WEIGHTS.map((weight) => (
              <SelectItem key={weight.value} value={weight.value}>
                {weight.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Line Height */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Line Height</Label>
          <span className="text-xs text-muted-foreground">{lineHeight.toFixed(1)}</span>
        </div>
        <Slider
          value={[lineHeight * 100]}
          onValueChange={([v]) => onUpdate({ lineHeight: v / 100 })}
          min={100}
          max={250}
          step={10}
        />
      </div>

      {/* Letter Spacing */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Letter Spacing</Label>
          <span className="text-xs text-muted-foreground">{letterSpacing}px</span>
        </div>
        <Slider
          value={[letterSpacing]}
          onValueChange={([v]) => onUpdate({ letterSpacing: v })}
          min={-2}
          max={10}
          step={0.5}
        />
      </div>

      {/* Text Transform */}
      <div className="space-y-2">
        <Label className="text-xs">Text Transform</Label>
        <Select
          value={textTransform}
          onValueChange={(v) => onUpdate({ textTransform: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEXT_TRANSFORMS.map((transform) => (
              <SelectItem key={transform.value} value={transform.value}>
                {transform.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
