'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Sun, Moon, Columns, Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type Theme, hasAccessibleContrast, getContrastRatio } from '@/lib/website/theme-manager'

interface ThemePreviewProps {
  theme: Theme
  className?: string
}

export function ThemePreview({ theme, className }: ThemePreviewProps) {
  const [viewMode, setViewMode] = useState<'split' | 'light' | 'dark'>('split')

  const renderPreview = (mode: 'light' | 'dark') => {
    const colors = mode === 'dark' ? theme.dark : theme.light
    const isDark = mode === 'dark'

    // Check contrast
    const primaryContrast = getContrastRatio(colors.primary, colors.background)
    const textContrast = getContrastRatio(colors.foreground, colors.background)
    const hasGoodContrast = hasAccessibleContrast(colors.foreground, colors.background)

    return (
      <div
        className={cn(
          'rounded-lg overflow-hidden transition-all',
          viewMode === 'split' ? 'flex-1' : 'w-full'
        )}
        style={{
          backgroundColor: colors.background,
          color: colors.foreground,
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 border-b"
          style={{ borderColor: colors.border }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: colors.primary }}
              >
                A
              </div>
              <span className="font-semibold text-sm">Preview</span>
            </div>
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{
                borderColor: colors.border,
                color: colors.mutedForeground,
              }}
            >
              {mode === 'dark' ? <Moon className="h-3 w-3 mr-1" /> : <Sun className="h-3 w-3 mr-1" />}
              {mode}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Hero */}
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Welcome to Your Site</h2>
            <p
              className="text-sm"
              style={{ color: colors.mutedForeground }}
            >
              This is how your website will look in {mode} mode.
            </p>
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 text-xs font-medium rounded-md text-white"
                style={{ backgroundColor: colors.primary }}
              >
                Primary
              </button>
              <button
                className="px-3 py-1.5 text-xs font-medium rounded-md"
                style={{
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.primary}`,
                  color: colors.primary,
                }}
              >
                Secondary
              </button>
            </div>
          </div>

          {/* Card */}
          <div
            className="p-3 rounded-lg"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              border: `1px solid ${colors.border}`,
            }}
          >
            <h3 className="text-sm font-medium mb-1" style={{ color: colors.cardForeground }}>
              Card Example
            </h3>
            <p className="text-xs" style={{ color: colors.mutedForeground }}>
              Cards use slightly different backgrounds.
            </p>
          </div>

          {/* Contrast Info */}
          <div
            className="text-[10px] p-2 rounded"
            style={{ backgroundColor: colors.muted }}
          >
            <div className="flex items-center gap-1 mb-1">
              {hasGoodContrast ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              )}
              <span style={{ color: colors.mutedForeground }}>
                Text contrast: {textContrast.toFixed(1)}:1
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span style={{ color: colors.mutedForeground }}>
                Primary on bg: {primaryContrast.toFixed(1)}:1
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Theme Preview</CardTitle>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
            <TabsList className="h-7">
              <TabsTrigger value="split" className="text-xs h-6 px-2">
                <Columns className="h-3 w-3 mr-1" />
                Split
              </TabsTrigger>
              <TabsTrigger value="light" className="text-xs h-6 px-2">
                <Sun className="h-3 w-3" />
              </TabsTrigger>
              <TabsTrigger value="dark" className="text-xs h-6 px-2">
                <Moon className="h-3 w-3" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn(
          'flex gap-3 transition-all',
          viewMode === 'split' ? 'flex-row' : 'flex-col'
        )}>
          {viewMode === 'split' ? (
            <>
              {renderPreview('light')}
              {renderPreview('dark')}
            </>
          ) : viewMode === 'light' ? (
            renderPreview('light')
          ) : (
            renderPreview('dark')
          )}
        </div>

        {/* Color Swatches */}
        <div className="mt-4 pt-4 border-t">
          <Label className="text-xs text-muted-foreground mb-2 block">Color Palette</Label>
          <div className="flex gap-2">
            {['primary', 'secondary', 'accent'].map(key => (
              <div key={key} className="text-center">
                <div className="flex gap-0.5">
                  <div
                    className="w-6 h-6 rounded-l"
                    style={{ backgroundColor: theme.light[key as keyof typeof theme.light] as string }}
                    title={`${key} (light)`}
                  />
                  <div
                    className="w-6 h-6 rounded-r"
                    style={{ backgroundColor: theme.dark[key as keyof typeof theme.dark] as string }}
                    title={`${key} (dark)`}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 capitalize">{key}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
