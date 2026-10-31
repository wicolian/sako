'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { CanvasPresence } from '@/hooks/use-realtime-canvas'

interface PresenceAvatarsProps {
  presence: CanvasPresence[]
  currentUserId: string
  maxVisible?: number
  className?: string
}

export function PresenceAvatars({
  presence,
  currentUserId,
  maxVisible = 5,
  className,
}: PresenceAvatarsProps) {
  // Filter out current user and sort by name
  const otherUsers = presence
    .filter((p) => p.userId !== currentUserId && p.isActive)
    .sort((a, b) => a.userName.localeCompare(b.userName))

  if (otherUsers.length === 0) {
    return null
  }

  const visibleUsers = otherUsers.slice(0, maxVisible)
  const remainingCount = otherUsers.length - maxVisible

  return (
    <TooltipProvider>
      <div className={cn('flex items-center -space-x-2', className)}>
        <AnimatePresence mode="popLayout">
          {visibleUsers.map((user, index) => (
            <motion.div
              key={user.userId}
              initial={{ opacity: 0, scale: 0.5, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.5, x: -10 }}
              transition={{ delay: index * 0.05 }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'relative h-8 w-8 rounded-full border-2 border-background',
                      'flex items-center justify-center text-xs font-semibold text-white',
                      'cursor-pointer transition-transform hover:scale-110 hover:z-10',
                      'ring-2 ring-offset-1 ring-offset-background'
                    )}
                    style={{ 
                      backgroundColor: user.userColor,
                      // @ts-expect-error CSS custom property for ring color
                      '--tw-ring-color': user.userColor,
                    }}
                  >
                    {user.userName.charAt(0).toUpperCase()}
                    
                    {/* Online indicator */}
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-green-500"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-card">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                      style={{ backgroundColor: user.userColor }}
                    >
                      {user.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{user.userName}</p>
                      <p className="text-xs text-muted-foreground">Active now</p>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </motion.div>
          ))}

          {remainingCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'h-8 w-8 rounded-full border-2 border-background',
                      'bg-muted flex items-center justify-center text-xs font-semibold',
                      'cursor-pointer transition-transform hover:scale-110 hover:z-10'
                    )}
                  >
                    +{remainingCount}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-card">
                  <div className="space-y-1">
                    {otherUsers.slice(maxVisible).map((user) => (
                      <div key={user.userId} className="flex items-center gap-2">
                        <div
                          className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white"
                          style={{ backgroundColor: user.userColor }}
                        >
                          {user.userName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm">{user.userName}</span>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  )
}
