'use client'

/**
 * Snippets Panel Component
 * 
 * Library of reusable code snippets for animations, hover effects,
 * scroll animations, and custom effects.
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Zap,
  MousePointer2,
  ScrollText,
  Wand2,
  Search,
  Plus,
  Star,
  Copy,
  Trash2,
  Edit3,
  MoreHorizontal,
  Loader2,
  Check,
  Code,
  Download,
  Upload,
  FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface Snippet {
  id: string
  name: string
  description?: string
  category: SnippetCategory
  code: string
  css?: string
  preview?: string
  tags: string[]
  isBuiltIn: boolean
  isFavorite: boolean
  createdAt: string
  updatedAt: string
}

type SnippetCategory = 'animation' | 'hover' | 'scroll' | 'transition' | 'effect' | 'custom'

const CATEGORIES: { value: SnippetCategory; label: string; icon: typeof Sparkles }[] = [
  { value: 'animation', label: 'Animations', icon: Sparkles },
  { value: 'hover', label: 'Hover Effects', icon: MousePointer2 },
  { value: 'scroll', label: 'Scroll Effects', icon: ScrollText },
  { value: 'transition', label: 'Transitions', icon: Zap },
  { value: 'effect', label: 'Effects', icon: Wand2 },
  { value: 'custom', label: 'Custom', icon: Code },
]

// Built-in snippets
const BUILT_IN_SNIPPETS: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Fade In Up',
    description: 'Element fades in while sliding up',
    category: 'animation',
    code: `animation: fadeInUp 0.6s ease-out forwards;

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}`,
    tags: ['fade', 'slide', 'entrance'],
    isBuiltIn: true,
    isFavorite: false,
  },
  {
    name: 'Scale on Hover',
    description: 'Element scales up on hover',
    category: 'hover',
    code: `transition: transform 0.2s ease;

&:hover {
  transform: scale(1.05);
}`,
    tags: ['scale', 'zoom', 'interactive'],
    isBuiltIn: true,
    isFavorite: false,
  },
  {
    name: 'Parallax Scroll',
    description: 'Background moves slower than foreground',
    category: 'scroll',
    code: `background-attachment: fixed;
background-position: center;
background-repeat: no-repeat;
background-size: cover;`,
    tags: ['parallax', 'depth', 'scroll'],
    isBuiltIn: true,
    isFavorite: false,
  },
  {
    name: 'Smooth Slide',
    description: 'Smooth slide transition for elements',
    category: 'transition',
    code: `transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);`,
    tags: ['smooth', 'slide', 'ease'],
    isBuiltIn: true,
    isFavorite: false,
  },
  {
    name: 'Glow Effect',
    description: 'Adds a soft glow around element',
    category: 'effect',
    code: `box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
transition: box-shadow 0.3s ease;

&:hover {
  box-shadow: 0 0 30px rgba(99, 102, 241, 0.5);
}`,
    tags: ['glow', 'shadow', 'neon'],
    isBuiltIn: true,
    isFavorite: false,
  },
  {
    name: 'Pulse Animation',
    description: 'Gentle pulsing effect',
    category: 'animation',
    code: `animation: pulse 2s ease-in-out infinite;

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}`,
    tags: ['pulse', 'breathe', 'attention'],
    isBuiltIn: true,
    isFavorite: false,
  },
  {
    name: 'Underline Hover',
    description: 'Animated underline on hover',
    category: 'hover',
    code: `position: relative;

&::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background: currentColor;
  transition: width 0.3s ease;
}

&:hover::after {
  width: 100%;
}`,
    tags: ['underline', 'text', 'link'],
    isBuiltIn: true,
    isFavorite: false,
  },
  {
    name: 'Blur Background',
    description: 'Frosted glass blur effect',
    category: 'effect',
    code: `background: rgba(255, 255, 255, 0.1);
backdrop-filter: blur(10px);
-webkit-backdrop-filter: blur(10px);
border: 1px solid rgba(255, 255, 255, 0.2);`,
    tags: ['blur', 'glass', 'frost', 'backdrop'],
    isBuiltIn: true,
    isFavorite: false,
  },
]

interface SnippetsPanelProps {
  onInsert: (snippet: Snippet) => void
  className?: string
}

export function SnippetsPanel({
  onInsert,
  className,
}: SnippetsPanelProps) {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<SnippetCategory | 'all'>('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null)

  // Fetch user snippets
  const { data: userSnippets = [], isLoading } = useQuery({
    queryKey: ['snippets'],
    queryFn: async () => {
      const res = await fetch('/api/snippets')
      if (!res.ok) return []
      return res.json()
    },
  })

  // Combine built-in and user snippets
  const allSnippets: Snippet[] = [
    ...BUILT_IN_SNIPPETS.map((s, i) => ({
      ...s,
      id: `builtin-${i}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    ...userSnippets,
  ]

  // Filter snippets
  const filteredSnippets = allSnippets.filter((snippet) => {
    const matchesSearch =
      searchQuery === '' ||
      snippet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCategory =
      activeCategory === 'all' || snippet.category === activeCategory

    return matchesSearch && matchesCategory
  })

  // Toggle favorite
  const toggleFavorite = useMutation({
    mutationFn: async (snippetId: string) => {
      const res = await fetch(`/api/snippets/${snippetId}/favorite`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to toggle favorite')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snippets'] })
    },
  })

  // Delete snippet
  const deleteSnippet = useMutation({
    mutationFn: async (snippetId: string) => {
      const res = await fetch(`/api/snippets/${snippetId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete snippet')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snippets'] })
      toast.success('Snippet deleted')
    },
  })

  const handleCopy = useCallback((snippet: Snippet) => {
    navigator.clipboard.writeText(snippet.code)
    toast.success('Copied to clipboard')
  }, [])

  const handleInsert = useCallback((snippet: Snippet) => {
    onInsert(snippet)
    toast.success('Snippet inserted')
  }, [onInsert])

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Snippets</span>
          </div>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search snippets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-4 pt-2">
        <ScrollArea className="pb-2 w-full">
          <div className="flex gap-1">
            <Button
              variant={activeCategory === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveCategory('all')}
            >
              All
            </Button>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              return (
                <Button
                  key={cat.value}
                  variant={activeCategory === cat.value ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setActiveCategory(cat.value)}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {cat.label}
                </Button>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Snippets List */}
      <ScrollArea className="flex-1 px-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSnippets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Code className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No snippets found</p>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            <AnimatePresence mode="popLayout">
              {filteredSnippets.map((snippet) => (
                <SnippetCard
                  key={snippet.id}
                  snippet={snippet}
                  onCopy={() => handleCopy(snippet)}
                  onInsert={() => handleInsert(snippet)}
                  onEdit={() => setEditingSnippet(snippet)}
                  onDelete={() => deleteSnippet.mutate(snippet.id)}
                  onToggleFavorite={() => toggleFavorite.mutate(snippet.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>

      {/* Import/Export */}
      <div className="p-4 border-t flex gap-2">
        <Button variant="outline" size="sm" className="flex-1">
          <Upload className="h-4 w-4 mr-1" />
          Import
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Create/Edit Dialog */}
      <SnippetDialog
        open={createDialogOpen || !!editingSnippet}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false)
            setEditingSnippet(null)
          }
        }}
        snippet={editingSnippet}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ['snippets'] })
          setCreateDialogOpen(false)
          setEditingSnippet(null)
        }}
      />
    </div>
  )
}

interface SnippetCardProps {
  snippet: Snippet
  onCopy: () => void
  onInsert: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleFavorite: () => void
}

function SnippetCard({
  snippet,
  onCopy,
  onInsert,
  onEdit,
  onDelete,
  onToggleFavorite,
}: SnippetCardProps) {
  const category = CATEGORIES.find((c) => c.value === snippet.category)
  const Icon = category?.icon || Code

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
            <Icon className="h-3 w-3 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-medium">{snippet.name}</h4>
            {snippet.description && (
              <p className="text-[10px] text-muted-foreground line-clamp-1">
                {snippet.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onToggleFavorite}
          >
            <Star
              className={cn(
                'h-3 w-3',
                snippet.isFavorite && 'fill-yellow-500 text-yellow-500'
              )}
            />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onCopy}>
                <Copy className="h-3 w-3 mr-2" />
                Copy Code
              </DropdownMenuItem>
              {!snippet.isBuiltIn && (
                <>
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit3 className="h-3 w-3 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="h-3 w-3 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Code Preview */}
      <pre className="text-[10px] text-muted-foreground bg-muted p-2 rounded font-mono overflow-hidden max-h-16 mb-2">
        {snippet.code.slice(0, 150)}
        {snippet.code.length > 150 && '...'}
      </pre>

      {/* Tags */}
      <div className="flex items-center gap-1 flex-wrap mb-2">
        {snippet.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
            {tag}
          </Badge>
        ))}
        {snippet.tags.length > 3 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            +{snippet.tags.length - 3}
          </Badge>
        )}
        {snippet.isBuiltIn && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Built-in
          </Badge>
        )}
      </div>

      {/* Insert Button */}
      <Button size="sm" className="w-full h-7 text-xs" onClick={onInsert}>
        <Check className="h-3 w-3 mr-1" />
        Insert Snippet
      </Button>
    </motion.div>
  )
}

interface SnippetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  snippet: Snippet | null
  onSave: () => void
}

function SnippetDialog({
  open,
  onOpenChange,
  snippet,
  onSave,
}: SnippetDialogProps) {
  const [name, setName] = useState(snippet?.name || '')
  const [description, setDescription] = useState(snippet?.description || '')
  const [category, setCategory] = useState<SnippetCategory>(snippet?.category || 'custom')
  const [code, setCode] = useState(snippet?.code || '')
  const [tags, setTags] = useState(snippet?.tags.join(', ') || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !code.trim()) {
      toast.error('Name and code are required')
      return
    }

    setIsSaving(true)
    try {
      const url = snippet ? `/api/snippets/${snippet.id}` : '/api/snippets'
      const method = snippet ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          category,
          code: code.trim(),
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      })

      if (!res.ok) throw new Error('Failed to save snippet')

      toast.success(snippet ? 'Snippet updated' : 'Snippet created')
      onSave()
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to save snippet')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{snippet ? 'Edit Snippet' : 'Create Snippet'}</DialogTitle>
          <DialogDescription>
            {snippet ? 'Update your custom snippet' : 'Create a reusable code snippet'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Snippet"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as SnippetCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this snippet do?"
            />
          </div>

          <div className="space-y-2">
            <Label>Code</Label>
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="/* Your CSS or code here */"
              className="font-mono text-sm h-40"
            />
          </div>

          <div className="space-y-2">
            <Label>Tags (comma-separated)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="animation, hover, effect"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {snippet ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
