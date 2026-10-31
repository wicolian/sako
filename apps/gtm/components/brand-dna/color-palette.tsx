'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Palette, Copy, Check, Sun, Moon } from 'lucide-react'
import { toast } from 'sonner'

interface ColorsData {
  primary?: string
  secondary?: string
  accent?: string
  background?: string
  text?: string
  palette?: string[]
}

interface ColorPaletteProps {
  colors: ColorsData
}

export function ColorPalette({ colors }: ColorPaletteProps) {
  const [copiedColor, setCopiedColor] = useState<string | null>(null)
  const [showDark, setShowDark] = useState(false)

  const mainColors = [
    { label: 'Primary', value: colors.primary, key: 'primary' },
    { label: 'Secondary', value: colors.secondary, key: 'secondary' },
    { label: 'Accent', value: colors.accent, key: 'accent' },
    { label: 'Background', value: colors.background, key: 'background' },
    { label: 'Text', value: colors.text, key: 'text' },
  ].filter(c => c.value)

  const palette = colors.palette || []

  const copyColor = async (color: string) => {
    await navigator.clipboard.writeText(color)
    setCopiedColor(color)
    toast.success('Color copied!')
    setTimeout(() => setCopiedColor(null), 2000)
  }

  const getContrastColor = (hex: string): string => {
    // Remove # if present
    const color = hex.replace('#', '')
    const r = parseInt(color.substr(0, 2), 16)
    const g = parseInt(color.substr(2, 2), 16)
    const b = parseInt(color.substr(4, 2), 16)
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#000000' : '#ffffff'
  }

  const adjustBrightness = (hex: string, percent: number): string => {
    const color = hex.replace('#', '')
    const r = Math.min(255, Math.max(0, parseInt(color.substr(0, 2), 16) + percent))
    const g = Math.min(255, Math.max(0, parseInt(color.substr(2, 2), 16) + percent))
    const b = Math.min(255, Math.max(0, parseInt(color.substr(4, 2), 16) + percent))
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Color Palette
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDark(!showDark)}
          >
            {showDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Colors */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {mainColors.map(({ label, value, key }) => (
            <button
              key={key}
              onClick={() => copyColor(value!)}
              className="group text-left"
            >
              <div
                className="h-20 rounded-lg shadow-sm border transition-transform group-hover:scale-105 flex items-end justify-between p-2"
                style={{ backgroundColor: value }}
              >
                <span
                  className="text-xs font-medium"
                  style={{ color: getContrastColor(value!) }}
                >
                  {label}
                </span>
                {copiedColor === value ? (
                  <Check className="h-4 w-4" style={{ color: getContrastColor(value!) }} />
                ) : (
                  <Copy
                    className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: getContrastColor(value!) }}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {value?.toUpperCase()}
              </p>
            </button>
          ))}
        </div>

        {/* Shades */}
        {colors.primary && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Primary Shades</p>
            <div className="flex rounded-lg overflow-hidden">
              {[-80, -40, 0, 40, 80].map((adj) => {
                const shade = adjustBrightness(colors.primary!, adj)
                return (
                  <button
                    key={adj}
                    onClick={() => copyColor(shade)}
                    className="flex-1 h-10 transition-transform hover:scale-y-110"
                    style={{ backgroundColor: shade }}
                    title={shade.toUpperCase()}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Full Palette */}
        {palette.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Extracted Colors</p>
            <div className="flex flex-wrap gap-2">
              {palette.map((color, i) => (
                <button
                  key={i}
                  onClick={() => copyColor(color)}
                  className="group relative"
                >
                  <div
                    className="w-10 h-10 rounded-lg shadow-sm border transition-transform group-hover:scale-110"
                    style={{ backgroundColor: color }}
                  />
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {color.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dark Mode Preview */}
        {showDark && colors.primary && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-2">Dark Mode Preview</p>
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: '#0a0a0a',
                color: '#fafafa',
              }}
            >
              <div className="space-y-2">
                <div className="h-4 w-3/4 rounded" style={{ backgroundColor: colors.primary }} />
                <div className="h-3 w-1/2 rounded bg-gray-700" />
                <div className="h-3 w-2/3 rounded bg-gray-700" />
                <button
                  className="mt-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: colors.primary }}
                >
                  Button
                </button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
