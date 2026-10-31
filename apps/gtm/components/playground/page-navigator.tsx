'use client'

import { useState } from 'react'
import { 
  Plus, 
  Home, 
  FileText, 
  MoreHorizontal, 
  Copy, 
  Trash2, 
  Settings,
  GripVertical,
  ChevronRight
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { ProjectPage, PageTransition } from '@/lib/projects/project-manager'

interface PageNavigatorProps {
  pages: ProjectPage[]
  currentPageId: string
  onPageSelect: (pageId: string) => void
  onPageCreate: (name: string, slug?: string) => Promise<void>
  onPageDelete: (pageId: string) => Promise<void>
  onPageDuplicate: (pageId: string) => Promise<void>
  onPageReorder: (pageOrder: string[]) => Promise<void>
  onPageSettings: (pageId: string) => void
  onSetHomePage: (pageId: string) => Promise<void>
}

interface SortablePageItemProps {
  page: ProjectPage
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
  onSettings: () => void
  onSetHome: () => void
}

function SortablePageItem({
  page,
  isActive,
  onSelect,
  onDelete,
  onDuplicate,
  onSettings,
  onSetHome,
}: SortablePageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
        isActive 
          ? 'bg-accent text-accent-foreground' 
          : 'hover:bg-muted',
        isDragging && 'opacity-50'
      )}
    >
      <button
        className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </button>

      <button
        className="flex-1 flex items-center gap-2 text-left min-w-0"
        onClick={onSelect}
      >
        {page.is_home ? (
          <Home className="w-4 h-4 shrink-0" />
        ) : (
          <FileText className="w-4 h-4 shrink-0" />
        )}
        <span className="truncate text-sm">{page.name}</span>
        {page.status === 'draft' && (
          <span className="text-xs text-muted-foreground">(draft)</span>
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onSettings}>
            <Settings className="w-4 h-4 mr-2" />
            Page Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="w-4 h-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
          {!page.is_home && (
            <DropdownMenuItem onClick={onSetHome}>
              <Home className="w-4 h-4 mr-2" />
              Set as Home
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {!page.is_home && (
            <DropdownMenuItem 
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function PageNavigator({
  pages,
  currentPageId,
  onPageSelect,
  onPageCreate,
  onPageDelete,
  onPageDuplicate,
  onPageReorder,
  onPageSettings,
  onSetHomePage,
}: PageNavigatorProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newPageName, setNewPageName] = useState('')
  const [newPageSlug, setNewPageSlug] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      const oldIndex = pages.findIndex((p) => p.id === active.id)
      const newIndex = pages.findIndex((p) => p.id === over.id)
      const newOrder = arrayMove(pages, oldIndex, newIndex).map((p) => p.id)
      onPageReorder(newOrder)
    }
  }

  const handleCreatePage = async () => {
    if (!newPageName.trim()) return

    setIsCreating(true)
    try {
      await onPageCreate(newPageName.trim(), newPageSlug.trim() || undefined)
      setNewPageName('')
      setNewPageSlug('')
      setIsCreateDialogOpen(false)
    } finally {
      setIsCreating(false)
    }
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium">Pages</span>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Page</DialogTitle>
              <DialogDescription>
                Add a new page to your website project.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="page-name">Page Name</Label>
                <Input
                  id="page-name"
                  placeholder="About Us"
                  value={newPageName}
                  onChange={(e) => {
                    setNewPageName(e.target.value)
                    if (!newPageSlug) {
                      setNewPageSlug(generateSlug(e.target.value))
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="page-slug">URL Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/</span>
                  <Input
                    id="page-slug"
                    placeholder="about-us"
                    value={newPageSlug}
                    onChange={(e) => setNewPageSlug(generateSlug(e.target.value))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This will be the URL path for this page.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreatePage}
                disabled={!newPageName.trim() || isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Page'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={pages.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {pages.map((page) => (
                <SortablePageItem
                  key={page.id}
                  page={page}
                  isActive={page.id === currentPageId}
                  onSelect={() => onPageSelect(page.id)}
                  onDelete={() => onPageDelete(page.id)}
                  onDuplicate={() => onPageDuplicate(page.id)}
                  onSettings={() => onPageSettings(page.id)}
                  onSetHome={() => onSetHomePage(page.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {pages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No pages yet</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add First Page
            </Button>
          </div>
        )}
      </div>

      {pages.length > 0 && (
        <div className="border-t p-2">
          <div className="text-xs text-muted-foreground text-center">
            {pages.length} page{pages.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

export default PageNavigator
