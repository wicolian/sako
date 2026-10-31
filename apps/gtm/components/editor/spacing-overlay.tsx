'use client'

/**
 * Spacing Overlay Component
 * 
 * On-hover visual display of margins, padding, and gaps.
 * Shows measurement labels and allows click-drag adjustment.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SpacingOverlayProps {
  element: HTMLElement | null
  enabled: boolean
  onSpacingChange?: (property: string, value: number) => void
  showLabels?: boolean
}

interface ComputedSpacing {
  padding: { top: number; right: number; bottom: number; left: number }
  margin: { top: number; right: number; bottom: number; left: number }
  gap: number | null
  rect: DOMRect
}

export function SpacingOverlay({
  element,
  enabled,
  onSpacingChange,
  showLabels = true,
}: SpacingOverlayProps) {
  const [spacing, setSpacing] = useState<ComputedSpacing | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragProperty, setDragProperty] = useState<string | null>(null)
  const dragStartRef = useRef<{ x: number; y: number; value: number } | null>(null)

  // Compute spacing values from element
  useEffect(() => {
    if (!element || !enabled) {
      setSpacing(null)
      return
    }

    const computeSpacing = () => {
      const computed = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()

      setSpacing({
        padding: {
          top: parseFloat(computed.paddingTop) || 0,
          right: parseFloat(computed.paddingRight) || 0,
          bottom: parseFloat(computed.paddingBottom) || 0,
          left: parseFloat(computed.paddingLeft) || 0,
        },
        margin: {
          top: parseFloat(computed.marginTop) || 0,
          right: parseFloat(computed.marginRight) || 0,
          bottom: parseFloat(computed.marginBottom) || 0,
          left: parseFloat(computed.marginLeft) || 0,
        },
        gap: computed.gap && computed.gap !== 'normal' ? parseFloat(computed.gap) : null,
        rect,
      })
    }

    computeSpacing()

    // Re-compute on resize
    const observer = new ResizeObserver(computeSpacing)
    observer.observe(element)

    return () => observer.disconnect()
  }, [element, enabled])

  // Handle drag to adjust spacing
  const handleDragStart = useCallback((property: string, initialValue: number, e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragProperty(property)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      value: initialValue,
    }

    const handleMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return

      const deltaX = moveEvent.clientX - dragStartRef.current.x
      const deltaY = moveEvent.clientY - dragStartRef.current.y

      // Determine which axis matters based on property
      const isHorizontal = property.includes('left') || property.includes('right')
      const delta = isHorizontal ? deltaX : deltaY
      
      const newValue = Math.max(0, Math.round(dragStartRef.current.value + delta))
      onSpacingChange?.(property, newValue)
    }

    const handleUp = () => {
      setIsDragging(false)
      setDragProperty(null)
      dragStartRef.current = null
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [onSpacingChange])

  if (!spacing || !enabled) return null

  const { padding, margin, rect } = spacing

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed pointer-events-none z-50"
        style={{
          left: rect.left - margin.left,
          top: rect.top - margin.top,
          width: rect.width + margin.left + margin.right,
          height: rect.height + margin.top + margin.bottom,
        }}
      >
        {/* Margin indicators */}
        {margin.top > 0 && (
          <SpacingIndicator
            type="margin"
            position="top"
            value={margin.top}
            width={rect.width}
            height={margin.top}
            left={margin.left}
            top={0}
            showLabel={showLabels}
            isDragging={isDragging && dragProperty === 'margin-top'}
            onDragStart={(e) => handleDragStart('margin-top', margin.top, e)}
          />
        )}
        {margin.right > 0 && (
          <SpacingIndicator
            type="margin"
            position="right"
            value={margin.right}
            width={margin.right}
            height={rect.height}
            left={margin.left + rect.width}
            top={margin.top}
            showLabel={showLabels}
            isDragging={isDragging && dragProperty === 'margin-right'}
            onDragStart={(e) => handleDragStart('margin-right', margin.right, e)}
          />
        )}
        {margin.bottom > 0 && (
          <SpacingIndicator
            type="margin"
            position="bottom"
            value={margin.bottom}
            width={rect.width}
            height={margin.bottom}
            left={margin.left}
            top={margin.top + rect.height}
            showLabel={showLabels}
            isDragging={isDragging && dragProperty === 'margin-bottom'}
            onDragStart={(e) => handleDragStart('margin-bottom', margin.bottom, e)}
          />
        )}
        {margin.left > 0 && (
          <SpacingIndicator
            type="margin"
            position="left"
            value={margin.left}
            width={margin.left}
            height={rect.height}
            left={0}
            top={margin.top}
            showLabel={showLabels}
            isDragging={isDragging && dragProperty === 'margin-left'}
            onDragStart={(e) => handleDragStart('margin-left', margin.left, e)}
          />
        )}

        {/* Content box with padding indicators */}
        <div
          className="absolute border-2 border-primary/50"
          style={{
            left: margin.left,
            top: margin.top,
            width: rect.width,
            height: rect.height,
          }}
        >
          {/* Padding indicators */}
          {padding.top > 0 && (
            <SpacingIndicator
              type="padding"
              position="top"
              value={padding.top}
              width={rect.width - padding.left - padding.right}
              height={padding.top}
              left={padding.left}
              top={0}
              showLabel={showLabels}
              isDragging={isDragging && dragProperty === 'padding-top'}
              onDragStart={(e) => handleDragStart('padding-top', padding.top, e)}
            />
          )}
          {padding.right > 0 && (
            <SpacingIndicator
              type="padding"
              position="right"
              value={padding.right}
              width={padding.right}
              height={rect.height - padding.top - padding.bottom}
              left={rect.width - padding.right}
              top={padding.top}
              showLabel={showLabels}
              isDragging={isDragging && dragProperty === 'padding-right'}
              onDragStart={(e) => handleDragStart('padding-right', padding.right, e)}
            />
          )}
          {padding.bottom > 0 && (
            <SpacingIndicator
              type="padding"
              position="bottom"
              value={padding.bottom}
              width={rect.width - padding.left - padding.right}
              height={padding.bottom}
              left={padding.left}
              top={rect.height - padding.bottom}
              showLabel={showLabels}
              isDragging={isDragging && dragProperty === 'padding-bottom'}
              onDragStart={(e) => handleDragStart('padding-bottom', padding.bottom, e)}
            />
          )}
          {padding.left > 0 && (
            <SpacingIndicator
              type="padding"
              position="left"
              value={padding.left}
              width={padding.left}
              height={rect.height - padding.top - padding.bottom}
              left={0}
              top={padding.top}
              showLabel={showLabels}
              isDragging={isDragging && dragProperty === 'padding-left'}
              onDragStart={(e) => handleDragStart('padding-left', padding.left, e)}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

interface SpacingIndicatorProps {
  type: 'margin' | 'padding'
  position: 'top' | 'right' | 'bottom' | 'left'
  value: number
  width: number
  height: number
  left: number
  top: number
  showLabel: boolean
  isDragging: boolean
  onDragStart: (e: React.MouseEvent) => void
}

function SpacingIndicator({
  type,
  position,
  value,
  width,
  height,
  left,
  top,
  showLabel,
  isDragging,
  onDragStart,
}: SpacingIndicatorProps) {
  const isMargin = type === 'margin'
  const bgColor = isMargin ? 'bg-orange-500/30' : 'bg-green-500/30'
  const borderColor = isMargin ? 'border-orange-500/50' : 'border-green-500/50'
  const labelBg = isMargin ? 'bg-orange-500' : 'bg-green-500'

  const isVertical = position === 'top' || position === 'bottom'

  return (
    <div
      className={cn(
        'absolute pointer-events-auto cursor-ns-resize',
        bgColor,
        'border border-dashed',
        borderColor,
        isDragging && 'ring-2 ring-primary',
        !isVertical && 'cursor-ew-resize'
      )}
      style={{ left, top, width, height }}
      onMouseDown={onDragStart}
    >
      {showLabel && value >= 8 && (
        <div
          className={cn(
            'absolute text-white text-[10px] px-1 py-0.5 rounded font-mono pointer-events-none',
            labelBg,
            isVertical
              ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
              : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap'
          )}
        >
          {Math.round(value)}
        </div>
      )}
    </div>
  )
}

/**
 * Hook to manage spacing overlay state
 */
export function useSpacingOverlay() {
  const [enabled, setEnabled] = useState(false)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)

  const toggle = useCallback(() => setEnabled(prev => !prev), [])
  const setTarget = useCallback((el: HTMLElement | null) => setTargetElement(el), [])

  return {
    enabled,
    targetElement,
    toggle,
    setEnabled,
    setTarget,
  }
}
