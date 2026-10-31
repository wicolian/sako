'use client'

import { useState, useEffect } from 'react'
import {
  Code2,
  Plus,
  Search,
  Star,
  Copy,
  Trash2,
  Edit2,
  MoreHorizontal,
  Loader2,
  Sparkles,
  Layout,
  Palette,
  MousePointer,
  FileCode2,
  Filter,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { Snippet, SnippetCategory } from '@/lib/snippets/snippet-manager'

const CATEGORIES = [
  { id: 'all', label: 'All', icon: FileCode2 },
  { id: 'animation', label: 'Animations', icon: Sparkles },
  { id: 'effect', label: 'Effects', icon: Palette },
  { id: 'layout', label: 'Layouts', icon: Layout },
  { id: 'interactive', label: 'Interactive', icon: MousePointer },
  { id: 'custom', label: 'Custom', icon: Code2 },
] as const

export default function SnippetsPage() {
  const { toast } = useToast()
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [showFavorites, setShowFavorites] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null)
  const [previewSnippet, setPreviewSnippet] = useState<Snippet | null>(null)

  const fetchSnippets = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        includePublic: 'true',
        ...(activeCategory !== 'all' && { category: activeCategory }),
        ...(searchQuery && { search: searchQuery }),
        ...(showFavorites && { favorites: 'true' }),
      })

      const response = await fetch(`/api/snippets?${params}`)
      if (response.ok) {
        const data = await response.json()
        setSnippets(data.snippets)
      }
    } catch (error) {
      console.error('Failed to fetch snippets:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSnippets()
  }, [activeCategory, showFavorites])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchSnippets()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  const handleCopy = async (snippet: Snippet) => {
    await navigator.clipboard.writeText(snippet.code)
    
    // Record usage
    await fetch('/api/snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'use', snippetId: snippet.id }),
    })

    toast({ title: 'Copied to clipboard' })
  }

  const handleFavorite = async (snippet: Snippet) => {
    const response = await fetch('/api/snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'favorite', snippetId: snippet.id }),
    })

    if (response.ok) {
      const { isFavorited } = await response.json()
      setSnippets((prev) =>
        prev.map((s) =>
          s.id === snippet.id ? { ...s, is_favorited: isFavorited } : s
        )
      )
      toast({ title: isFavorited ? 'Added to favorites' : 'Removed from favorites' })
    }
  }

  const handleDelete = async (snippet: Snippet) => {
    const response = await fetch(`/api/snippets?id=${snippet.id}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      setSnippets((prev) => prev.filter((s) => s.id !== snippet.id))
      toast({ title: 'Snippet deleted' })
    }
  }

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Code2 className="h-8 w-8 text-primary" />
            Snippets
          </h1>
          <p className="text-muted-foreground mt-1">
            Reusable code snippets for animations, effects, and patterns
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Snippet
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search snippets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={showFavorites ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowFavorites(!showFavorites)}
        >
          <Star className={cn('h-4 w-4 mr-1', showFavorites && 'fill-current')} />
          Favorites
        </Button>
      </div>

      {/* Categories */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="mb-6">
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id} className="gap-2">
              <cat.icon className="h-4 w-4" />
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Snippets Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : snippets.length === 0 ? (
          <div className="text-center py-16">
            <Code2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-2">No snippets found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? 'Try a different search term'
                : 'Create your first snippet to get started'}
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Snippet
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {snippets.map((snippet) => (
              <SnippetCard
                key={snippet.id}
                snippet={snippet}
                onCopy={() => handleCopy(snippet)}
                onFavorite={() => handleFavorite(snippet)}
                onEdit={() => setEditingSnippet(snippet)}
                onDelete={() => handleDelete(snippet)}
                onPreview={() => setPreviewSnippet(snippet)}
              />
            ))}
          </div>
        )}
      </Tabs>

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
          fetchSnippets()
          setCreateDialogOpen(false)
          setEditingSnippet(null)
        }}
      />

      {/* Preview Dialog */}
      {previewSnippet && (
        <PreviewDialog
          snippet={previewSnippet}
          onClose={() => setPreviewSnippet(null)}
          onCopy={() => {
            handleCopy(previewSnippet)
            setPreviewSnippet(null)
          }}
        />
      )}
    </div>
  )
}

interface SnippetCardProps {
  snippet: Snippet
  onCopy: () => void
  onFavorite: () => void
  onEdit: () => void
  onDelete: () => void
  onPreview: () => void
}

function SnippetCard({
  snippet,
  onCopy,
  onFavorite,
  onEdit,
  onDelete,
  onPreview,
}: SnippetCardProps) {
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{snippet.name}</CardTitle>
            {snippet.description && (
              <CardDescription className="line-clamp-2 mt-1">
                {snippet.description}
              </CardDescription>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onCopy}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {/* Code Preview */}
        <div
          className="bg-muted rounded-lg p-3 mb-3 cursor-pointer hover:bg-muted/80 transition-colors"
          onClick={onPreview}
        >
          <pre className="text-xs overflow-hidden text-muted-foreground line-clamp-4">
            <code>{snippet.code}</code>
          </pre>
        </div>

        {/* Tags & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs capitalize">
              {snippet.category}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {snippet.language}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onFavorite}
            >
              <Star
                className={cn(
                  'h-4 w-4',
                  snippet.is_favorited && 'fill-amber-400 text-amber-400'
                )}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onCopy}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface SnippetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  snippet: Snippet | null
  onSave: () => void
}

function SnippetDialog({ open, onOpenChange, snippet, onSave }: SnippetDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'custom' as SnippetCategory,
    code: '',
    tags: '',
  })

  useEffect(() => {
    if (snippet) {
      setForm({
        name: snippet.name,
        description: snippet.description || '',
        category: snippet.category,
        code: snippet.code,
        tags: snippet.tags.join(', '),
      })
    } else {
      setForm({ name: '', description: '', category: 'custom', code: '', tags: '' })
    }
  }, [snippet])

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Name and code are required',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const body = snippet
        ? {
            snippetId: snippet.id,
            name: form.name,
            description: form.description,
            category: form.category,
            code: form.code,
            tags,
          }
        : {
            action: 'create',
            name: form.name,
            description: form.description,
            category: form.category,
            code: form.code,
            tags,
          }

      const response = await fetch('/api/snippets', {
        method: snippet ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        toast({ title: snippet ? 'Snippet updated' : 'Snippet created' })
        onSave()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{snippet ? 'Edit Snippet' : 'Create Snippet'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Fade In Animation"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as SnippetCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="animation">Animation</SelectItem>
                  <SelectItem value="effect">Effect</SelectItem>
                  <SelectItem value="layout">Layout</SelectItem>
                  <SelectItem value="style">Style</SelectItem>
                  <SelectItem value="interactive">Interactive</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of what this snippet does"
            />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Textarea
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Paste your HTML, CSS, or JavaScript code here"
              className="font-mono text-sm min-h-[200px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Tags (comma separated)</Label>
            <Input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="e.g., animation, fade, hover"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {snippet ? 'Save Changes' : 'Create Snippet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface PreviewDialogProps {
  snippet: Snippet
  onClose: () => void
  onCopy: () => void
}

function PreviewDialog({ snippet, onClose, onCopy }: PreviewDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{snippet.name}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto">
            <code>{snippet.code}</code>
          </pre>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Code
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
