'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import {
  Search,
  Filter,
  Plus,
  Bookmark,
  Grid3X3,
  List,
  Loader2,
  Star,
  Lock,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ComponentCard } from '@/components/library/component-card'
import { ComponentBrowser } from '@/components/library/component-browser'

interface UIComponent {
  id: string
  name: string
  description: string | null
  category: string
  tags: string[]
  thumbnail_url: string | null
  html: string
  is_pro: boolean
  is_public: boolean
  is_system: boolean
  usage_count: number
  created_at: string
}

interface Category {
  id: string
  name: string
  icon: string
  sort_order: number
}

export default function ComponentsPage() {
  const [components, setComponents] = useState<UIComponent[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState<'all' | 'free' | 'pro' | 'saved'>('all')
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadComponents()
    loadCategories()
    loadSavedComponents()
  }, [])

  const loadComponents = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('ui_components')
      .select('*')
      .order('usage_count', { ascending: false }) as { data: UIComponent[] | null; error: Error | null }

    if (!error && data) {
      setComponents(data)
    }
    setLoading(false)
  }

  const loadCategories = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('component_categories')
      .select('*')
      .order('sort_order') as { data: Category[] | null }

    if (data) {
      setCategories(data)
    }
  }

  const loadSavedComponents = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data } = await supabase
        .from('user_saved_components')
        .select('component_id')
        .eq('user_id', user.id) as { data: { component_id: string }[] | null }

      if (data) {
        setSavedIds(new Set(data.map(d => d.component_id)))
      }
    }
  }

  const toggleSaved = async (componentId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    if (savedIds.has(componentId)) {
      await supabase
        .from('user_saved_components')
        .delete()
        .eq('user_id', user.id)
        .eq('component_id', componentId)
      
      setSavedIds(prev => {
        const next = new Set(prev)
        next.delete(componentId)
        return next
      })
    } else {
      await (supabase as unknown as { from: (t: string) => { insert: (v: Record<string, unknown>) => Promise<void> } })
        .from('user_saved_components')
        .insert({ user_id: user.id, component_id: componentId })
      
      setSavedIds(prev => new Set([...prev, componentId]))
    }
  }

  // Filter components
  const filteredComponents = components.filter(c => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !c.name.toLowerCase().includes(query) &&
        !c.description?.toLowerCase().includes(query) &&
        !c.tags.some(t => t.toLowerCase().includes(query))
      ) {
        return false
      }
    }

    // Category filter
    if (selectedCategory !== 'all' && c.category !== selectedCategory) {
      return false
    }

    // Access filter
    if (filter === 'free' && c.is_pro) return false
    if (filter === 'pro' && !c.is_pro) return false
    if (filter === 'saved' && !savedIds.has(c.id)) return false

    return true
  })

  // Group by category for display
  const groupedComponents = filteredComponents.reduce((acc, component) => {
    const cat = component.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(component)
    return acc
  }, {} as Record<string, UIComponent[]>)

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Components Library</h1>
              <p className="text-muted-foreground mt-1">
                Browse and use ready-made UI components for your designs
              </p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Component
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search components..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="free">Free</TabsTrigger>
                  <TabsTrigger value="pro">Pro</TabsTrigger>
                  <TabsTrigger value="saved">
                    <Bookmark className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center bg-muted rounded-lg p-0.5">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredComponents.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg text-muted-foreground">No components found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your search or filters
            </p>
          </div>
        ) : selectedCategory === 'all' ? (
          // Grouped view
          <div className="space-y-12">
            {Object.entries(groupedComponents).map(([category, comps]) => {
              const cat = categories.find(c => c.id === category)
              return (
                <section key={category}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">{cat?.icon}</span>
                    <h2 className="text-xl font-semibold capitalize">{cat?.name || category}</h2>
                    <Badge variant="secondary" className="ml-2">{comps.length}</Badge>
                  </div>
                  <div className={cn(
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                      : 'space-y-4'
                  )}>
                    {comps.map(component => (
                      <ComponentCard
                        key={component.id}
                        component={component}
                        viewMode={viewMode}
                        isSaved={savedIds.has(component.id)}
                        onToggleSave={() => toggleSaved(component.id)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          // Flat view
          <div className={cn(
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
          )}>
            {filteredComponents.map(component => (
              <ComponentCard
                key={component.id}
                component={component}
                viewMode={viewMode}
                isSaved={savedIds.has(component.id)}
                onToggleSave={() => toggleSaved(component.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
