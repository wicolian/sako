'use client'

import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'

interface SpacingOverlayProps {
  targetRef: React.RefObject<HTMLElement>
  isVisible: boolean
  showMargin?: boolean
  showPadding?: boolean
}

interface SpacingValues {
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
}

export function SpacingOverlay({
  targetRef,
  isVisible,
  showMargin = true,
  showPadding = true,
}: SpacingOverlayProps) {
  const [spacing, setSpacing] = useState<SpacingValues | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!isVisible || !targetRef.current) {
      setSpacing(null)
      setRect(null)
      return
    }

    const element = targetRef.current
    const computedStyle = window.getComputedStyle(element)
    const boundingRect = element.getBoundingClientRect()

    setRect(boundingRect)
    setSpacing({
      marginTop: parseInt(computedStyle.marginTop, 10) || 0,
      marginRight: parseInt(computedStyle.marginRight, 10) || 0,
      marginBottom: parseInt(computedStyle.marginBottom, 10) || 0,
      marginLeft: parseInt(computedStyle.marginLeft, 10) || 0,
      paddingTop: parseInt(computedStyle.paddingTop, 10) || 0,
      paddingRight: parseInt(computedStyle.paddingRight, 10) || 0,
      paddingBottom: parseInt(computedStyle.paddingBottom, 10) || 0,
      paddingLeft: parseInt(computedStyle.paddingLeft, 10) || 0,
    })
  }, [isVisible, targetRef])

  if (!isVisible || !spacing || !rect) return null

  return (
    <div className="pointer-events-none fixed z-50">
      {/* Margin overlays - orange */}
      {showMargin && (
        <>
          {spacing.marginTop > 0 && (
            <div
              className="absolute bg-orange-500/30 border-t border-orange-500"
              style={{
                left: rect.left - spacing.marginLeft,
                top: rect.top - spacing.marginTop,
                width: rect.width + spacing.marginLeft + spacing.marginRight,
                height: spacing.marginTop,
              }}
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-orange-600 bg-card/80 px-1 rounded">
                {spacing.marginTop}
              </span>
            </div>
          )}
          {spacing.marginRight > 0 && (
            <div
              className="absolute bg-orange-500/30 border-r border-orange-500"
              style={{
                left: rect.right,
                top: rect.top,
                width: spacing.marginRight,
                height: rect.height,
              }}
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-orange-600 bg-card/80 px-1 rounded">
                {spacing.marginRight}
              </span>
            </div>
          )}
          {spacing.marginBottom > 0 && (
            <div
              className="absolute bg-orange-500/30 border-b border-orange-500"
              style={{
                left: rect.left - spacing.marginLeft,
                top: rect.bottom,
                width: rect.width + spacing.marginLeft + spacing.marginRight,
                height: spacing.marginBottom,
              }}
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-orange-600 bg-card/80 px-1 rounded">
                {spacing.marginBottom}
              </span>
            </div>
          )}
          {spacing.marginLeft > 0 && (
            <div
              className="absolute bg-orange-500/30 border-l border-orange-500"
              style={{
                left: rect.left - spacing.marginLeft,
                top: rect.top,
                width: spacing.marginLeft,
                height: rect.height,
              }}
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-orange-600 bg-card/80 px-1 rounded">
                {spacing.marginLeft}
              </span>
            </div>
          )}
        </>
      )}

      {/* Padding overlays - green */}
      {showPadding && (
        <>
          {spacing.paddingTop > 0 && (
            <div
              className="absolute bg-green-500/30 border-t border-green-500"
              style={{
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: spacing.paddingTop,
              }}
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-emerald-500 bg-card/80 px-1 rounded">
                {spacing.paddingTop}
              </span>
            </div>
          )}
          {spacing.paddingRight > 0 && (
            <div
              className="absolute bg-green-500/30 border-r border-green-500"
              style={{
                left: rect.right - spacing.paddingRight,
                top: rect.top + spacing.paddingTop,
                width: spacing.paddingRight,
                height: rect.height - spacing.paddingTop - spacing.paddingBottom,
              }}
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-emerald-500 bg-card/80 px-1 rounded">
                {spacing.paddingRight}
              </span>
            </div>
          )}
          {spacing.paddingBottom > 0 && (
            <div
              className="absolute bg-green-500/30 border-b border-green-500"
              style={{
                left: rect.left,
                top: rect.bottom - spacing.paddingBottom,
                width: rect.width,
                height: spacing.paddingBottom,
              }}
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-emerald-500 bg-card/80 px-1 rounded">
                {spacing.paddingBottom}
              </span>
            </div>
          )}
          {spacing.paddingLeft > 0 && (
            <div
              className="absolute bg-green-500/30 border-l border-green-500"
              style={{
                left: rect.left,
                top: rect.top + spacing.paddingTop,
                width: spacing.paddingLeft,
                height: rect.height - spacing.paddingTop - spacing.paddingBottom,
              }}
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-emerald-500 bg-card/80 px-1 rounded">
                {spacing.paddingLeft}
              </span>
            </div>
          )}
        </>
      )}

      {/* Element border - blue */}
      <div
        className="absolute border-2 border-blue-500 pointer-events-none"
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }}
      />
    </div>
  )
}

interface SpacingEditorProps {
  value: {
    marginTop?: number
    marginRight?: number
    marginBottom?: number
    marginLeft?: number
    paddingTop?: number
    paddingRight?: number
    paddingBottom?: number
    paddingLeft?: number
  }
  onChange: (values: SpacingEditorProps['value']) => void
}

export function SpacingEditor({ value, onChange }: SpacingEditorProps) {
  const handleChange = (key: keyof SpacingEditorProps['value'], val: number) => {
    onChange({ ...value, [key]: val })
  }

  return (
    <div className="space-y-4">
      {/* Margin */}
      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-orange-500" />
          Margin
        </h4>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <label className="text-xs text-muted-foreground">Top</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-sm border rounded"
              value={value.marginTop ?? 0}
              onChange={(e) => handleChange('marginTop', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="text-center">
            <label className="text-xs text-muted-foreground">Right</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-sm border rounded"
              value={value.marginRight ?? 0}
              onChange={(e) => handleChange('marginRight', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="text-center">
            <label className="text-xs text-muted-foreground">Bottom</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-sm border rounded"
              value={value.marginBottom ?? 0}
              onChange={(e) => handleChange('marginBottom', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="text-center">
            <label className="text-xs text-muted-foreground">Left</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-sm border rounded"
              value={value.marginLeft ?? 0}
              onChange={(e) => handleChange('marginLeft', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* Padding */}
      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-green-500" />
          Padding
        </h4>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <label className="text-xs text-muted-foreground">Top</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-sm border rounded"
              value={value.paddingTop ?? 0}
              onChange={(e) => handleChange('paddingTop', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="text-center">
            <label className="text-xs text-muted-foreground">Right</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-sm border rounded"
              value={value.paddingRight ?? 0}
              onChange={(e) => handleChange('paddingRight', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="text-center">
            <label className="text-xs text-muted-foreground">Bottom</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-sm border rounded"
              value={value.paddingBottom ?? 0}
              onChange={(e) => handleChange('paddingBottom', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="text-center">
            <label className="text-xs text-muted-foreground">Left</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-sm border rounded"
              value={value.paddingLeft ?? 0}
              onChange={(e) => handleChange('paddingLeft', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SpacingOverlay
