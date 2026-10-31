'use client'

import { Suspense } from 'react'



import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Plus,
  Search,
  FileText,
  Link,
  Sparkles,
  Database,
  Upload,
  MoreHorizontal,
  Trash2,
  Edit3,
  ExternalLink,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface KnowledgeItem {
  id: string
  title: string
  description?: string
  content: string
  content_type: 'document' | 'url' | 'manual' | 'data'
  source_url?: string
  file_name?: string
  tags: string[]
  status: 'processing' | 'active' | 'error' | 'archived'
  reference_count: number
  created_at: string
  updated_at: string
}

const CONTENT_TYPES = [
  { id: 'manual', label: 'Manual Entry', icon: Sparkles, description: 'Add text content directly' },
  { id: 'url', label: 'URL', icon: Link, description: 'Import from a web page' },
  { id: 'document', label: 'Document', icon: FileText, description: 'Upload a file' },
  { id: 'data', label: 'Data', icon: Database, description: 'Import structured data' },
] as const

export function KnowledgeBasePage() {
  const router = useRouter()
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    content: '',
    content_type: 'manual' as KnowledgeItem['content_type'],
    source_url: '',
    tags: '',
  })

  useEffect(() => {
    fetchKnowledge()
  }, [])

  const fetchKnowledge = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()

      const typedMembership = membership as { workspace_id: string } | null
      if (!typedMembership) {
        toast.error('No workspace found')
        return
      }

      const workspaceId = typedMembership.workspace_id

      const { data, error } = await supabase
        .from('knowledge_items')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('parent_id', null)
        .order('updated_at', { ascending: false })

      if (error) throw error
      setItems(data || [])
    } catch (error) {
      console.error('Failed to fetch knowledge:', error)
      toast.error('Failed to load knowledge base')
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = async () => {
    if (!newItem.title.trim() || !newItem.content.trim()) {
      toast.error('Title and content are required')
      return
    }

    setAdding(true)
    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newItem.title,
          description: newItem.description,
          content: newItem.content,
          content_type: newItem.content_type,
          source_url: newItem.source_url,
          tags: newItem.tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      })

      if (!response.ok) throw new Error('Failed to create item')

      const item = await response.json()
      setItems([item, ...items])
      toast.success('Knowledge added!')
      setAddDialogOpen(false)
      setNewItem({
        title: '',
        description: '',
        content: '',
        content_type: 'manual',
        source_url: '',
        tags: '',
      })
    } catch (error) {
      console.error('Failed to add item:', error)
      toast.error('Failed to add knowledge')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    try {
      const response = await fetch(`/api/knowledge/${itemId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete item')

      setItems(items.filter((i) => i.id !== itemId))
      toast.success('Knowledge deleted')
    } catch (error) {
      console.error('Failed to delete item:', error)
      toast.error('Failed to delete knowledge')
    }
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = !filterType || item.content_type === filterType
    return matchesSearch && matchesType
  })

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document':
        return FileText
      case 'url':
        return Link
      case 'manual':
        return Sparkles
      case 'data':
        return Database
      default:
        return FileText
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="secondary" className="bg-green-500/10 text-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
        )
      case 'processing':
        return (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-500">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] min-h-screen bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/iq')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Knowledge Base</h1>
            <p className="text-sm text-muted-foreground">
              Upload and manage content for AI context
            </p>
          </div>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Knowledge
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Knowledge</DialogTitle>
              <DialogDescription>
                Add content to your knowledge base to enhance AI generation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Content Type Selection */}
              <div className="grid grid-cols-4 gap-2">
                {CONTENT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setNewItem({ ...newItem, content_type: type.id as KnowledgeItem['content_type'] })}
                    className={cn(
                      'p-3 rounded-lg border text-center transition-colors',
                      newItem.content_type === type.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    )}
                  >
                    <type.icon className="h-5 w-5 mx-auto mb-1" />
                    <p className="text-xs font-medium">{type.label}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={newItem.title}
                    onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                    placeholder="e.g., Product FAQ"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags (comma-separated)</Label>
                  <Input
                    value={newItem.tags}
                    onChange={(e) => setNewItem({ ...newItem, tags: e.target.value })}
                    placeholder="faq, product, support"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Brief description of this content"
                />
              </div>

              {newItem.content_type === 'url' && (
                <div className="space-y-2">
                  <Label>Source URL</Label>
                  <Input
                    value={newItem.source_url}
                    onChange={(e) => setNewItem({ ...newItem, source_url: e.target.value })}
                    placeholder="https://example.com/page"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={newItem.content}
                  onChange={(e) => setNewItem({ ...newItem, content: e.target.value })}
                  placeholder="Paste or type your content here..."
                  rows={8}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddItem} disabled={adding}>
                {adding ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Knowledge
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search knowledge..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              {filterType ? CONTENT_TYPES.find((t) => t.id === filterType)?.label : 'All Types'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilterType(null)}>All Types</DropdownMenuItem>
            <DropdownMenuSeparator />
            {CONTENT_TYPES.map((type) => (
              <DropdownMenuItem key={type.id} onClick={() => setFilterType(type.id)}>
                <type.icon className="h-4 w-4 mr-2" />
                {type.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Knowledge Items */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <motion.div
            className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <BookOpen className="h-8 w-8 text-emerald-500" />
          </motion.div>
          <h3 className="text-lg font-semibold mb-2">No knowledge items yet</h3>
          <p className="text-muted-foreground mb-4 max-w-sm">
            Add documents, URLs, or text content to enhance your AI generation.
          </p>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Item
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredItems.map((item, index) => {
              const TypeIcon = getTypeIcon(item.content_type)
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <TypeIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{item.title}</CardTitle>
                            {item.description && (
                              <CardDescription className="mt-1">
                                {item.description}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(item.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Edit3 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {item.source_url && (
                                <DropdownMenuItem asChild>
                                  <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    View Source
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteItem(item.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {item.content}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {item.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px]">
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                          {item.tags.length > 3 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{item.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            {item.reference_count} uses
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(item.updated_at)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}


export default function KnowledgeBasePageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <KnowledgeBasePage />
    </Suspense>
  )
}
