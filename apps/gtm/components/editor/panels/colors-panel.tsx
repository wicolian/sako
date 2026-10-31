'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Palette, Plus, Trash2, Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ColorsPanelProps {
  primaryColor: string
  secondaryColor?: string
  accentColor?: string
  backgroundColor?: string
  textColor?: string
  colorScheme: 'light' | 'dark' | 'auto'
  onUpdate: (updates: Partial<{
    primaryColor: string
    secondaryColor: string
    accentColor: string
    backgroundColor: string
    textColor: string
    colorScheme: 'light' | 'dark' | 'auto'
  }>) => void
}

const PRESET_PALETTES = [
  {
    name: 'Indigo',
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#f59e0b',
  },
  {
    name: 'Emerald',
    primary: '#10b981',
    secondary: '#14b8a6',
    accent: '#f59e0b',
  },
  {
    name: 'Rose',
    primary: '#f43f5e',
    secondary: '#ec4899',
    accent: '#f59e0b',
  },
  {
    name: 'Blue',
    primary: '#3b82f6',
    secondary: '#0ea5e9',
    accent: '#f59e0b',
  },
  {
    name: 'Orange',
    primary: '#f97316',
    secondary: '#fb923c',
    accent: '#6366f1',
  },
  {
    name: 'Slate',
    primary: '#475569',
    secondary: '#64748b',
    accent: '#6366f1',
  },
]

export function ColorsPanel({
  primaryColor,
  secondaryColor,
  accentColor,
  backgroundColor,
  textColor,
  colorScheme,
  onUpdate,
}: ColorsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Palette className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Colors</span>
      </div>

      {/* Color Scheme Toggle */}
      <div className="space-y-2">
        <Label className="text-xs">Color Scheme</Label>
        <div className="flex gap-1">
          <Button
            variant={colorScheme === 'light' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => onUpdate({ colorScheme: 'light' })}
          >
            <Sun className="h-3.5 w-3.5" />
            Light
          </Button>
          <Button
            variant={colorScheme === 'dark' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => onUpdate({ colorScheme: 'dark' })}
          >
            <Moon className="h-3.5 w-3.5" />
            Dark
          </Button>
        </div>
      </div>

      {/* Preset Palettes */}
      <div className="space-y-2">
        <Label className="text-xs">Presets</Label>
        <div className="grid grid-cols-3 gap-2">
          {PRESET_PALETTES.map((palette) => (
            <button
              key={palette.name}
              onClick={() => onUpdate({
                primaryColor: palette.primary,
                secondaryColor: palette.secondary,
                accentColor: palette.accent,
              })}
              className={cn(
                'p-2 rounded-lg border hover:border-primary transition-colors',
                primaryColor === palette.primary && 'border-primary ring-1 ring-primary'
              )}
            >
              <div className="flex gap-0.5 mb-1">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: palette.primary }}
                />
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: palette.secondary }}
                />
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: palette.accent }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{palette.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Primary Color */}
      <div className="space-y-2">
        <Label className="text-xs">Primary Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={primaryColor}
            onChange={(e) => onUpdate({ primaryColor: e.target.value })}
            className="w-12 h-9 p-1 cursor-pointer"
          />
          <Input
            value={primaryColor}
            onChange={(e) => onUpdate({ primaryColor: e.target.value })}
            className="flex-1 font-mono text-sm"
            placeholder="#6366f1"
          />
        </div>
      </div>

      {/* Secondary Color */}
      <div className="space-y-2">
        <Label className="text-xs">Secondary Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={secondaryColor || primaryColor}
            onChange={(e) => onUpdate({ secondaryColor: e.target.value })}
            className="w-12 h-9 p-1 cursor-pointer"
          />
          <Input
            value={secondaryColor || ''}
            onChange={(e) => onUpdate({ secondaryColor: e.target.value })}
            className="flex-1 font-mono text-sm"
            placeholder="Same as primary"
          />
        </div>
      </div>

      {/* Accent Color */}
      <div className="space-y-2">
        <Label className="text-xs">Accent Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={accentColor || '#f59e0b'}
            onChange={(e) => onUpdate({ accentColor: e.target.value })}
            className="w-12 h-9 p-1 cursor-pointer"
          />
          <Input
            value={accentColor || ''}
            onChange={(e) => onUpdate({ accentColor: e.target.value })}
            className="flex-1 font-mono text-sm"
            placeholder="#f59e0b"
          />
        </div>
      </div>

      {/* Background Color */}
      {backgroundColor !== undefined && (
        <div className="space-y-2">
          <Label className="text-xs">Background</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={backgroundColor || '#ffffff'}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={backgroundColor || ''}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
              className="flex-1 font-mono text-sm"
              placeholder="#ffffff"
            />
          </div>
        </div>
      )}

      {/* Text Color */}
      {textColor !== undefined && (
        <div className="space-y-2">
          <Label className="text-xs">Text Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={textColor || '#0a0a0a'}
              onChange={(e) => onUpdate({ textColor: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={textColor || ''}
              onChange={(e) => onUpdate({ textColor: e.target.value })}
              className="flex-1 font-mono text-sm"
              placeholder="#0a0a0a"
            />
          </div>
        </div>
      )}
    </div>
  )
}
