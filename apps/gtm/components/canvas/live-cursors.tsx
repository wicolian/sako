'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface CursorPosition {
  x: number
  y: number
}

interface Collaborator {
  id: string
  user_id: string
  name: string
  color: string
  cursor: CursorPosition | null
  last_seen: string
}

interface LiveCursorsProps {
  projectId: string
  userId: string
  userName: string
  containerRef: React.RefObject<HTMLElement>
}

// Predefined cursor colors
const CURSOR_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
]

function getColorForUser(userId: string): string {
  // Generate consistent color based on user ID
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash = hash & hash
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

export function LiveCursors({
  projectId,
  userId,
  userName,
  containerRef,
}: LiveCursorsProps) {
  const [collaborators, setCollaborators] = useState<Map<string, Collaborator>>(new Map())
  const [isConnected, setIsConnected] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const lastPositionRef = useRef<CursorPosition | null>(null)

  // Throttle cursor updates
  const throttleRef = useRef<NodeJS.Timeout | null>(null)
  const THROTTLE_MS = 50 // 20 updates per second max

  // Broadcast cursor position
  const broadcastCursor = useCallback((position: CursorPosition | null) => {
    if (!channelRef.current) return

    channelRef.current.send({
      type: 'broadcast',
      event: 'cursor',
      payload: {
        user_id: userId,
        name: userName,
        color: getColorForUser(userId),
        cursor: position,
        timestamp: Date.now(),
      },
    })
  }, [userId, userName])

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Only update if within container bounds
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      const position = { x, y }
      lastPositionRef.current = position

      // Throttle broadcasts
      if (!throttleRef.current) {
        broadcastCursor(position)
        throttleRef.current = setTimeout(() => {
          throttleRef.current = null
        }, THROTTLE_MS)
      }
    }
  }, [containerRef, broadcastCursor])

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    lastPositionRef.current = null
    broadcastCursor(null)
  }, [broadcastCursor])

  // Setup realtime connection
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`cursors:${projectId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    })

    channel
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        if (payload.user_id === userId) return // Ignore own cursor

        setCollaborators(prev => {
          const next = new Map(prev)
          next.set(payload.user_id, {
            id: payload.user_id,
            user_id: payload.user_id,
            name: payload.name,
            color: payload.color,
            cursor: payload.cursor,
            last_seen: new Date().toISOString(),
          })
          return next
        })
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        // Clean up cursors for users who left
        setCollaborators(prev => {
          const next = new Map(prev)
          const activeUserIds = new Set(Object.keys(state))
          
          for (const [id] of prev) {
            if (!activeUserIds.has(id) && id !== userId) {
              next.delete(id)
            }
          }
          
          return next
        })
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setCollaborators(prev => {
          const next = new Map(prev)
          next.delete(key)
          return next
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          await channel.track({
            user_id: userId,
            name: userName,
            online_at: new Date().toISOString(),
          })
        }
      })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [projectId, userId, userName])

  // Attach mouse listeners
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [containerRef, handleMouseMove, handleMouseLeave])

  // Clean up stale cursors (older than 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setCollaborators(prev => {
        const next = new Map(prev)
        const now = Date.now()
        
        for (const [id, collaborator] of prev) {
          const lastSeen = new Date(collaborator.last_seen).getTime()
          if (now - lastSeen > 10000) {
            next.delete(id)
          }
        }
        
        return next.size !== prev.size ? next : prev
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <AnimatePresence>
      {Array.from(collaborators.values()).map(collaborator => {
        if (!collaborator.cursor) return null

        return (
          <motion.div
            key={collaborator.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              x: collaborator.cursor.x,
              y: collaborator.cursor.y,
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ 
              type: 'spring',
              damping: 30,
              stiffness: 500,
              mass: 0.5,
            }}
            className="absolute pointer-events-none z-50"
            style={{ left: 0, top: 0 }}
          >
            {/* Cursor */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="drop-shadow-md"
            >
              <path
                d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-5.07h6.5c.34 0 .52-.4.3-.65L6.35 2.84a.5.5 0 0 0-.85.37Z"
                fill={collaborator.color}
                stroke="white"
                strokeWidth="1.5"
              />
            </svg>

            {/* Name label */}
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute left-4 top-4 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
              style={{ backgroundColor: collaborator.color }}
            >
              {collaborator.name}
            </motion.div>
          </motion.div>
        )
      })}
    </AnimatePresence>
  )
}

/**
 * Hook for using live cursors
 */
export function useLiveCursors(projectId: string, enabled: boolean = true) {
  const [collaboratorCount, setCollaboratorCount] = useState(0)
  
  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    const channel = supabase.channel(`presence:${projectId}`)

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setCollaboratorCount(Object.keys(state).length)
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [projectId, enabled])

  return { collaboratorCount }
}

/**
 * Avatar stack for showing online collaborators
 */
interface CollaboratorAvatarsProps {
  projectId: string
  maxVisible?: number
}

export function CollaboratorAvatars({ projectId, maxVisible = 3 }: CollaboratorAvatarsProps) {
  const [collaborators, setCollaborators] = useState<{ id: string; name: string; color: string }[]>([])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`presence:${projectId}`)

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.entries(state).map(([key, presences]) => {
          const presence = (presences as unknown as { user_id: string; name: string }[])[0]
          return {
            id: key,
            name: presence?.name || 'Anonymous',
            color: getColorForUser(key),
          }
        })
        setCollaborators(users)
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [projectId])

  if (collaborators.length === 0) return null

  const visible = collaborators.slice(0, maxVisible)
  const remaining = collaborators.length - maxVisible

  return (
    <div className="flex items-center -space-x-2">
      {visible.map(collaborator => (
        <div
          key={collaborator.id}
          className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-white text-xs font-medium"
          style={{ backgroundColor: collaborator.color }}
          title={collaborator.name}
        >
          {collaborator.name[0].toUpperCase()}
        </div>
      ))}
      {remaining > 0 && (
        <div className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
          +{remaining}
        </div>
      )}
    </div>
  )
}
