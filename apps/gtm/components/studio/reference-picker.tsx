'use client'

/**
 * Studio Reference Picker Component
 * 
 * A variant of the reference picker optimized for Studio app instructions.
 * Focuses on brand, audience, and knowledge base references.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Palette,
  Users,
  FileText,
  Search,
  ChevronRight,
  Loader2,
  AtSign,
  Database,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  Reference,
  ReferenceType,
  searchReferences,
} from '@/lib/ai/context-reference'

interface StudioReferencePickerProps {
  workspaceId: string
  isOpen: boolean
  position: { x: number; y: number }
  query: string
  onSelect: (reference: Reference, insertText: string) => void
  onClose: () => void
}

// Studio uses a subset of reference types
const STUDIO_TYPES: ReferenceType[] = ['brand', 'audience']

const TYPE_ICONS: Record<string, React.ElementType> = {
  brand: Palette,
  audience: Users,
  knowledge: Database,
  input: FileText,
}

const TYPE_COLORS: Record<string, string> = {
  brand: 'text-pink-500 bg-pink-500/10',
  audience: 'text-green-500 bg-green-500/10',
  knowledge: 'text-blue-500 bg-blue-500/10',
  input: 'text-amber-500 bg-amber-500/10',
}

interface StudioReference extends Reference {
  insertSyntax: string
}

export function StudioReferencePicker({
  workspaceId,
  isOpen,
  position,
  query,
  onSelect,
  onClose,
}: StudioReferencePickerProps) {
  const [results, setResults] = useState<StudioReference[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch results when query changes
  useEffect(() => {
    if (!isOpen) return

    const fetchResults = async () => {
      setIsLoading(true)
      try {
        const searchResults = await searchReferences(
          workspaceId,
          query,
          STUDIO_TYPES,
          10
        )

        // Add insert syntax for each result
        const withSyntax: StudioReference[] = searchResults.map((ref) => ({
          ...ref,
          insertSyntax: `{{${ref.type}.${ref.name.toLowerCase().replace(/\s+/g, '_')}}}`,
        }))

        setResults(withSyntax)
        setSelectedIndex(0)
      } catch (error) {
        console.error('Failed to search references:', error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchResults()
  }, [workspaceId, isOpen, query])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1
          )
          break
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          if (results[selectedIndex]) {
            const ref = results[selectedIndex]
            onSelect(ref, ref.insertSyntax)
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex, onSelect, onClose])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        className="fixed z-50 w-72 bg-popover border rounded-lg shadow-xl overflow-hidden"
        style={{ left: position.x, top: position.y }}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2 text-sm">
            <AtSign className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Insert reference</span>
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[250px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length > 0 ? (
            <div className="py-1">
              {results.map((ref, index) => {
                const Icon = TYPE_ICONS[ref.type] || Database
                return (
                  <button
                    key={`${ref.type}-${ref.id}`}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                      index === selectedIndex
                        ? 'bg-primary/10'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => onSelect(ref, ref.insertSyntax)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div
                      className={cn(
                        'w-7 h-7 rounded flex items-center justify-center',
                        TYPE_COLORS[ref.type] || 'bg-muted'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {ref.name}
                      </div>
                      <code className="text-xs text-muted-foreground">
                        {ref.insertSyntax}
                      </code>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : query ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm">No references found</p>
            </div>
          ) : (
            // Show available types when no query
            <div className="py-2">
              <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase">
                Available References
              </div>
              {[
                {
                  type: 'brand',
                  label: 'Brand Voice',
                  desc: 'Insert brand guidelines',
                },
                {
                  type: 'audience',
                  label: 'Audience',
                  desc: 'Insert audience profile',
                },
              ].map((item, index) => {
                const Icon = TYPE_ICONS[item.type]
                return (
                  <div
                    key={item.type}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2',
                      index === selectedIndex ? 'bg-muted/50' : ''
                    )}
                  >
                    <div
                      className={cn(
                        'w-7 h-7 rounded flex items-center justify-center',
                        TYPE_COLORS[item.type]
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                )
              })}
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Type to search for specific {STUDIO_TYPES.join(' or ')}
              </p>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t bg-muted/30 flex items-center gap-4 text-xs text-muted-foreground">
          <span>↑↓ Navigate</span>
          <span>↵ Insert</span>
          <span>Esc Close</span>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Hook to detect @ trigger in textarea
 */
export function useStudioAtTrigger(
  textareaRef: React.RefObject<HTMLTextAreaElement>,
  onTrigger: (position: { x: number; y: number }, query: string) => void,
  onQueryChange: (query: string) => void,
  onClose: () => void
) {
  const [isActive, setIsActive] = useState(false)
  const atPositionRef = useRef<number | null>(null)

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const value = textarea.value
    const cursorPos = textarea.selectionStart

    // Check if we just typed @
    if (value[cursorPos - 1] === '@') {
      // Get position for dropdown
      const rect = textarea.getBoundingClientRect()
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20
      const lines = value.slice(0, cursorPos).split('\n')
      const currentLine = lines.length - 1
      
      const x = rect.left + 20 // Approximate x
      const y = rect.top + (currentLine + 1) * lineHeight + 5

      atPositionRef.current = cursorPos - 1
      setIsActive(true)
      onTrigger({ x: Math.min(x, window.innerWidth - 300), y: Math.min(y, window.innerHeight - 300) }, '')
    } else if (isActive && atPositionRef.current !== null) {
      // Update query while @ picker is active
      const query = value.slice(atPositionRef.current + 1, cursorPos)
      
      // Close if space or special char entered
      if (query.includes(' ') || query.includes('\n') || cursorPos <= atPositionRef.current) {
        setIsActive(false)
        atPositionRef.current = null
        onClose()
      } else {
        onQueryChange(query)
      }
    }
  }, [isActive, textareaRef, onTrigger, onQueryChange, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isActive && (e.key === 'Escape' || e.key === ' ')) {
        setIsActive(false)
        atPositionRef.current = null
        onClose()
      }
    },
    [isActive, onClose]
  )

  const insertReference = useCallback(
    (insertText: string) => {
      const textarea = textareaRef.current
      if (!textarea || atPositionRef.current === null) return

      const value = textarea.value
      const start = atPositionRef.current
      const end = textarea.selectionStart

      const newValue = value.slice(0, start) + insertText + ' ' + value.slice(end)
      textarea.value = newValue

      // Move cursor after inserted text
      const newCursorPos = start + insertText.length + 1
      textarea.selectionStart = newCursorPos
      textarea.selectionEnd = newCursorPos
      textarea.focus()

      // Trigger input event for React
      textarea.dispatchEvent(new Event('input', { bubbles: true }))

      setIsActive(false)
      atPositionRef.current = null
      onClose()
    },
    [textareaRef, onClose]
  )

  return {
    isActive,
    handleInput,
    handleKeyDown,
    insertReference,
    close: () => {
      setIsActive(false)
      atPositionRef.current = null
      onClose()
    },
  }
}
