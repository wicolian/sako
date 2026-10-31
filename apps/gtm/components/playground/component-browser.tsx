'use client'

import { useState, useEffect } from 'react'
import { Search, Star, Layout, Type, Image, CreditCard, MessageSquare, Rocket, Menu, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface ComponentTemplate {
  id: string
  name: string
  category: ComponentCategory
  description: string
  thumbnail?: string
  html: string
  isPro?: boolean
  tags: string[]
}

export type ComponentCategory =
  | 'hero'
  | 'features'
  | 'testimonials'
  | 'pricing'
  | 'cta'
  | 'footer'
  | 'header'
  | 'forms'
  | 'content'
  | 'gallery'
  | 'stats'
  | 'team'
  | 'faq'

interface CategoryConfig {
  id: ComponentCategory
  name: string
  icon: React.ReactNode
  description: string
}

interface ComponentBrowserProps {
  onSelectComponent: (component: ComponentTemplate) => void
  isPro?: boolean
}

// ============================================================================
// Category Configuration
// ============================================================================

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'hero',
    name: 'Hero',
    icon: <Rocket className="w-4 h-4" />,
    description: 'Above-the-fold sections',
  },
  {
    id: 'features',
    name: 'Features',
    icon: <Layout className="w-4 h-4" />,
    description: 'Feature grids and lists',
  },
  {
    id: 'testimonials',
    name: 'Testimonials',
    icon: <MessageSquare className="w-4 h-4" />,
    description: 'Customer quotes and reviews',
  },
  {
    id: 'pricing',
    name: 'Pricing',
    icon: <CreditCard className="w-4 h-4" />,
    description: 'Pricing tables and cards',
  },
  {
    id: 'cta',
    name: 'CTA',
    icon: <Rocket className="w-4 h-4" />,
    description: 'Call to action sections',
  },
  {
    id: 'header',
    name: 'Headers',
    icon: <Menu className="w-4 h-4" />,
    description: 'Navigation headers',
  },
  {
    id: 'footer',
    name: 'Footers',
    icon: <Layout className="w-4 h-4" />,
    description: 'Page footers',
  },
  {
    id: 'forms',
    name: 'Forms',
    icon: <Type className="w-4 h-4" />,
    description: 'Contact and newsletter forms',
  },
  {
    id: 'content',
    name: 'Content',
    icon: <Type className="w-4 h-4" />,
    description: 'Text and image sections',
  },
  {
    id: 'gallery',
    name: 'Gallery',
    icon: <Image className="w-4 h-4" />,
    description: 'Image galleries and grids',
  },
  {
    id: 'stats',
    name: 'Stats',
    icon: <Layout className="w-4 h-4" />,
    description: 'Statistics and numbers',
  },
  {
    id: 'team',
    name: 'Team',
    icon: <Layout className="w-4 h-4" />,
    description: 'Team member sections',
  },
  {
    id: 'faq',
    name: 'FAQ',
    icon: <MessageSquare className="w-4 h-4" />,
    description: 'FAQ and accordion sections',
  },
]

// ============================================================================
// Sample Components (would normally come from API/database)
// ============================================================================

const SAMPLE_COMPONENTS: ComponentTemplate[] = [
  // Hero components
  {
    id: 'hero-centered',
    name: 'Centered Hero',
    category: 'hero',
    description: 'Clean centered hero with headline, subtext, and CTA',
    tags: ['minimal', 'centered', 'clean'],
    html: '<section class="py-20 text-center"><h1>Headline</h1></section>',
  },
  {
    id: 'hero-split',
    name: 'Split Hero',
    category: 'hero',
    description: 'Two-column hero with text and image',
    tags: ['split', 'image', 'two-column'],
    html: '<section class="py-20 grid grid-cols-2"><div>Text</div><div>Image</div></section>',
  },
  {
    id: 'hero-video',
    name: 'Video Background Hero',
    category: 'hero',
    description: 'Hero with video background',
    tags: ['video', 'background', 'dynamic'],
    isPro: true,
    html: '<section class="py-20 relative"><video></video></section>',
  },
  {
    id: 'hero-gradient',
    name: 'Gradient Hero',
    category: 'hero',
    description: 'Hero with gradient background',
    tags: ['gradient', 'colorful', 'modern'],
    html: '<section class="py-20 bg-gradient-to-r">Content</section>',
  },
  // Features components
  {
    id: 'features-grid',
    name: 'Feature Grid',
    category: 'features',
    description: '3-column feature grid with icons',
    tags: ['grid', 'icons', 'three-column'],
    html: '<section class="py-16"><div class="grid grid-cols-3"></div></section>',
  },
  {
    id: 'features-list',
    name: 'Feature List',
    category: 'features',
    description: 'Alternating feature list with images',
    tags: ['list', 'alternating', 'images'],
    html: '<section class="py-16"><div class="space-y-12"></div></section>',
  },
  {
    id: 'features-cards',
    name: 'Feature Cards',
    category: 'features',
    description: 'Card-based feature display',
    tags: ['cards', 'shadows', 'hover'],
    html: '<section class="py-16"><div class="grid gap-6"></div></section>',
  },
  // Testimonials
  {
    id: 'testimonial-carousel',
    name: 'Testimonial Carousel',
    category: 'testimonials',
    description: 'Sliding testimonial carousel',
    tags: ['carousel', 'slider', 'dynamic'],
    isPro: true,
    html: '<section class="py-16"><div class="carousel"></div></section>',
  },
  {
    id: 'testimonial-grid',
    name: 'Testimonial Grid',
    category: 'testimonials',
    description: 'Grid of testimonial cards',
    tags: ['grid', 'cards', 'static'],
    html: '<section class="py-16"><div class="grid grid-cols-3"></div></section>',
  },
  {
    id: 'testimonial-single',
    name: 'Single Testimonial',
    category: 'testimonials',
    description: 'Large single testimonial highlight',
    tags: ['single', 'large', 'quote'],
    html: '<section class="py-16"><blockquote></blockquote></section>',
  },
  // Pricing
  {
    id: 'pricing-three',
    name: 'Three-Tier Pricing',
    category: 'pricing',
    description: 'Classic three-column pricing table',
    tags: ['three-column', 'popular', 'comparison'],
    html: '<section class="py-16"><div class="grid grid-cols-3"></div></section>',
  },
  {
    id: 'pricing-toggle',
    name: 'Toggle Pricing',
    category: 'pricing',
    description: 'Monthly/yearly toggle pricing',
    tags: ['toggle', 'monthly', 'yearly'],
    isPro: true,
    html: '<section class="py-16"><div class="pricing-toggle"></div></section>',
  },
  // CTA
  {
    id: 'cta-banner',
    name: 'CTA Banner',
    category: 'cta',
    description: 'Full-width CTA banner',
    tags: ['banner', 'full-width', 'bold'],
    html: '<section class="py-16 bg-primary"><div class="text-center"></div></section>',
  },
  {
    id: 'cta-split',
    name: 'Split CTA',
    category: 'cta',
    description: 'Two-column CTA with image',
    tags: ['split', 'image', 'two-column'],
    html: '<section class="py-16"><div class="grid grid-cols-2"></div></section>',
  },
  // Headers
  {
    id: 'header-simple',
    name: 'Simple Header',
    category: 'header',
    description: 'Clean navigation header',
    tags: ['simple', 'clean', 'minimal'],
    html: '<header class="py-4"><nav></nav></header>',
  },
  {
    id: 'header-mega',
    name: 'Mega Menu Header',
    category: 'header',
    description: 'Header with mega dropdown menu',
    tags: ['mega', 'dropdown', 'complex'],
    isPro: true,
    html: '<header class="py-4"><nav class="mega-menu"></nav></header>',
  },
  // Footers
  {
    id: 'footer-simple',
    name: 'Simple Footer',
    category: 'footer',
    description: 'Minimal footer with links',
    tags: ['simple', 'minimal', 'clean'],
    html: '<footer class="py-8"><div class="flex"></div></footer>',
  },
  {
    id: 'footer-mega',
    name: 'Mega Footer',
    category: 'footer',
    description: 'Multi-column footer with all links',
    tags: ['mega', 'columns', 'complete'],
    html: '<footer class="py-12"><div class="grid grid-cols-4"></div></footer>',
  },
  // Forms
  {
    id: 'form-contact',
    name: 'Contact Form',
    category: 'forms',
    description: 'Standard contact form',
    tags: ['contact', 'standard', 'email'],
    html: '<section class="py-16"><form></form></section>',
  },
  {
    id: 'form-newsletter',
    name: 'Newsletter Signup',
    category: 'forms',
    description: 'Email newsletter signup form',
    tags: ['newsletter', 'email', 'simple'],
    html: '<section class="py-8"><form class="flex"></form></section>',
  },
  // Stats
  {
    id: 'stats-simple',
    name: 'Stats Row',
    category: 'stats',
    description: 'Row of key statistics',
    tags: ['numbers', 'row', 'simple'],
    html: '<section class="py-12"><div class="flex justify-around"></div></section>',
  },
  {
    id: 'stats-animated',
    name: 'Animated Stats',
    category: 'stats',
    description: 'Stats with count-up animation',
    tags: ['animated', 'count-up', 'dynamic'],
    isPro: true,
    html: '<section class="py-12"><div class="animated-stats"></div></section>',
  },
]

// ============================================================================
// Component Browser
// ============================================================================

export function ComponentBrowser({ onSelectComponent, isPro = false }: ComponentBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ComponentCategory | 'all'>('all')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['hero']))

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const filteredComponents = SAMPLE_COMPONENTS.filter((component) => {
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesName = component.name.toLowerCase().includes(query)
      const matchesDescription = component.description.toLowerCase().includes(query)
      const matchesTags = component.tags.some((tag) => tag.toLowerCase().includes(query))
      if (!matchesName && !matchesDescription && !matchesTags) {
        return false
      }
    }

    // Filter by category
    if (selectedCategory !== 'all' && component.category !== selectedCategory) {
      return false
    }

    return true
  })

  // Group by category
  const componentsByCategory = CATEGORIES.reduce(
    (acc, category) => {
      acc[category.id] = filteredComponents.filter((c) => c.category === category.id)
      return acc
    },
    {} as Record<ComponentCategory, ComponentTemplate[]>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 p-2 border-b overflow-x-auto">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
        >
          All
        </Button>
        {CATEGORIES.slice(0, 6).map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.name}
          </Button>
        ))}
      </div>

      {/* Component List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {selectedCategory === 'all' ? (
            // Show grouped by category
            CATEGORIES.map((category) => {
              const components = componentsByCategory[category.id]
              if (components.length === 0) return null

              return (
                <Collapsible
                  key={category.id}
                  open={expandedCategories.has(category.id)}
                  onOpenChange={() => toggleCategory(category.id)}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted">
                    <div className="flex items-center gap-2">
                      {category.icon}
                      <span className="font-medium text-sm">{category.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {components.length}
                      </Badge>
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 transition-transform',
                        expandedCategories.has(category.id) && 'rotate-180'
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {components.map((component) => (
                        <ComponentCard
                          key={component.id}
                          component={component}
                          onClick={() => onSelectComponent(component)}
                          canUsePro={isPro}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })
          ) : (
            // Show flat list for selected category
            <div className="grid grid-cols-2 gap-2">
              {filteredComponents.map((component) => (
                <ComponentCard
                  key={component.id}
                  component={component}
                  onClick={() => onSelectComponent(component)}
                  canUsePro={isPro}
                />
              ))}
            </div>
          )}

          {filteredComponents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Layout className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No components found</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ============================================================================
// Component Card
// ============================================================================

interface ComponentCardProps {
  component: ComponentTemplate
  onClick: () => void
  canUsePro: boolean
}

function ComponentCard({ component, onClick, canUsePro }: ComponentCardProps) {
  const isLocked = component.isPro && !canUsePro

  return (
    <button
      className={cn(
        'relative p-3 rounded-lg border bg-card hover:bg-muted transition-colors text-left',
        isLocked && 'opacity-60'
      )}
      onClick={onClick}
      disabled={isLocked}
    >
      {/* Thumbnail placeholder */}
      <div className="aspect-video bg-muted rounded mb-2 flex items-center justify-center">
        <Layout className="w-6 h-6 text-muted-foreground" />
      </div>

      {/* Name and badges */}
      <div className="flex items-start justify-between gap-1">
        <span className="text-sm font-medium truncate">{component.name}</span>
        {component.isPro && (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            <Star className="w-3 h-3 mr-0.5" />
            PRO
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
        {component.description}
      </p>

      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <Badge variant="outline">Upgrade to Pro</Badge>
        </div>
      )}
    </button>
  )
}

export default ComponentBrowser
