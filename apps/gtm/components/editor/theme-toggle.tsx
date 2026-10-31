'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Sun, Moon, Monitor, Palette, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { THEME_PRESETS, type Theme } from '@/lib/website/theme-manager'

type ColorScheme = 'light' | 'dark' | 'auto'

interface ThemeToggleProps {
  colorScheme: ColorScheme
  primaryColor: string
  onColorSchemeChange: (scheme: ColorScheme) => void
  onThemeChange: (theme: Theme) => void
}

export function ThemeToggle({
  colorScheme,
  primaryColor,
  onColorSchemeChange,
  onThemeChange,
}: ThemeToggleProps) {
  const [open, setOpen] = useState(false)

  const schemes: { id: ColorScheme; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { id: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { id: 'auto', label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ]

  const currentPreset = THEME_PRESETS.find(t => t.light.primary === primaryColor)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {colorScheme === 'dark' ? (
            <Moon className="h-4 w-4" />
          ) : colorScheme === 'light' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
          <div
            className="w-4 h-4 rounded-full border"
            style={{ backgroundColor: primaryColor }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          {/* Color Scheme */}
          <div>
            <Label className="text-xs text-muted-foreground">Appearance</Label>
            <div className="flex gap-1 mt-2">
              {schemes.map(scheme => (
                <Button
                  key={scheme.id}
                  variant={colorScheme === scheme.id ? 'secondary' : 'ghost'}
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => onColorSchemeChange(scheme.id)}
                >
                  {scheme.icon}
                  {scheme.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Theme Presets */}
          <div>
            <Label className="text-xs text-muted-foreground">Color Theme</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {THEME_PRESETS.map(theme => (
                <button
                  key={theme.name}
                  onClick={() => onThemeChange(theme)}
                  className={cn(
                    'p-2 rounded-lg border transition-all',
                    currentPreset?.name === theme.name
                      ? 'border-primary ring-1 ring-primary'
                      : 'hover:border-primary/50'
                  )}
                  title={theme.name}
                >
                  <div className="flex gap-0.5 justify-center">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: theme.light.primary }}
                    />
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: theme.light.secondary }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 text-center truncate">
                    {theme.name}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="pt-3 border-t">
            <Label className="text-xs text-muted-foreground">Preview</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {/* Light preview */}
              <div className="p-3 rounded-lg bg-card border">
                <div
                  className="h-2 w-3/4 rounded mb-2"
                  style={{ backgroundColor: primaryColor }}
                />
                <div className="h-1.5 w-full rounded bg-muted/30 mb-1" />
                <div className="h-1.5 w-2/3 rounded bg-muted/30" />
                <p className="text-[8px] text-muted-foreground mt-2">Light</p>
              </div>
              {/* Dark preview */}
              <div className="p-3 rounded-lg bg-[#0a0a0a] border border-border/50">
                <div
                  className="h-2 w-3/4 rounded mb-2"
                  style={{ backgroundColor: primaryColor }}
                />
                <div className="h-1.5 w-full rounded bg-gray-700 mb-1" />
                <div className="h-1.5 w-2/3 rounded bg-gray-700" />
                <p className="text-[8px] text-muted-foreground mt-2">Dark</p>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
