'use client'

/**
 * Reference Picker Component
 * 
 * Autocomplete dropdown for @ references in the editor.
 * Allows users to inject templates, components, snippets, brands, and audiences.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileCode2,
  Component,
  Code2,
  Palette,
  Users,
  Search,
  ChevronRight,
  Loader2,
  AtSign,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  Reference,
  ReferenceType,
  searchReferences,
  getReferenceHelp,
} from '@/lib/ai/context-reference'

interface ReferencePickerProps {
  workspaceId: string
  isOpen: boolean
  position: { x: number; y: number }
  activeType: ReferenceType | null
  query: string
  onSelect: (reference: Reference) => void
  onClose: () => void
}

const TYPE_ICONS: Record<ReferenceType, React.ElementType> = {
  template: FileCode2,
  component: Component,
  snippet: Code2,
  brand: Palette,
  audience: Users,
}

const TYPE_COLORS: Record<ReferenceType, string> = {
  template: 'text-blue-500 bg-blue-500/10',
  component: 'text-purple-500 bg-purple-500/10',
  snippet: 'text-amber-500 bg-amber-500/10',
  brand: 'text-pink-500 bg-pink-500/10',
  audience: 'text-green-500 bg-green-500/10',
}

export function ReferencePicker({
  workspaceId,
  isOpen,
  position,
  activeType,
  query,
  onSelect,
  onClose,
}: ReferencePickerProps) {
  const [results, setResults] = useState<Reference[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch results when query or type changes
  useEffect(() => {
    if (!isOpen) return

    const fetchResults = async () => {
      setIsLoading(true)
      try {
        const types = activeType ? [activeType] : undefined
        const searchResults = await searchReferences(
          workspaceId,
          query,
          types,
          10
        )
        setResults(searchResults)
        setSelectedIndex(0)
      } catch (error) {
        console.error('Failed to search references:', error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchResults()
  }, [workspaceId, isOpen, activeType, query])

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
            onSelect(results[selectedIndex])
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

  const help = getReferenceHelp()

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="fixed z-50 w-80 bg-popover border rounded-lg shadow-xl overflow-hidden"
      style={{ left: position.x, top: position.y }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AtSign className="h-4 w-4" />
          {activeType ? (
            <>
              <span className="capitalize">{activeType}s</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground">{query || 'Search...'}</span>
            </>
          ) : (
            <span>Type to search or select a type</span>
          )}
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="max-h-[300px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : results.length > 0 ? (
          <div className="py-1">
            {results.map((ref, index) => {
              const Icon = TYPE_ICONS[ref.type]
              return (
                <button
                  key={`${ref.type}-${ref.id}`}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                    index === selectedIndex
                      ? 'bg-primary/10'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() => onSelect(ref)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded flex items-center justify-center',
                      TYPE_COLORS[ref.type]
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {ref.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      @{ref.type}:{ref.name.toLowerCase().replace(/\s+/g, '-')}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {ref.type}
                  </Badge>
                </button>
              )
            })}
          </div>
        ) : query ? (
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-sm">No results found</p>
            <p className="text-xs mt-1">Try a different search term</p>
          </div>
        ) : (
          // Show type selection when no query
          <div className="py-2">
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase">
              Reference Types
            </div>
            {help.map((item, index) => {
              const Icon = TYPE_ICONS[item.type]
              return (
                <button
                  key={item.type}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                    index === selectedIndex
                      ? 'bg-primary/10'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() =>
                    onSelect({ type: item.type, id: '', name: '' })
                  }
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded flex items-center justify-center',
                      TYPE_COLORS[item.type]
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm capitalize">
                      {item.type}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {item.syntax}
                  </code>
                </button>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="px-3 py-2 border-t bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
        <span>Esc Close</span>
      </div>
    </motion.div>
  )
}

/**
 * Hook to manage reference picker state
 */
export function useReferencePicker(workspaceId: string) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [activeType, setActiveType] = useState<ReferenceType | null>(null)
  const [query, setQuery] = useState('')

  const open = useCallback(
    (pos: { x: number; y: number }, type?: ReferenceType, q?: string) => {
      setPosition(pos)
      setActiveType(type || null)
      setQuery(q || '')
      setIsOpen(true)
    },
    []
  )

  const close = useCallback(() => {
    setIsOpen(false)
    setActiveType(null)
    setQuery('')
  }, [])

  const updateQuery = useCallback((q: string) => {
    setQuery(q)
  }, [])

  const handleSelect = useCallback(
    (ref: Reference, onInsert: (text: string) => void) => {
      if (!ref.id) {
        // Type selected, update state to filter by type
        setActiveType(ref.type)
        setQuery('')
      } else {
        // Reference selected, insert it
        const syntax = ref.name.includes(' ')
          ? `@${ref.type}:"${ref.name}"`
          : `@${ref.type}:${ref.name.toLowerCase().replace(/\s+/g, '-')}`
        onInsert(syntax)
        close()
      }
    },
    [close]
  )

  return {
    isOpen,
    position,
    activeType,
    query,
    open,
    close,
    updateQuery,
    handleSelect,
    pickerProps: {
      workspaceId,
      isOpen,
      position,
      activeType,
      query,
      onClose: close,
    },
  }
}
