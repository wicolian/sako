'use client'

import { useState, useEffect } from 'react'
import { Pipette, Plus, X, Check } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ColorPanelProps {
  value: string
  onChange: (color: string) => void
  brandColors?: string[]
  recentColors?: string[]
  onRecentColorAdd?: (color: string) => void
}

const DEFAULT_COLORS = [
  '#000000', '#ffffff', '#f3f4f6', '#e5e7eb', '#d1d5db',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e',
]

export function ColorPanel({
  value,
  onChange,
  brandColors = [],
  recentColors = [],
  onRecentColorAdd,
}: ColorPanelProps) {
  const [inputValue, setInputValue] = useState(value)
  const [showCustomInput, setShowCustomInput] = useState(false)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  const handleColorSelect = (color: string) => {
    onChange(color)
    onRecentColorAdd?.(color)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    
    // Validate hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      onChange(newValue)
      onRecentColorAdd?.(newValue)
    }
  }

  const isSelected = (color: string) => 
    color.toLowerCase() === value.toLowerCase()

  return (
    <div className="space-y-4">
      {/* Current Color */}
      <div className="space-y-2">
        <Label className="text-xs">Current Color</Label>
        <div className="flex gap-2">
          <div
            className="w-12 h-10 rounded border-2 border-border shadow-inner"
            style={{ backgroundColor: value }}
          />
          <Input
            value={inputValue}
            onChange={handleInputChange}
            className="flex-1 font-mono text-sm uppercase"
            placeholder="#000000"
          />
          <input
            type="color"
            value={value}
            onChange={(e) => handleColorSelect(e.target.value)}
            className="w-10 h-10 rounded border cursor-pointer"
          />
        </div>
      </div>

      {/* Brand Colors */}
      {brandColors.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Brand Colors</Label>
          <div className="flex flex-wrap gap-2">
            {brandColors.map((color) => (
              <button
                key={color}
                className={cn(
                  'w-8 h-8 rounded border-2 transition-all',
                  isSelected(color)
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:scale-110'
                )}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
                title={color}
              >
                {isSelected(color) && (
                  <Check
                    className={cn(
                      'w-4 h-4 mx-auto',
                      isLightColor(color) ? 'text-foreground' : 'text-white'
                    )}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Colors */}
      {recentColors.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Recent</Label>
          <div className="flex flex-wrap gap-2">
            {recentColors.slice(0, 8).map((color, idx) => (
              <button
                key={`${color}-${idx}`}
                className={cn(
                  'w-6 h-6 rounded border transition-all',
                  isSelected(color)
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:scale-110'
                )}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Default Palette */}
      <div className="space-y-2">
        <Label className="text-xs">Palette</Label>
        <div className="grid grid-cols-11 gap-1">
          {DEFAULT_COLORS.map((color) => (
            <button
              key={color}
              className={cn(
                'w-6 h-6 rounded border transition-all',
                isSelected(color)
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:scale-110'
              )}
              style={{ backgroundColor: color }}
              onClick={() => handleColorSelect(color)}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Opacity */}
      <div className="space-y-2">
        <Label className="text-xs">Quick Adjustments</Label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleColorSelect(lightenColor(value, 10))}
          >
            Lighten
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleColorSelect(darkenColor(value, 10))}
          >
            Darken
          </Button>
        </div>
      </div>
    </div>
  )
}

// Utility functions
function isLightColor(color: string): boolean {
  const hex = color.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128
}

function lightenColor(color: string, percent: number): string {
  const hex = color.replace('#', '')
  const r = Math.min(255, Math.round(parseInt(hex.substr(0, 2), 16) * (1 + percent / 100)))
  const g = Math.min(255, Math.round(parseInt(hex.substr(2, 2), 16) * (1 + percent / 100)))
  const b = Math.min(255, Math.round(parseInt(hex.substr(4, 2), 16) * (1 + percent / 100)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function darkenColor(color: string, percent: number): string {
  const hex = color.replace('#', '')
  const r = Math.max(0, Math.round(parseInt(hex.substr(0, 2), 16) * (1 - percent / 100)))
  const g = Math.max(0, Math.round(parseInt(hex.substr(2, 2), 16) * (1 - percent / 100)))
  const b = Math.max(0, Math.round(parseInt(hex.substr(4, 2), 16) * (1 - percent / 100)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export default ColorPanel
