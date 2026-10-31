'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Loader2, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface UIComponent {
  id: string
  name: string
  category: string
  html: string
  is_pro: boolean
}

interface ComponentBrowserProps {
  onSelect: (component: UIComponent) => void
  selectedCategory?: string
}

const CATEGORY_ICONS: Record<string, string> = {
  hero: '🚀',
  section: '📄',
  header: '🔝',
  footer: '🔚',
  feature: '✨',
  testimonial: '💬',
  pricing: '💰',
  cta: '🎯',
  faq: '❓',
  form: '📝',
  card: '🃏',
  button: '🔘',
  heading: '📰',
  logo: '🏢',
  stats: '📊',
  gallery: '🖼️',
  background: '🎨',
}

export function ComponentBrowser({ onSelect, selectedCategory }: ComponentBrowserProps) {
  const [components, setComponents] = useState<UIComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(selectedCategory || null)

  useEffect(() => {
    loadComponents()
  }, [])

  const loadComponents = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('ui_components')
      .select('id, name, category, html, is_pro')
      .order('usage_count', { ascending: false })

    if (data) {
      setComponents(data)
    }
    setLoading(false)
  }

  // Get unique categories
  const categories = [...new Set(components.map(c => c.category))].sort()

  // Filter components
  const filtered = components.filter(c => {
    if (activeCategory && c.category !== activeCategory) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group by category
  const grouped = filtered.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = []
    acc[c.category].push(c)
    return acc
  }, {} as Record<string, UIComponent[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="p-2 border-b overflow-x-auto">
        <div className="flex gap-1">
          <Button
            variant={activeCategory === null ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={() => setActiveCategory(null)}
          >
            All
          </Button>
          {categories.map(cat => (
            <Button
              key={cat}
              variant={activeCategory === cat ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs shrink-0 gap-1"
              onClick={() => setActiveCategory(cat)}
            >
              <span>{CATEGORY_ICONS[cat] || '📦'}</span>
              <span className="capitalize">{cat}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Components List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {Object.entries(grouped).map(([category, comps]) => (
            <div key={category}>
              <div className="flex items-center gap-2 px-2 mb-2">
                <span>{CATEGORY_ICONS[category] || '📦'}</span>
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  {category}
                </span>
              </div>
              <div className="space-y-1">
                {comps.map(component => (
                  <button
                    key={component.id}
                    onClick={() => onSelect(component)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-left transition-colors group"
                  >
                    {/* Mini preview */}
                    <div className="w-16 h-10 bg-muted rounded overflow-hidden shrink-0 relative">
                      <div
                        className="absolute inset-0 scale-[0.1] origin-top-left"
                        style={{ width: '1000%', height: '1000%' }}
                        dangerouslySetInnerHTML={{ __html: component.html }}
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{component.name}</p>
                      {component.is_pro && (
                        <span className="text-[10px] text-amber-500 font-medium">PRO</span>
                      )}
                    </div>

                    <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No components found
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
