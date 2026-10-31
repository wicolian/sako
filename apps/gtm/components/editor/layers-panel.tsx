'use client'

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { GripVertical, Trash2, Copy, Eye, EyeOff, ChevronRight, ChevronDown, Layout, Sparkles, MessageSquare, DollarSign, HelpCircle, Target, BarChart3, Building2, Users, Mail, Image, Clock, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import type { WebsiteSection, SectionType } from '@/lib/website/ai-designer'

interface LayersPanelProps {
  sections: WebsiteSection[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder: (sections: WebsiteSection[]) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}

const SECTION_ICONS: Record<SectionType, React.ReactNode> = {
  hero: <Layout className="h-4 w-4" />,
  features: <Sparkles className="h-4 w-4" />,
  testimonials: <MessageSquare className="h-4 w-4" />,
  pricing: <DollarSign className="h-4 w-4" />,
  faq: <HelpCircle className="h-4 w-4" />,
  cta: <Target className="h-4 w-4" />,
  about: <FileText className="h-4 w-4" />,
  team: <Users className="h-4 w-4" />,
  contact: <Mail className="h-4 w-4" />,
  gallery: <Image className="h-4 w-4" />,
  stats: <BarChart3 className="h-4 w-4" />,
  logos: <Building2 className="h-4 w-4" />,
  comparison: <BarChart3 className="h-4 w-4" />,
  timeline: <Clock className="h-4 w-4" />,
  blog: <FileText className="h-4 w-4" />,
  custom: <Layout className="h-4 w-4" />,
}

export function LayersPanel({
  sections,
  selectedId,
  onSelect,
  onReorder,
  onDelete,
  onDuplicate,
}: LayersPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const sortedSections = [...sections].sort((a, b) => a.order - b.order)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = sortedSections.findIndex(s => s.id === active.id)
      const newIndex = sortedSections.findIndex(s => s.id === over.id)
      const reordered = arrayMove(sortedSections, oldIndex, newIndex)
      onReorder(reordered.map((s, i) => ({ ...s, order: i })))
    }
  }

  if (sections.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-muted-foreground">No layers yet</p>
        <p className="text-xs text-muted-foreground mt-1">Add sections from the Add tab</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedSections.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="p-2 space-y-1">
            {sortedSections.map((section) => (
              <SortableLayer
                key={section.id}
                section={section}
                isSelected={selectedId === section.id}
                onSelect={() => onSelect(section.id)}
                onDelete={() => onDelete(section.id)}
                onDuplicate={() => onDuplicate(section.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

interface SortableLayerProps {
  section: WebsiteSection
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
}

function SortableLayer({
  section,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: SortableLayerProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <motion.div
          ref={setNodeRef}
          style={style}
          onClick={onSelect}
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group',
            isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
            isDragging && 'opacity-50'
          )}
        >
          <button
            className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          
          <span className={cn('shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')}>
            {SECTION_ICONS[section.type]}
          </span>
          
          <span className="text-sm truncate flex-1 capitalize">
            {section.content.headline || section.type}
          </span>
        </motion.div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={onSelect}>
          <Eye className="h-4 w-4 mr-2" />
          Select
        </ContextMenuItem>
        <ContextMenuItem onClick={onDuplicate}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
