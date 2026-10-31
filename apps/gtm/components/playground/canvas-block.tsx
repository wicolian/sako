'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Pencil, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { BLOCK_TYPES } from './block-palette'

export interface CanvasBlockData {
  id: string
  type: string
  content: Record<string, unknown>
  violations?: Array<{
    field: string
    message: string
    severity: 'warning' | 'error'
  }>
}

interface CanvasBlockProps {
  block: CanvasBlockData
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

export function CanvasBlock({ block, isSelected, onSelect, onDelete }: CanvasBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const blockType = BLOCK_TYPES.find((t) => t.id === block.type)
  const Icon = blockType?.icon || GripVertical
  const hasViolations = block.violations && block.violations.length > 0
  const hasErrors = block.violations?.some((v) => v.severity === 'error')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group rounded-lg border-2 bg-card transition-all',
        isDragging && 'opacity-50 shadow-2xl z-50',
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
        hasErrors && 'border-red-500/50',
        hasViolations && !hasErrors && 'border-amber-500/50'
      )}
      onClick={onSelect}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing bg-muted/50 rounded-l-lg opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Block content */}
      <div className="ml-8 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary/10 rounded flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <span className="font-medium text-sm">{blockType?.name || block.type}</span>
            {hasViolations ? (
              <Badge variant="outline" className={cn(
                hasErrors ? 'border-red-500 text-red-500' : 'border-amber-500 text-amber-500'
              )}>
                <AlertTriangle className="w-3 h-3 mr-1" />
                {block.violations!.length}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-green-500 text-green-500">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Compliant
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSelect}>
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="text-sm text-muted-foreground line-clamp-2">
          {renderBlockPreview(block)}
        </div>

        {/* Violations */}
        {hasViolations && (
          <div className="mt-3 space-y-1">
            {block.violations!.slice(0, 2).map((v, i) => (
              <div
                key={i}
                className={cn(
                  'text-xs px-2 py-1 rounded',
                  v.severity === 'error' 
                    ? 'bg-destructive/10 text-destructive  '
                    : 'bg-amber-500/10 text-amber-500  '
                )}
              >
                <span className="font-medium">{v.field}:</span> {v.message}
              </div>
            ))}
            {block.violations!.length > 2 && (
              <div className="text-xs text-muted-foreground">
                +{block.violations!.length - 2} more issues
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function renderBlockPreview(block: CanvasBlockData): string {
  const content = block.content

  switch (block.type) {
    case 'hero':
      return (content.headline as string) || (content.title as string) || 'Hero section'
    case 'features':
      const items = content.items as Array<{ title: string }> | undefined
      return items ? items.map((i) => i.title).join(', ') : 'Feature list'
    case 'pricing':
      return 'Pricing table with plans'
    case 'testimonials':
      return 'Customer testimonials'
    case 'faq':
      return 'Frequently asked questions'
    case 'cta':
      return (content.headline as string) || 'Call to action'
    case 'logos':
      return 'Trust logos and badges'
    case 'stats':
      return 'Key statistics and metrics'
    default:
      return `${block.type} block`
  }
}
