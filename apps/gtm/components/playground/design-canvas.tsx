'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { nanoid } from 'nanoid'
import { Loader2, Sparkles, Eye, Code, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { AnimatedLinearGauge } from '@/components/ui/animated-gauge'
import { BlockPalette, BLOCK_TYPES } from './block-palette'
import { CanvasBlock, type CanvasBlockData } from './canvas-block'
import { BlockEditor } from './block-editor'

interface DesignCanvasProps {
  campaignId?: string
  initialBlocks?: CanvasBlockData[]
  onBlocksChange?: (blocks: CanvasBlockData[]) => void
}

export function DesignCanvas({ campaignId, initialBlocks = [], onBlocksChange }: DesignCanvasProps) {
  const { toast } = useToast()
  const [blocks, setBlocks] = useState<CanvasBlockData[]>(initialBlocks)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [trustScore, setTrustScore] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId)

  // Notify parent of changes
  useEffect(() => {
    onBlocksChange?.(blocks)
  }, [blocks, onBlocksChange])

  // Validate blocks on change (debounced)
  useEffect(() => {
    if (blocks.length === 0) {
      setTrustScore(null)
      return
    }

    const timer = setTimeout(() => {
      validateBlocks()
    }, 1000)

    return () => clearTimeout(timer)
  }, [blocks])

  const validateBlocks = async () => {
    setValidating(true)
    try {
      // Extract all text content
      const claims: Array<{ id: string; text: string }> = []
      
      blocks.forEach((block) => {
        Object.entries(block.content).forEach(([key, value]) => {
          if (typeof value === 'string' && value.length > 5) {
            claims.push({ id: `${block.id}-${key}`, text: value })
          }
          if (Array.isArray(value)) {
            value.forEach((item, i) => {
              if (typeof item === 'object') {
                Object.entries(item as Record<string, unknown>).forEach(([k, v]) => {
                  if (typeof v === 'string' && v.length > 5) {
                    claims.push({ id: `${block.id}-${key}-${i}-${k}`, text: v })
                  }
                })
              }
            })
          }
        })
      })

      const response = await fetch('/api/claims/validate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claims }),
      })

      if (!response.ok) throw new Error('Validation failed')

      const results = await response.json()

      // Update blocks with violations
      const updatedBlocks = blocks.map((block) => {
        const blockViolations: CanvasBlockData['violations'] = []

        results.results.forEach((result: { id: string; status: string; reasonCodes: string[] }) => {
          if (result.id.startsWith(block.id) && result.status !== 'approved') {
            const parts = result.id.replace(`${block.id}-`, '').split('-')
            const field = parts[0]
            blockViolations.push({
              field,
              message: result.reasonCodes.join(', '),
              severity: result.status === 'blocked' ? 'error' : 'warning',
            })
          }
        })

        return { ...block, violations: blockViolations }
      })

      setBlocks(updatedBlocks)

      // Calculate trust score
      const totalClaims = claims.length
      const violations = results.results.filter((r: { status: string }) => r.status !== 'approved').length
      const score = totalClaims > 0 ? Math.round(((totalClaims - violations) / totalClaims) * 100) : 100
      setTrustScore(score)
    } catch (error) {
      console.error('Validation error:', error)
    } finally {
      setValidating(false)
    }
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    // Check if dropping from palette
    if (String(active.id).startsWith('palette-')) {
      const blockType = active.data.current?.blockType
      if (blockType) {
        const newBlock: CanvasBlockData = {
          id: nanoid(),
          type: blockType,
          content: getDefaultContent(blockType),
        }
        
        // Find insertion index
        const overIndex = blocks.findIndex((b) => b.id === over.id)
        if (overIndex >= 0) {
          setBlocks((prev) => [
            ...prev.slice(0, overIndex + 1),
            newBlock,
            ...prev.slice(overIndex + 1),
          ])
        } else {
          setBlocks((prev) => [...prev, newBlock])
        }
        setSelectedBlockId(newBlock.id)
      }
      return
    }

    // Reordering existing blocks
    if (active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }, [blocks])

  const handleBlockUpdate = useCallback((blockId: string, updates: Partial<CanvasBlockData['content']>) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, content: { ...b.content, ...updates } } : b
      )
    )
  }, [])

  const handleBlockDelete = useCallback((blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId))
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null)
    }
  }, [selectedBlockId])

  const handleRegenerate = async () => {
    if (!selectedBlock) return

    toast({ title: 'Regenerating...', description: 'Getting new content for this block' })

    try {
      const response = await fetch('/api/templates/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: [{ category: selectedBlock.type, description: `${selectedBlock.type} section` }],
        }),
      })

      if (response.ok) {
        const { results } = await response.json()
        const templates = results[selectedBlock.type]
        if (templates && templates.length > 0) {
          // Use the first template's structure as inspiration
          toast({ title: 'Template found!', description: 'You can apply template styles' })
        }
      }
    } catch (error) {
      console.error('Regenerate error:', error)
    }
  }

  const exportHTML = () => {
    const html = blocks.map((block) => generateBlockHTML(block)).join('\n')
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `landing-page-${Date.now()}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Exported!', description: 'HTML file downloaded' })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full">
        {/* Left: Block Palette */}
        <div className="w-64 border-r bg-muted/30 p-4 overflow-y-auto">
          <BlockPalette />
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-4">
              <h2 className="font-medium">Design Canvas</h2>
              {trustScore !== null && (
                <AnimatedLinearGauge
                  value={trustScore}
                  className="w-32"
                  showValue
                />
              )}
              {validating && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Validating...
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportHTML}>
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-muted/20">
            {blocks.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center">
                <div className="max-w-md">
                  <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium text-lg mb-2">Start Building</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Drag blocks from the left panel to start designing your landing page.
                  </p>
                </div>
              </div>
            ) : (
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4 max-w-3xl mx-auto">
                  {blocks.map((block) => (
                    <CanvasBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedBlockId === block.id}
                      onSelect={() => setSelectedBlockId(block.id)}
                      onDelete={() => handleBlockDelete(block.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            )}
          </div>
        </div>

        {/* Right: Properties Panel */}
        {selectedBlock && (
          <div className="w-80 border-l bg-card">
            <BlockEditor
              block={selectedBlock}
              onUpdate={(updates) => handleBlockUpdate(selectedBlock.id, updates)}
              onClose={() => setSelectedBlockId(null)}
              onRegenerate={handleRegenerate}
            />
          </div>
        )}
      </div>

      <DragOverlay>
        {activeId && activeId.startsWith('palette-') ? (
          <div className="p-3 rounded-lg border bg-card shadow-lg">
            {BLOCK_TYPES.find((t) => `palette-${t.id}` === activeId)?.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function getDefaultContent(blockType: string): Record<string, unknown> {
  switch (blockType) {
    case 'hero':
      return {
        headline: 'Your Compelling Headline Here',
        subheadline: 'A clear and concise value proposition that explains what you offer.',
        cta_text: 'Get Started',
      }
    case 'features':
      return {
        items: [
          { title: 'Feature One', description: 'Description of this amazing feature.', icon: 'zap' },
          { title: 'Feature Two', description: 'Description of another great feature.', icon: 'shield' },
          { title: 'Feature Three', description: 'One more feature to highlight.', icon: 'rocket' },
        ],
      }
    case 'testimonials':
      return {
        items: [
          { quote: 'This product changed our workflow completely.', author: 'Jane Doe', company: 'Acme Inc' },
        ],
      }
    case 'cta':
      return {
        headline: 'Ready to Get Started?',
        description: 'Join thousands of satisfied customers today.',
        button_text: 'Start Free Trial',
      }
    default:
      return {}
  }
}

function generateBlockHTML(block: CanvasBlockData): string {
  // Generate basic HTML from block content
  const content = block.content
  
  switch (block.type) {
    case 'hero':
      return `
<section class="py-20 px-4 text-center">
  <h1 class="text-4xl font-bold mb-4">${content.headline || ''}</h1>
  <p class="text-xl text-muted-foreground mb-8">${content.subheadline || ''}</p>
  <button class="bg-primary text-white px-6 py-3 rounded-lg">${content.cta_text || 'Get Started'}</button>
</section>`
    case 'features':
      const items = (content.items as Array<{ title: string; description: string }>) || []
      return `
<section class="py-16 px-4">
  <div class="grid grid-cols-3 gap-8">
    ${items.map((item) => `
    <div class="text-center">
      <h3 class="text-xl font-semibold mb-2">${item.title}</h3>
      <p class="text-muted-foreground">${item.description}</p>
    </div>`).join('')}
  </div>
</section>`
    default:
      return `<section class="py-16 px-4"><!-- ${block.type} block --></section>`
  }
}
