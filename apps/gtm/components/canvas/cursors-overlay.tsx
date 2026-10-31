'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { CanvasCursor } from '@/hooks/use-realtime-canvas'

interface CursorsOverlayProps {
  cursors: CanvasCursor[]
  viewportTransform?: { x: number; y: number; zoom: number }
}

export function CursorsOverlay({ cursors, viewportTransform }: CursorsOverlayProps) {
  const transform = viewportTransform || { x: 0, y: 0, zoom: 1 }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {cursors.map((cursor) => {
          // Transform canvas coordinates to screen coordinates
          const screenX = cursor.position.x * transform.zoom + transform.x
          const screenY = cursor.position.y * transform.zoom + transform.y

          return (
            <motion.div
              key={cursor.userId}
              className="absolute"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                x: screenX,
                y: screenY,
              }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ 
                type: 'spring', 
                damping: 30, 
                stiffness: 300,
                mass: 0.5,
              }}
            >
              {/* Cursor SVG */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="drop-shadow-lg"
                style={{ transform: 'translate(-2px, -2px)' }}
              >
                <path
                  d="M5.65 3.15V20.85c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.87a.5.5 0 00.35-.85L6.5 2.8a.5.5 0 00-.85.35z"
                  fill={cursor.userColor}
                  stroke="white"
                  strokeWidth="1.5"
                />
              </svg>

              {/* User name tag */}
              <motion.div
                className="absolute top-5 left-3 px-2 py-0.5 rounded text-[11px] font-medium text-white whitespace-nowrap shadow-lg"
                style={{ backgroundColor: cursor.userColor }}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {cursor.userName}
              </motion.div>

              {/* Selection indicator */}
              {cursor.selection && cursor.selection.length > 0 && (
                <motion.div
                  className="absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[9px] font-medium bg-black/50 text-white whitespace-nowrap"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Editing {cursor.selection.length} item{cursor.selection.length > 1 ? 's' : ''}
                </motion.div>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
