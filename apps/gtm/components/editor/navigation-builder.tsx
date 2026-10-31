'use client'

import { useState } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { GripVertical, Plus, Trash2, ExternalLink, Link, ChevronDown, Home, FileText, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NavLink {
  id: string
  label: string
  href: string
  type: 'internal' | 'external' | 'anchor'
  children?: NavLink[]
}

export interface Page {
  id: string
  slug: string
  title: string
  isHome: boolean
}

interface NavigationBuilderProps {
  links: NavLink[]
  pages: Page[]
  onChange: (links: NavLink[]) => void
}

export function NavigationBuilder({ links, pages, onChange }: NavigationBuilderProps) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = links.findIndex(l => l.id === active.id)
      const newIndex = links.findIndex(l => l.id === over.id)
      onChange(arrayMove(links, oldIndex, newIndex))
    }
  }

  const addLink = () => {
    const newLink: NavLink = {
      id: `nav-${Date.now()}`,
      label: 'New Link',
      href: '/',
      type: 'internal',
    }
    onChange([...links, newLink])
    setEditingId(newLink.id)
  }

  const updateLink = (id: string, updates: Partial<NavLink>) => {
    onChange(links.map(l => l.id === id ? { ...l, ...updates } : l))
  }

  const deleteLink = (id: string) => {
    onChange(links.filter(l => l.id !== id))
    if (editingId === id) setEditingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Navigation Links</Label>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addLink}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Link
        </Button>
      </div>

      {links.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg border-dashed">
          No navigation links yet.
          <br />
          Click "Add Link" to get started.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={links.map(l => l.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {links.map(link => (
                <SortableNavLink
                  key={link.id}
                  link={link}
                  pages={pages}
                  isEditing={editingId === link.id}
                  onEdit={() => setEditingId(editingId === link.id ? null : link.id)}
                  onUpdate={(updates) => updateLink(link.id, updates)}
                  onDelete={() => deleteLink(link.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Preview */}
      {links.length > 0 && (
        <div className="pt-3 border-t">
          <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
          <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
            {links.map(link => (
              <span
                key={link.id}
                className="text-sm px-3 py-1.5 bg-background rounded-md shadow-sm"
              >
                {link.label}
                {link.type === 'external' && (
                  <ExternalLink className="h-3 w-3 ml-1 inline-block opacity-50" />
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface SortableNavLinkProps {
  link: NavLink
  pages: Page[]
  isEditing: boolean
  onEdit: () => void
  onUpdate: (updates: Partial<NavLink>) => void
  onDelete: () => void
}

function SortableNavLink({
  link,
  pages,
  isEditing,
  onEdit,
  onUpdate,
  onDelete,
}: SortableNavLinkProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const getLinkIcon = () => {
    switch (link.type) {
      case 'external':
        return <ExternalLink className="h-3.5 w-3.5" />
      case 'anchor':
        return <Hash className="h-3.5 w-3.5" />
      default:
        return link.href === '/' ? <Home className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border rounded-lg bg-background transition-shadow',
        isDragging && 'shadow-lg opacity-50'
      )}
    >
      {/* Collapsed View */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={onEdit}
      >
        <button
          className="cursor-grab opacity-50 hover:opacity-100"
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        
        <span className="text-muted-foreground">
          {getLinkIcon()}
        </span>
        
        <span className="flex-1 text-sm font-medium truncate">
          {link.label}
        </span>
        
        <span className="text-xs text-muted-foreground truncate max-w-24">
          {link.href}
        </span>
        
        <ChevronDown className={cn(
          'h-4 w-4 text-muted-foreground transition-transform',
          isEditing && 'rotate-180'
        )} />
      </div>

      {/* Expanded Edit View */}
      {isEditing && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input
                value={link.label}
                onChange={e => onUpdate({ label: e.target.value })}
                placeholder="Link text"
                className="h-8 text-sm"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={link.type}
                onValueChange={v => onUpdate({ type: v as NavLink['type'] })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">
                    <span className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      Internal Page
                    </span>
                  </SelectItem>
                  <SelectItem value="external">
                    <span className="flex items-center gap-2">
                      <ExternalLink className="h-3.5 w-3.5" />
                      External Link
                    </span>
                  </SelectItem>
                  <SelectItem value="anchor">
                    <span className="flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5" />
                      Anchor Link
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {link.type === 'internal' ? 'Page' : link.type === 'anchor' ? 'Section ID' : 'URL'}
            </Label>
            
            {link.type === 'internal' ? (
              <Select
                value={link.href}
                onValueChange={v => onUpdate({ href: v })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select page" />
                </SelectTrigger>
                <SelectContent>
                  {pages.map(page => (
                    <SelectItem key={page.id} value={`/${page.slug === '' ? '' : page.slug}`}>
                      <span className="flex items-center gap-2">
                        {page.isHome ? <Home className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                        {page.title}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={link.href}
                onChange={e => onUpdate({ href: e.target.value })}
                placeholder={link.type === 'anchor' ? '#section-id' : 'https://...'}
                className="h-8 text-sm"
              />
            )}
          </div>

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={e => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Generate navigation HTML
 */
export function generateNavigationHtml(links: NavLink[], style: 'horizontal' | 'vertical' = 'horizontal'): string {
  const linkElements = links.map(link => {
    const isExternal = link.type === 'external'
    return `<a href="${link.href}"${isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''} class="nav-link">${link.label}${isExternal ? ' <svg class="external-icon" viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>' : ''}</a>`
  }).join('\n      ')

  return `<nav class="navigation ${style}">
    <div class="nav-container">
      ${linkElements}
    </div>
  </nav>`
}

/**
 * Generate navigation CSS
 */
export function generateNavigationCss(): string {
  return `
  .navigation {
    padding: 1rem 1.5rem;
    background: white;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .navigation.horizontal .nav-container {
    display: flex;
    align-items: center;
    gap: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .navigation.vertical .nav-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .nav-link {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    text-decoration: none;
    transition: color 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .nav-link:hover {
    color: var(--color-primary, #6366f1);
  }
  
  .external-icon {
    opacity: 0.5;
  }
  `
}
