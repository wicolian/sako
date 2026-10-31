'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  Sparkles,
  Eye,
  Check,
  Loader2,
  Grid,
  List,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface TemplateSection {
  section_id: string
  template_name: string
  category: string
  visual_style: {
    theme: string
    layout: string
    density: string
  }
  suitable_for: string[]
  aesthetic_tags: string[]
  description: string
  html: string
}

interface TemplateRetrieverProps {
  onSelect: (template: TemplateSection) => void
  category?: string
  industry?: string
}

const CATEGORIES = [
  { id: 'hero', label: 'Hero Sections', icon: '🚀' },
  { id: 'features', label: 'Features', icon: '✨' },
  { id: 'testimonials', label: 'Testimonials', icon: '💬' },
  { id: 'pricing', label: 'Pricing', icon: '💰' },
  { id: 'cta', label: 'Call to Action', icon: '🎯' },
  { id: 'faq', label: 'FAQ', icon: '❓' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'logos', label: 'Logos', icon: '🏢' },
  { id: 'header', label: 'Headers', icon: '📌' },
  { id: 'footer', label: 'Footers', icon: '📝' },
]

const THEMES = ['dark', 'light', 'gradient', 'glass', 'minimal', 'bold']
const LAYOUTS = ['centered', 'split', 'grid', 'asymmetric', 'fullwidth']

export function TemplateRetriever({ onSelect, category, industry }: TemplateRetrieverProps) {
  const [templates, setTemplates] = useState<TemplateSection[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(category || 'all')
  const [selectedTheme, setSelectedTheme] = useState<string>('all')
  const [selectedLayout, setSelectedLayout] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [previewTemplate, setPreviewTemplate] = useState<TemplateSection | null>(null)

  const searchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('query', searchQuery)
      if (selectedCategory !== 'all') params.set('category', selectedCategory)
      if (selectedTheme !== 'all') params.set('theme', selectedTheme)
      if (selectedLayout !== 'all') params.set('layout', selectedLayout)
      if (industry) params.set('industry', industry)

      const response = await fetch(`/api/templates/search?${params}`)
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Failed to search templates:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedCategory, selectedTheme, selectedLayout, industry])

  useEffect(() => {
    const debounce = setTimeout(searchTemplates, 300)
    return () => clearTimeout(debounce)
  }, [searchTemplates])

  return (
    <div className="flex flex-col h-full">
      {/* Search and Filters */}
      <div className="p-4 border-b space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates... (e.g., 'dark hero with gradient')"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filter */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <span className="mr-2">{cat.icon}</span>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Theme Filter */}
          <Select value={selectedTheme} onValueChange={setSelectedTheme}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Themes</SelectItem>
              {THEMES.map((theme) => (
                <SelectItem key={theme} value={theme} className="capitalize">
                  {theme}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Layout Filter */}
          <Select value={selectedLayout} onValueChange={setSelectedLayout}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Layout" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Layouts</SelectItem>
              {LAYOUTS.map((layout) => (
                <SelectItem key={layout} value={layout} className="capitalize">
                  {layout}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1" />

          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg p-0.5">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
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

      {/* Results */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium mb-2">No templates found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div
            className={cn(
              'gap-4',
              viewMode === 'grid' ? 'grid grid-cols-2' : 'space-y-4'
            )}
          >
            <AnimatePresence mode="popLayout">
              {templates.map((template) => (
                <motion.div
                  key={template.section_id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <TemplateCard
                    template={template}
                    viewMode={viewMode}
                    onSelect={() => onSelect(template)}
                    onPreview={() => setPreviewTemplate(template)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Preview Sheet */}
      <Sheet open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <SheetContent side="right" className="w-[600px] sm:max-w-none">
          {previewTemplate && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {previewTemplate.category}
                  </Badge>
                  <span>{previewTemplate.visual_style.theme} / {previewTemplate.visual_style.layout}</span>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {previewTemplate.aesthetic_tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="capitalize">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {previewTemplate.description}
                </p>
                <div className="border rounded-lg overflow-hidden bg-slate-950">
                  <div
                    className="transform scale-50 origin-top-left w-[200%]"
                    dangerouslySetInnerHTML={{ __html: previewTemplate.html }}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    onSelect(previewTemplate)
                    setPreviewTemplate(null)
                  }}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Use This Template
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function TemplateCard({
  template,
  viewMode,
  onSelect,
  onPreview,
}: {
  template: TemplateSection
  viewMode: 'grid' | 'list'
  onSelect: () => void
  onPreview: () => void
}) {
  return (
    <div
      className={cn(
        'group border rounded-lg overflow-hidden hover:border-primary transition-colors cursor-pointer',
        viewMode === 'list' && 'flex items-center'
      )}
      onClick={onSelect}
    >
      {/* Preview Thumbnail */}
      <div
        className={cn(
          'relative overflow-hidden bg-slate-950',
          viewMode === 'grid' ? 'h-32' : 'w-40 h-24 shrink-0'
        )}
      >
        <div
          className="transform scale-[0.2] origin-top-left w-[500%] h-[500%]"
          dangerouslySetInnerHTML={{ __html: template.html }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onPreview()
            }}
          >
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className={cn('p-3', viewMode === 'list' && 'flex-1')}>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary" className="capitalize text-xs">
            {template.category}
          </Badge>
          <Badge variant="outline" className="capitalize text-xs">
            {template.visual_style.theme}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {template.description}
        </p>
        {viewMode === 'list' && (
          <div className="flex gap-1 mt-2">
            {template.aesthetic_tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs capitalize">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
