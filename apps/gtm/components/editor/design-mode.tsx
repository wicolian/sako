'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { GripVertical, Trash2, Copy, RefreshCw, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WebsiteDesign, WebsiteSection } from '@/lib/website/ai-designer'
import type { ViewportSize } from './editor-shell'

interface DesignModeProps {
  design: WebsiteDesign
  viewport: ViewportSize
  selectedSectionId: string | null
  onSelectSection: (id: string | null) => void
  onUpdateSection: (id: string, updates: Partial<WebsiteSection>) => void
  onReorderSections: (sections: WebsiteSection[]) => void
  onDeleteSection: (id: string) => void
  onDuplicateSection: (id: string) => void
}

const VIEWPORT_WIDTHS: Record<ViewportSize, string> = {
  desktop: 'w-full max-w-[1200px]',
  tablet: 'max-w-[768px]',
  mobile: 'max-w-[375px]',
}

export function DesignMode({
  design,
  viewport,
  selectedSectionId,
  onSelectSection,
  onUpdateSection,
  onReorderSections,
  onDeleteSection,
  onDuplicateSection,
}: DesignModeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = design.sections.findIndex(s => s.id === active.id)
      const newIndex = design.sections.findIndex(s => s.id === over.id)
      const newSections = arrayMove(design.sections, oldIndex, newIndex)
      onReorderSections(newSections)
    }
  }

  const sortedSections = [...design.sections].sort((a, b) => a.order - b.order)

  return (
    <div className="h-full overflow-auto p-6 bg-muted/30" ref={containerRef}>
      <div className={cn(
        'mx-auto bg-background shadow-2xl rounded-lg overflow-hidden min-h-full transition-all duration-300',
        VIEWPORT_WIDTHS[viewport]
      )}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedSections.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedSections.length === 0 ? (
              <div className="flex items-center justify-center h-96 text-center">
                <div>
                  <p className="text-muted-foreground mb-2">No sections yet</p>
                  <p className="text-sm text-muted-foreground">Add sections from the left panel</p>
                </div>
              </div>
            ) : (
              sortedSections.map((section) => (
                <SortableSection
                  key={section.id}
                  section={section}
                  isSelected={selectedSectionId === section.id}
                  isHovered={hoveredSectionId === section.id}
                  globalStyles={design.globalStyles}
                  onSelect={() => onSelectSection(section.id)}
                  onHover={() => setHoveredSectionId(section.id)}
                  onLeave={() => setHoveredSectionId(null)}
                  onUpdate={(updates) => onUpdateSection(section.id, updates)}
                  onDelete={() => onDeleteSection(section.id)}
                  onDuplicate={() => onDuplicateSection(section.id)}
                />
              ))
            )}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}

interface SortableSectionProps {
  section: WebsiteSection
  isSelected: boolean
  isHovered: boolean
  globalStyles: WebsiteDesign['globalStyles']
  onSelect: () => void
  onHover: () => void
  onLeave: () => void
  onUpdate: (updates: Partial<WebsiteSection>) => void
  onDelete: () => void
  onDuplicate: () => void
}

function SortableSection({
  section,
  isSelected,
  isHovered,
  globalStyles,
  onSelect,
  onHover,
  onLeave,
  onUpdate: _onUpdate,
  onDelete,
  onDuplicate,
}: SortableSectionProps) {
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
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group',
        isDragging && 'opacity-50'
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Selection/Hover outline */}
      <motion.div
        className={cn(
          'absolute inset-0 pointer-events-none border-2 z-10',
          isSelected ? 'border-primary' : isHovered ? 'border-primary/50' : 'border-transparent'
        )}
        initial={false}
        animate={{
          opacity: isSelected || isHovered ? 1 : 0,
        }}
      />

      {/* Section toolbar */}
      {(isSelected || isHovered) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-popover border rounded-lg shadow-lg p-1"
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-grab"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium px-2 capitalize">{section.type}</span>
          <div className="w-px h-4 bg-border" />
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); onDuplicate() }}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(event) => { event.stopPropagation(); onDelete() }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      )}

      {/* Section content */}
      <SectionRenderer section={section} globalStyles={globalStyles} />
    </div>
  )
}

interface SectionRendererProps {
  section: WebsiteSection
  globalStyles: WebsiteDesign['globalStyles']
}

function SectionRenderer({ section, globalStyles }: SectionRendererProps) {
  const { type, content, styles } = section

  const bgClass = styles.background === 'dark' 
    ? 'bg-card/40 backdrop-blur-sm text-white' 
    : styles.background === 'light' 
    ? 'bg-muted/10' 
    : styles.background === 'gradient'
    ? 'bg-gradient-to-br from-primary/10 to-purple-500/10'
    : 'bg-card'

  const spacingClass = styles.spacing === 'compact' 
    ? 'py-12' 
    : styles.spacing === 'spacious' 
    ? 'py-24' 
    : 'py-16'

  const alignClass = styles.alignment === 'left' 
    ? 'text-left' 
    : styles.alignment === 'right' 
    ? 'text-right' 
    : 'text-center'

  // Render based on section type
  switch (type) {
    case 'hero':
      return (
        <section className={cn(bgClass, spacingClass)}>
          <div className={cn('max-w-6xl mx-auto px-6', alignClass)}>
            {content.headline && (
              <h1 className="text-5xl font-bold mb-6 leading-tight">{content.headline}</h1>
            )}
            {content.subheadline && (
              <p className={cn('text-xl text-muted-foreground  mb-8 max-w-2xl', styles.alignment === 'center' && 'mx-auto')}>
                {content.subheadline}
              </p>
            )}
            <div className={cn('flex gap-4', styles.alignment === 'center' && 'justify-center')}>
              {content.cta && (
                <button 
                  className="px-6 py-3 rounded-lg font-medium text-white"
                  style={{ backgroundColor: globalStyles.primaryColor }}
                >
                  {content.cta.text}
                </button>
              )}
              {content.secondaryCta && (
                <button 
                  className="px-6 py-3 rounded-lg font-medium border"
                  style={{ borderColor: globalStyles.primaryColor, color: globalStyles.primaryColor }}
                >
                  {content.secondaryCta.text}
                </button>
              )}
            </div>
          </div>
        </section>
      )

    case 'features':
      const cols = styles.columns || 3
      return (
        <section className={cn(bgClass, spacingClass)}>
          <div className="max-w-6xl mx-auto px-6">
            {content.headline && (
              <h2 className={cn('text-3xl font-bold mb-4', alignClass)}>{content.headline}</h2>
            )}
            {content.subheadline && (
              <p className={cn('text-muted-foreground  mb-12', alignClass)}>{content.subheadline}</p>
            )}
            <div className={cn('grid gap-8', `grid-cols-1 md:grid-cols-${cols}`)}>
              {(content.items || []).map((item, i) => (
                <div key={i} className="p-6 rounded-xl bg-card shadow-sm border">
                  {item.icon && <div className="text-4xl mb-4">{item.icon}</div>}
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )

    case 'testimonials':
      return (
        <section className={cn(bgClass, spacingClass)}>
          <div className="max-w-6xl mx-auto px-6">
            {content.headline && (
              <h2 className={cn('text-3xl font-bold mb-12', alignClass)}>{content.headline}</h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {(content.items || []).map((item, i) => (
                <div key={i} className="p-6 rounded-xl bg-card shadow-sm border">
                  <p className="text-muted-foreground mb-4 italic">"{item.description}"</p>
                  <p className="font-semibold">{item.title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )

    case 'cta':
      return (
        <section className={cn(bgClass, spacingClass)}>
          <div className="max-w-4xl mx-auto px-6 text-center">
            {content.headline && (
              <h2 className="text-3xl font-bold mb-4">{content.headline}</h2>
            )}
            {content.subheadline && (
              <p className="text-xl text-muted-foreground mb-8">{content.subheadline}</p>
            )}
            {content.cta && (
              <button 
                className="px-8 py-4 rounded-lg font-medium text-white"
                style={{ backgroundColor: globalStyles.primaryColor }}
              >
                {content.cta.text}
              </button>
            )}
          </div>
        </section>
      )

    case 'stats':
      return (
        <section className={cn(bgClass, spacingClass)}>
          <div className="max-w-6xl mx-auto px-6">
            {content.headline && (
              <h2 className={cn('text-3xl font-bold mb-12', alignClass)}>{content.headline}</h2>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {(content.items || []).map((item, i) => (
                <div key={i}>
                  <p className="text-4xl font-bold mb-2" style={{ color: globalStyles.primaryColor }}>{item.title}</p>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )

    default:
      return (
        <section className={cn(bgClass, spacingClass)}>
          <div className={cn('max-w-6xl mx-auto px-6', alignClass)}>
            {content.headline && (
              <h2 className="text-3xl font-bold mb-4">{content.headline}</h2>
            )}
            {content.description && (
              <p className="text-muted-foreground">{content.description}</p>
            )}
          </div>
        </section>
      )
  }
}
