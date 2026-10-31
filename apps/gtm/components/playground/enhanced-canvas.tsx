'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  GripVertical,
  Plus,
  Trash2,
  Copy,
  Maximize2,
  Minimize2,
  Sparkles,
  Eye,
  Code,
  Palette,
  Layout,
  ChevronDown,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface Block {
  id: string
  type: 'hero' | 'features' | 'testimonials' | 'pricing' | 'cta' | 'faq' | 'stats' | 'logos' | 'custom'
  html: string
  height: 'auto' | 'small' | 'medium' | 'large' | 'full'
  claims?: Array<{
    text: string
    status: 'valid' | 'warning' | 'error' | 'pending'
    message?: string
  }>
  templateId?: string
}

interface EnhancedCanvasProps {
  blocks: Block[]
  onBlocksChange: (blocks: Block[]) => void
  selectedBlockId?: string
  onSelectBlock?: (id: string | undefined) => void
  brandId?: string
  onGenerateSection?: (type: string) => Promise<{ html: string; claims: string[] }>
  onValidateClaims?: (claims: string[]) => Promise<Array<{ text: string; status: string; message?: string }>>
}

const SECTION_TYPES = [
  { id: 'hero', label: 'Hero', icon: '🚀', description: 'Main headline and CTA' },
  { id: 'features', label: 'Features', icon: '✨', description: 'Feature grid or list' },
  { id: 'testimonials', label: 'Testimonials', icon: '💬', description: 'Customer quotes' },
  { id: 'pricing', label: 'Pricing', icon: '💰', description: 'Pricing tables' },
  { id: 'cta', label: 'CTA', icon: '🎯', description: 'Call to action' },
  { id: 'faq', label: 'FAQ', icon: '❓', description: 'Common questions' },
  { id: 'stats', label: 'Stats', icon: '📊', description: 'Metrics and numbers' },
  { id: 'logos', label: 'Logos', icon: '🏢', description: 'Client/partner logos' },
]

const HEIGHT_OPTIONS = [
  { id: 'auto', label: 'Auto', value: 'auto' },
  { id: 'small', label: 'Small', value: '200px' },
  { id: 'medium', label: 'Medium', value: '400px' },
  { id: 'large', label: 'Large', value: '600px' },
  { id: 'full', label: 'Full', value: '100vh' },
]

export function EnhancedCanvas({
  blocks,
  onBlocksChange,
  selectedBlockId,
  onSelectBlock,
  brandId,
  onGenerateSection,
  onValidateClaims,
}: EnhancedCanvasProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview')
  const [isAddingBlock, setIsAddingBlock] = useState(false)
  const [generatingType, setGeneratingType] = useState<string | null>(null)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [pickerPosition, setPickerPosition] = useState<number | null>(null)

  // Handle block reordering
  const handleReorder = useCallback((newOrder: Block[]) => {
    onBlocksChange(newOrder)
  }, [onBlocksChange])

  // Add new block
  const addBlock = useCallback(async (type: string, position?: number) => {
    setGeneratingType(type)
    setIsAddingBlock(true)

    try {
      let html = ''
      let claims: string[] = []

      // Generate content if generator is provided
      if (onGenerateSection) {
        const result = await onGenerateSection(type)
        html = result.html
        claims = result.claims
      } else {
        // Fallback placeholder
        html = `<section class="py-20 px-6 bg-gradient-to-b from-slate-900 to-slate-800">
          <div class="max-w-6xl mx-auto text-center">
            <h2 class="text-4xl font-bold text-white mb-4">${type.charAt(0).toUpperCase() + type.slice(1)} Section</h2>
            <p class="text-muted-foreground">Add your content here</p>
          </div>
        </section>`
      }

      const newBlock: Block = {
        id: `block-${Date.now()}`,
        type: type as Block['type'],
        html,
        height: 'auto',
        claims: claims.map(c => ({ text: c, status: 'pending' as const })),
      }

      // Validate claims if validator provided
      if (claims.length && onValidateClaims) {
        const validated = await onValidateClaims(claims)
        newBlock.claims = validated.map(v => ({
          text: v.text,
          status: v.status as 'valid' | 'warning' | 'error' | 'pending',
          message: v.message,
        }))
      }

      const newBlocks = [...blocks]
      if (position !== undefined) {
        newBlocks.splice(position, 0, newBlock)
      } else {
        newBlocks.push(newBlock)
      }

      onBlocksChange(newBlocks)
      onSelectBlock?.(newBlock.id)
    } finally {
      setGeneratingType(null)
      setIsAddingBlock(false)
      setTemplatePickerOpen(false)
    }
  }, [blocks, onBlocksChange, onSelectBlock, onGenerateSection, onValidateClaims])

  // Duplicate block
  const duplicateBlock = useCallback((blockId: string) => {
    const blockIndex = blocks.findIndex(b => b.id === blockId)
    if (blockIndex === -1) return

    const block = blocks[blockIndex]
    const newBlock = {
      ...block,
      id: `block-${Date.now()}`,
    }

    const newBlocks = [...blocks]
    newBlocks.splice(blockIndex + 1, 0, newBlock)
    onBlocksChange(newBlocks)
  }, [blocks, onBlocksChange])

  // Remove block
  const removeBlock = useCallback((blockId: string) => {
    onBlocksChange(blocks.filter(b => b.id !== blockId))
    if (selectedBlockId === blockId) {
      onSelectBlock?.(undefined)
    }
  }, [blocks, onBlocksChange, selectedBlockId, onSelectBlock])

  // Update block height
  const updateBlockHeight = useCallback((blockId: string, height: Block['height']) => {
    onBlocksChange(blocks.map(b => 
      b.id === blockId ? { ...b, height } : b
    ))
  }, [blocks, onBlocksChange])

  // Update block HTML
  const updateBlockHtml = useCallback((blockId: string, html: string) => {
    onBlocksChange(blocks.map(b => 
      b.id === blockId ? { ...b, html } : b
    ))
  }, [blocks, onBlocksChange])

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b bg-background/95 backdrop-blur p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPickerPosition(blocks.length)
              setTemplatePickerOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>

          <div className="h-6 w-px bg-border mx-2" />

          <div className="flex items-center rounded-lg border p-0.5">
            <Button
              variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => setViewMode('preview')}
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
            <Button
              variant={viewMode === 'code' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => setViewMode('code')}
            >
              <Code className="h-4 w-4 mr-1" />
              Code
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Layout className="h-4 w-4" />
          {blocks.length} sections
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-slate-950">
        {blocks.length === 0 ? (
          <EmptyCanvas onAddSection={() => setTemplatePickerOpen(true)} />
        ) : (
          <Reorder.Group
            axis="y"
            values={blocks}
            onReorder={handleReorder}
            className="space-y-0"
          >
            <AnimatePresence mode="popLayout">
              {blocks.map((block, index) => (
                <Reorder.Item
                  key={block.id}
                  value={block}
                  className="relative group"
                >
                  <BlockItem
                    block={block}
                    isSelected={selectedBlockId === block.id}
                    viewMode={viewMode}
                    onSelect={() => onSelectBlock?.(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                    onRemove={() => removeBlock(block.id)}
                    onHeightChange={(height) => updateBlockHeight(block.id, height)}
                    onHtmlChange={(html) => updateBlockHtml(block.id, html)}
                    onInsertBefore={() => {
                      setPickerPosition(index)
                      setTemplatePickerOpen(true)
                    }}
                    onInsertAfter={() => {
                      setPickerPosition(index + 1)
                      setTemplatePickerOpen(true)
                    }}
                  />
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </div>

      {/* Section Picker Dialog */}
      <Dialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Section</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {SECTION_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => addBlock(type.id, pickerPosition ?? undefined)}
                disabled={generatingType === type.id}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all hover:border-primary hover:bg-primary/5',
                  generatingType === type.id && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{type.icon}</span>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {type.label}
                      {generatingType === type.id && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{type.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              AI will generate content based on your campaign brief and brand guidelines
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyCanvas({ onAddSection }: { onAddSection: () => void }) {
  return (
    <div className="h-full flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center p-12"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
          <Layout className="h-10 w-10 text-indigo-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Start Building Your Page
        </h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          Add sections to build your landing page. AI will generate content that matches your brand.
        </p>
        <Button
          onClick={onAddSection}
          className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add First Section
        </Button>
      </motion.div>
    </div>
  )
}

interface BlockItemProps {
  block: Block
  isSelected: boolean
  viewMode: 'preview' | 'code'
  onSelect: () => void
  onDuplicate: () => void
  onRemove: () => void
  onHeightChange: (height: Block['height']) => void
  onHtmlChange: (html: string) => void
  onInsertBefore: () => void
  onInsertAfter: () => void
}

function BlockItem({
  block,
  isSelected,
  viewMode,
  onSelect,
  onDuplicate,
  onRemove,
  onHeightChange,
  onHtmlChange,
  onInsertBefore,
  onInsertAfter,
}: BlockItemProps) {
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)

  const hasIssues = block.claims?.some(c => c.status === 'error' || c.status === 'warning')

  // Get height style
  const getHeightStyle = () => {
    const option = HEIGHT_OPTIONS.find(h => h.id === block.height)
    return option?.value || 'auto'
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        'relative border-y border-transparent transition-all',
        isSelected && 'border-indigo-500 ring-1 ring-indigo-500/50'
      )}
      onClick={onSelect}
    >
      {/* Block Controls - Top Bar */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 py-1.5 bg-gradient-to-b from-slate-900/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity',
          isSelected && 'opacity-100'
        )}
      >
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          <div className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-card/10">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Section Type Badge */}
          <Badge variant="secondary" className="capitalize">
            {block.type}
          </Badge>

          {/* Compliance Status */}
          {block.claims && block.claims.length > 0 && (
            <Badge
              variant={hasIssues ? 'destructive' : 'outline'}
              className={cn(!hasIssues && 'bg-green-500/10 text-green-400 border-green-500/30')}
            >
              {hasIssues ? (
                <AlertCircle className="h-3 w-3 mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              {block.claims.length} claims
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Insert Before */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-white"
            onClick={(e) => {
              e.stopPropagation()
              onInsertBefore()
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* Height Picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {HEIGHT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.id}
                  onClick={() => onHeightChange(option.id as Block['height'])}
                >
                  {block.height === option.id && (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Duplicate */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-white"
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate()
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>

          {/* Delete */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        style={{ 
          minHeight: getHeightStyle() === 'auto' ? '100px' : getHeightStyle(),
          height: getHeightStyle() === 'auto' ? 'auto' : getHeightStyle(),
        }}
        className="overflow-hidden"
      >
        {viewMode === 'preview' ? (
          <div
            className="w-full"
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        ) : (
          <pre className="p-4 text-xs text-slate-300 bg-card/40 backdrop-blur-sm overflow-auto max-h-96">
            <code>{block.html}</code>
          </pre>
        )}
      </div>

      {/* Insert After Indicator */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
        onClick={(e) => {
          e.stopPropagation()
          onInsertAfter()
        }}
      >
        <div className="absolute left-1/2 -translate-x-1/2 -top-3 px-2 py-0.5 bg-indigo-500 rounded text-xs text-white opacity-0 group-hover:opacity-100">
          <Plus className="h-3 w-3 inline" /> Insert
        </div>
      </div>
    </motion.div>
  )
}
