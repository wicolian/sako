'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface CanvasCursor {
  userId: string
  userName: string
  userColor: string
  position: { x: number; y: number }
  selection?: string[]
  lastUpdate: number
}

export interface CanvasPresence {
  userId: string
  userName: string
  userColor: string
  isActive: boolean
}

interface UseRealtimeCanvasOptions {
  canvasId: string
  userId: string
  userName: string
  userColor: string
  onCursorsChange?: (cursors: CanvasCursor[]) => void
  onPresenceChange?: (presence: CanvasPresence[]) => void
  onBlockLocked?: (blockId: string, userId: string, userName: string) => void
  onBlockUnlocked?: (blockId: string) => void
}

const CURSOR_THROTTLE_MS = 50
const CURSOR_STALE_MS = 5000

export function useRealtimeCanvas({
  canvasId,
  userId,
  userName,
  userColor,
  onCursorsChange,
  onPresenceChange,
  onBlockLocked,
  onBlockUnlocked,
}: UseRealtimeCanvasOptions) {
  const [cursors, setCursors] = useState<Map<string, CanvasCursor>>(new Map())
  const [presence, setPresence] = useState<Map<string, CanvasPresence>>(new Map())
  const [isConnected, setIsConnected] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastCursorUpdate = useRef<number>(0)

  // Generate user color if not provided
  const effectiveUserColor = userColor || generateUserColor(userId)

  // Clean up stale cursors
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setCursors((prev) => {
        const updated = new Map(prev)
        let changed = false
        for (const [id, cursor] of updated) {
          if (now - cursor.lastUpdate > CURSOR_STALE_MS) {
            updated.delete(id)
            changed = true
          }
        }
        return changed ? updated : prev
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Notify parent of cursor changes
  useEffect(() => {
    onCursorsChange?.(Array.from(cursors.values()).filter((c) => c.userId !== userId))
  }, [cursors, onCursorsChange, userId])

  // Notify parent of presence changes
  useEffect(() => {
    onPresenceChange?.(Array.from(presence.values()))
  }, [presence, onPresenceChange])

  // Set up realtime channel
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase.channel(`canvas:${canvasId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    })

    // Handle presence sync
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const newPresence = new Map<string, CanvasPresence>()

      for (const [key, values] of Object.entries(state)) {
        const presenceData = values[0] as CanvasPresence & { presence_ref?: string }
        if (presenceData) {
          newPresence.set(key, {
            userId: presenceData.userId,
            userName: presenceData.userName,
            userColor: presenceData.userColor,
            isActive: true,
          })
        }
      }

      setPresence(newPresence)
    })

    // Handle cursor updates
    channel.on('broadcast', { event: 'cursor' }, ({ payload }) => {
      if (payload.userId === userId) return

      setCursors((prev) => {
        const updated = new Map(prev)
        updated.set(payload.userId, {
          userId: payload.userId,
          userName: payload.userName,
          userColor: payload.userColor,
          position: payload.position,
          selection: payload.selection,
          lastUpdate: Date.now(),
        })
        return updated
      })
    })

    // Handle block lock/unlock
    channel.on('broadcast', { event: 'block_lock' }, ({ payload }) => {
      onBlockLocked?.(payload.blockId, payload.userId, payload.userName)
    })

    channel.on('broadcast', { event: 'block_unlock' }, ({ payload }) => {
      onBlockUnlocked?.(payload.blockId)
    })

    // Subscribe and track presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true)
        await channel.track({
          userId,
          userName,
          userColor: effectiveUserColor,
          isActive: true,
        })
      }
    })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
      setIsConnected(false)
    }
  }, [canvasId, userId, userName, effectiveUserColor, onBlockLocked, onBlockUnlocked])

  // Broadcast cursor position (throttled)
  const broadcastCursor = useCallback(
    (position: { x: number; y: number }, selection?: string[]) => {
      const now = Date.now()
      if (now - lastCursorUpdate.current < CURSOR_THROTTLE_MS) return

      lastCursorUpdate.current = now

      channelRef.current?.send({
        type: 'broadcast',
        event: 'cursor',
        payload: {
          userId,
          userName,
          userColor: effectiveUserColor,
          position,
          selection,
        },
      })
    },
    [userId, userName, effectiveUserColor]
  )

  // Lock a block for editing
  const lockBlock = useCallback(
    (blockId: string) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'block_lock',
        payload: {
          blockId,
          userId,
          userName,
        },
      })
    },
    [userId, userName]
  )

  // Unlock a block
  const unlockBlock = useCallback((blockId: string) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'block_unlock',
      payload: {
        blockId,
      },
    })
  }, [])

  return {
    cursors: Array.from(cursors.values()).filter((c) => c.userId !== userId),
    presence: Array.from(presence.values()),
    isConnected,
    broadcastCursor,
    lockBlock,
    unlockBlock,
  }
}

// Generate a deterministic color from user ID
function generateUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  return `hsl(${hue}, 70%, 50%)`
}
