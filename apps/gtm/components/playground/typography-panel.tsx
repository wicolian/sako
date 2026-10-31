'use client'

import { useState } from 'react'
import { Type, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface TypographyValues {
  fontFamily?: string
  fontSize?: number
  fontWeight?: string
  fontStyle?: string
  textDecoration?: string
  textAlign?: string
  lineHeight?: number
  letterSpacing?: number
  color?: string
}

interface TypographyPanelProps {
  value: TypographyValues
  onChange: (values: TypographyValues) => void
  brandFonts?: string[]
}

const FONT_FAMILIES = [
  { value: 'system-ui', label: 'System' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Merriweather', label: 'Merriweather' },
  { value: 'Georgia', label: 'Georgia' },
]

const FONT_WEIGHTS = [
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra Bold' },
]

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96]

export function TypographyPanel({ value, onChange, brandFonts = [] }: TypographyPanelProps) {
  const updateValue = (updates: Partial<TypographyValues>) => {
    onChange({ ...value, ...updates })
  }

  const allFonts = [
    ...brandFonts.map((f) => ({ value: f, label: f + ' (Brand)' })),
    ...FONT_FAMILIES,
  ]

  return (
    <div className="space-y-4">
      {/* Font Family */}
      <div className="space-y-2">
        <Label className="text-xs">Font Family</Label>
        <Select
          value={value.fontFamily || 'system-ui'}
          onValueChange={(v) => updateValue({ fontFamily: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allFonts.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontFamily: font.value }}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Font Size & Weight Row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label className="text-xs">Size</Label>
          <Select
            value={String(value.fontSize || 16)}
            onValueChange={(v) => updateValue({ fontSize: parseInt(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Weight</Label>
          <Select
            value={value.fontWeight || '400'}
            onValueChange={(v) => updateValue({ fontWeight: v })}
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
      </div>

      {/* Style Toggles */}
      <div className="space-y-2">
        <Label className="text-xs">Style</Label>
        <div className="flex gap-1">
          <Button
            variant={value.fontWeight === '700' ? 'default' : 'outline'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() =>
              updateValue({ fontWeight: value.fontWeight === '700' ? '400' : '700' })
            }
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            variant={value.fontStyle === 'italic' ? 'default' : 'outline'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() =>
              updateValue({ fontStyle: value.fontStyle === 'italic' ? 'normal' : 'italic' })
            }
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            variant={value.textDecoration === 'underline' ? 'default' : 'outline'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() =>
              updateValue({
                textDecoration: value.textDecoration === 'underline' ? 'none' : 'underline',
              })
            }
          >
            <Underline className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Text Alignment */}
      <div className="space-y-2">
        <Label className="text-xs">Alignment</Label>
        <div className="flex gap-1">
          <Button
            variant={value.textAlign === 'left' || !value.textAlign ? 'default' : 'outline'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => updateValue({ textAlign: 'left' })}
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button
            variant={value.textAlign === 'center' ? 'default' : 'outline'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => updateValue({ textAlign: 'center' })}
          >
            <AlignCenter className="w-4 h-4" />
          </Button>
          <Button
            variant={value.textAlign === 'right' ? 'default' : 'outline'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => updateValue({ textAlign: 'right' })}
          >
            <AlignRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Line Height */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="text-xs">Line Height</Label>
          <span className="text-xs text-muted-foreground">
            {(value.lineHeight || 1.5).toFixed(1)}
          </span>
        </div>
        <Slider
          value={[(value.lineHeight || 1.5) * 10]}
          min={10}
          max={30}
          step={1}
          onValueChange={([v]) => updateValue({ lineHeight: v / 10 })}
        />
      </div>

      {/* Letter Spacing */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="text-xs">Letter Spacing</Label>
          <span className="text-xs text-muted-foreground">
            {value.letterSpacing || 0}px
          </span>
        </div>
        <Slider
          value={[value.letterSpacing || 0]}
          min={-2}
          max={10}
          step={0.5}
          onValueChange={([v]) => updateValue({ letterSpacing: v })}
        />
      </div>

      {/* Text Color */}
      <div className="space-y-2">
        <Label className="text-xs">Color</Label>
        <div className="flex gap-2">
          <input
            type="color"
            className="w-10 h-10 rounded border cursor-pointer"
            value={value.color || '#000000'}
            onChange={(e) => updateValue({ color: e.target.value })}
          />
          <Input
            value={value.color || '#000000'}
            onChange={(e) => updateValue({ color: e.target.value })}
            className="flex-1 font-mono text-sm"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="pt-2 border-t">
        <Label className="text-xs mb-2 block">Preview</Label>
        <div
          className="p-3 bg-muted rounded-md min-h-[60px]"
          style={{
            fontFamily: value.fontFamily || 'system-ui',
            fontSize: `${value.fontSize || 16}px`,
            fontWeight: value.fontWeight || '400',
            fontStyle: value.fontStyle || 'normal',
            textDecoration: value.textDecoration || 'none',
            textAlign: (value.textAlign as 'left' | 'center' | 'right') || 'left',
            lineHeight: value.lineHeight || 1.5,
            letterSpacing: `${value.letterSpacing || 0}px`,
            color: value.color || '#000000',
          }}
        >
          The quick brown fox jumps over the lazy dog.
        </div>
      </div>
    </div>
  )
}

export default TypographyPanel
