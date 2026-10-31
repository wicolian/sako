'use client'

/**
 * Brand Palette Component
 *
 * Reusable brand color picker, font selector, and logo inserter.
 * Shared across all canvas editor wrappers.
 * Pulls from brand memory to show only on-brand options.
 */

import type { BrandMemoryTokens } from '@/lib/templates/brand-assembler'

interface BrandPaletteProps {
  brand: BrandMemoryTokens
  onColorSelect?: (color: string, role: string) => void
  onFontSelect?: (family: string) => void
  onLogoSelect?: (url: string) => void
}

export function BrandPalette({ brand, onColorSelect, onFontSelect, onLogoSelect }: BrandPaletteProps) {
  return (
    <div className="space-y-4 p-3">
      {/* Colors */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Brand Colors
        </h3>
        <div className="flex flex-wrap gap-2">
          {brand.colors.map((color, i) => (
            <button
              key={i}
              onClick={() => onColorSelect?.(color.value, color.role)}
              className="group relative"
              title={`${color.role}: ${color.value}`}
            >
              <div
                className="w-8 h-8 rounded-lg border border-border/50 hover:border-white transition-colors cursor-pointer"
                style={{ backgroundColor: color.value }}
              />
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {color.role}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Fonts */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Brand Fonts
        </h3>
        <div className="space-y-1">
          {brand.fonts.map((font, i) => (
            <button
              key={i}
              onClick={() => onFontSelect?.(font.family)}
              className="w-full text-left px-2 py-1.5 text-sm text-foreground/90 hover:bg-muted/50 rounded transition-colors"
              style={{ fontFamily: font.family }}
            >
              <span>{font.family}</span>
              <span className="text-xs text-muted-foreground ml-2">{font.role}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Logo */}
      {brand.logoUrl && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Logo
          </h3>
          <button
            onClick={() => onLogoSelect?.(brand.logoUrl!)}
            className="p-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
          >
            <img
              src={brand.logoUrl}
              alt="Brand logo"
              className="h-8 w-auto object-contain"
            />
          </button>
        </div>
      )}
    </div>
  )
}
