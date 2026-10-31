'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { 
  Layout, 
  Grid3X3, 
  DollarSign, 
  Quote, 
  HelpCircle, 
  Zap, 
  Users, 
  BarChart3,
  Image,
  MessageSquare,
  ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const BLOCK_TYPES = [
  { id: 'hero', name: 'Hero', icon: Layout, description: 'Main headline section' },
  { id: 'features', name: 'Features', icon: Grid3X3, description: 'Feature grid' },
  { id: 'pricing', name: 'Pricing', icon: DollarSign, description: 'Pricing table' },
  { id: 'testimonials', name: 'Testimonials', icon: Quote, description: 'Customer quotes' },
  { id: 'faq', name: 'FAQ', icon: HelpCircle, description: 'Questions & answers' },
  { id: 'cta', name: 'CTA', icon: Zap, description: 'Call to action' },
  { id: 'logos', name: 'Logos', icon: Users, description: 'Trust badges' },
  { id: 'stats', name: 'Stats', icon: BarChart3, description: 'Key metrics' },
  { id: 'gallery', name: 'Gallery', icon: Image, description: 'Image showcase' },
  { id: 'contact', name: 'Contact', icon: MessageSquare, description: 'Contact form' },
]

interface DraggableBlockProps {
  type: typeof BLOCK_TYPES[number]
}

function DraggableBlock({ type }: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${type.id}`,
    data: { type: 'new-block', blockType: type.id },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  const Icon = type.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border border-border bg-card cursor-grab hover:border-primary/50 transition-colors',
        isDragging && 'cursor-grabbing shadow-lg'
      )}
    >
      <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{type.name}</div>
        <div className="text-xs text-muted-foreground truncate">{type.description}</div>
      </div>
    </div>
  )
}

interface BlockPaletteProps {
  className?: string
}

export function BlockPalette({ className }: BlockPaletteProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 mb-3">
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Drag blocks to canvas</span>
      </div>
      {BLOCK_TYPES.map((type) => (
        <DraggableBlock key={type.id} type={type} />
      ))}
    </div>
  )
}
