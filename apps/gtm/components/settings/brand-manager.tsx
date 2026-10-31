'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/use-toast'
import { Input } from '@/components/ui/input'
import {
  Plus,
  Palette,
  Type,
  MessageSquare,
  Image,
  ChevronDown,
  Settings2,
  Trash2,
  Star,
  Loader2,
  Check,
  Upload,
  ExternalLink,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Brand {
  id: string
  name: string
  tagline?: string
  description?: string
  website_url?: string
  primary_color: string
  secondary_color?: string
  accent_color?: string
  font_family: string
  font_heading?: string
  voice?: string
  tone_attributes?: string[]
  key_messages?: string[]
  value_propositions?: string[]
  logo_primary_url?: string
  logo_icon_url?: string
  is_default: boolean
  created_at: string
}

// Popular Google Fonts for easy selection
const POPULAR_FONTS = [
  // Sans Serif
  { name: 'Inter', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
  { name: 'Outfit', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap' },
  { name: 'Space Grotesk', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap' },
  { name: 'DM Sans', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap' },
  { name: 'Sora', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap' },
  { name: 'Manrope', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap' },
  { name: 'Plus Jakarta Sans', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap' },
  { name: 'Poppins', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap' },
  { name: 'Nunito Sans', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600;700&display=swap' },
  { name: 'Open Sans', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap' },
  { name: 'Roboto', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap' },
  { name: 'Lato', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap' },
  { name: 'Montserrat', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap' },
  { name: 'Work Sans', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;600;700&display=swap' },
  { name: 'Fira Sans', category: 'Sans-serif', url: 'https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&display=swap' },

  // Serif
  { name: 'Playfair Display', category: 'Serif', url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap' },
  { name: 'Fraunces', category: 'Serif', url: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&display=swap' },
  { name: 'Crimson Text', category: 'Serif', url: 'https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600&display=swap' },
  { name: 'Merriweather', category: 'Serif', url: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap' },
  { name: 'Lora', category: 'Serif', url: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;700&display=swap' },
  { name: 'Crimson Pro', category: 'Serif', url: 'https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@200;300;400;500;600;700;800;900&display=swap' },

  // Monospace
  { name: 'JetBrains Mono', category: 'Monospace', url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap' },
  { name: 'Fira Code', category: 'Monospace', url: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&display=swap' },
  { name: 'Source Code Pro', category: 'Monospace', url: 'https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;600;700&display=swap' },
  { name: 'Roboto Mono', category: 'Monospace', url: 'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&display=swap' },

  // Display/Special
  { name: 'Abril Fatface', category: 'Display', url: 'https://fonts.googleapis.com/css2?family=Abril+Fatface&display=swap' },
  { name: 'Dancing Script', category: 'Handwriting', url: 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap' },
  { name: 'Pacifico', category: 'Display', url: 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap' },
]

const VOICE_OPTIONS = [
  'Professional & Authoritative',
  'Friendly & Approachable',
  'Bold & Confident',
  'Warm & Caring',
  'Technical & Precise',
  'Playful & Creative',
  'Sophisticated & Elegant',
  'Direct & No-nonsense',
]

interface FontPickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function FontPicker({ value, onChange, placeholder = "Select font" }: FontPickerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const categories = ['all', ...new Set(POPULAR_FONTS.map(f => f.category))]

  const filteredFonts = POPULAR_FONTS.filter(font => {
    const matchesSearch = font.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || font.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const selectedFont = POPULAR_FONTS.find(f => f.name === value)
  const isSameAsPrimary = value === 'same-as-primary' || (!value && placeholder.includes('primary'))

  return (
    <div className="space-y-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 border rounded-md bg-background hover:bg-accent focus:ring-2 focus:ring-ring"
        >
          <div className="flex items-center gap-2">
            <span
              className="text-sm"
              style={{ fontFamily: selectedFont ? selectedFont.name : 'inherit' }}
            >
              {isSameAsPrimary ? 'Same as primary' : (selectedFont ? selectedFont.name : placeholder)}
            </span>
            {selectedFont && !isSameAsPrimary && (
              <span className="text-xs text-muted-foreground">
                ({selectedFont.category})
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b">
              <Input
                placeholder="Search fonts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8"
              />
            </div>

            {/* Categories */}
            <div className="flex gap-1 p-2 border-b overflow-x-auto">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    'px-2 py-1 text-xs rounded whitespace-nowrap',
                    selectedCategory === category
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  {category === 'all' ? 'All' : category}
                </button>
              ))}
            </div>

            {/* Font List */}
            <div className="max-h-48 overflow-y-auto">
              {/* Same as primary option for heading fonts */}
              {placeholder.includes('primary') && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('same-as-primary')
                    setIsOpen(false)
                    setSearchTerm('')
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-accent focus:bg-accent flex items-center justify-between"
                >
                  <span className="text-sm font-medium">Same as primary</span>
                  <span className="text-xs text-muted-foreground">Default</span>
                </button>
              )}

              {filteredFonts.length > 0 ? (
                filteredFonts.map((font) => (
                  <button
                    key={font.name}
                    type="button"
                    onClick={() => {
                      onChange(font.name)
                      setIsOpen(false)
                      setSearchTerm('')
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent focus:bg-accent flex items-center justify-between"
                  >
                    <span
                      className="text-sm"
                      style={{ fontFamily: font.name }}
                    >
                      {font.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {font.category}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No fonts found
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Font Preview */}
      {selectedFont && (
        <div className="p-3 border rounded-md bg-muted/50">
          <p
            className="text-sm"
            style={{ fontFamily: selectedFont.name }}
          >
            The quick brown fox jumps over the lazy dog
          </p>
        </div>
      )}
    </div>
  )
}

export function BrandManager() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)

  const fetchBrands = useCallback(async () => {
    try {
      const response = await fetch('/api/brands')
      const data = await response.json()
      setBrands(data.brands || [])
    } catch (error) {
      console.error('Failed to fetch brands:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBrands()
  }, [fetchBrands])

  const handleSetDefault = async (brandId: string) => {
    try {
      await fetch(`/api/brands/${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      })
      fetchBrands()
    } catch (error) {
      console.error('Failed to set default brand:', error)
    }
  }

  const handleDelete = async (brandId: string) => {
    if (!confirm('Are you sure you want to delete this brand?')) return

    try {
      await fetch(`/api/brands/${brandId}`, { method: 'DELETE' })
      fetchBrands()
    } catch (error) {
      console.error('Failed to delete brand:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Brand Guidelines</h3>
          <p className="text-sm text-muted-foreground">
            Manage your brand assets, colors, fonts, and messaging for AI-generated content
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingBrand(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Brand
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <BrandForm
              brand={editingBrand}
              onSuccess={() => {
                setIsDialogOpen(false)
                fetchBrands()
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : brands.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Palette className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">No brands yet</h4>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
              Add your brand guidelines to ensure AI-generated content matches your identity
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Brand
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {brands.map((brand) => (
              <motion.div
                key={brand.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <BrandCard
                  brand={brand}
                  onEdit={() => {
                    setEditingBrand(brand)
                    setIsDialogOpen(true)
                  }}
                  onSetDefault={() => handleSetDefault(brand.id)}
                  onDelete={() => handleDelete(brand.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function BrandCard({
  brand,
  onEdit,
  onSetDefault,
  onDelete,
}: {
  brand: Brand
  onEdit: () => void
  onSetDefault: () => void
  onDelete: () => void
}) {
  return (
    <Card className={cn(brand.is_default && 'ring-2 ring-primary')}>
      <CardContent className="p-6">
        <div className="flex items-start gap-6">
          {/* Logo/Color Preview */}
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl shrink-0"
            style={{
              background: brand.logo_icon_url
                ? `url(${brand.logo_icon_url}) center/contain no-repeat`
                : `linear-gradient(135deg, ${brand.primary_color}, ${brand.secondary_color || brand.primary_color})`,
            }}
          >
            {!brand.logo_icon_url && brand.name.charAt(0)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold truncate">{brand.name}</h4>
              {brand.is_default && (
                <Badge variant="secondary" className="shrink-0">
                  <Star className="h-3 w-3 mr-1" />
                  Default
                </Badge>
              )}
            </div>
            {brand.tagline && (
              <p className="text-sm text-muted-foreground mb-2">{brand.tagline}</p>
            )}

            {/* Color Swatches */}
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: brand.primary_color }}
                title="Primary"
              />
              {brand.secondary_color && (
                <div
                  className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: brand.secondary_color }}
                  title="Secondary"
                />
              )}
              {brand.accent_color && (
                <div
                  className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: brand.accent_color }}
                  title="Accent"
                />
              )}
              <span className="text-xs text-muted-foreground ml-2">
                {brand.font_family}
              </span>
            </div>

            {/* Voice & Messages Preview */}
            {brand.voice && (
              <p className="text-xs text-muted-foreground">
                Voice: {brand.voice}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {!brand.is_default && (
              <Button variant="ghost" size="sm" onClick={onSetDefault}>
                <Star className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BrandForm({
  brand,
  onSuccess,
}: {
  brand: Brand | null
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    name: brand?.name || '',
    tagline: brand?.tagline || '',
    description: brand?.description || '',
    website_url: brand?.website_url || '',
    primary_color: brand?.primary_color || '#6366f1',
    secondary_color: brand?.secondary_color || '#8b5cf6',
    accent_color: brand?.accent_color || '',
    font_family: brand?.font_family || 'Inter',
    font_heading: brand?.font_heading || '',
    voice: brand?.voice || '',
    tone_attributes: brand?.tone_attributes || [],
    key_messages: brand?.key_messages || [''],
    value_propositions: brand?.value_propositions || [''],
    logo_primary_url: brand?.logo_primary_url || '',
    logo_icon_url: brand?.logo_icon_url || '',
    is_default: brand?.is_default || false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = brand ? `/api/brands/${brand.id}` : '/api/brands'
      const method = brand ? 'PATCH' : 'POST'

      // Clean up data to match API schema expectations
      const cleanedData = {
        ...formData,
        // Filter empty arrays
        key_messages: formData.key_messages.filter(Boolean),
        value_propositions: formData.value_propositions.filter(Boolean),
        // Convert empty strings to undefined for optional fields that expect hex colors
        accent_color: formData.accent_color || undefined,
        secondary_color: formData.secondary_color || undefined,
        font_heading: formData.font_heading || undefined,
        // These can be empty strings
        tagline: formData.tagline,
        description: formData.description,
        website_url: formData.website_url,
        voice: formData.voice,
        logo_primary_url: formData.logo_primary_url,
        logo_icon_url: formData.logo_icon_url,
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedData),
      })

      if (!response.ok) {
        // Try to get detailed error information from response
        let errorMessage = 'Failed to save brand'
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
            if (errorData.details && Array.isArray(errorData.details)) {
              // Format validation errors
              const validationErrors = errorData.details.map((err: any) =>
                `${err.path?.join('.') || 'field'}: ${err.message}`
              ).join(', ')
              errorMessage += `: ${validationErrors}`
            }
          }
        } catch (parseError) {
          // If we can't parse the error response, use the status text
          errorMessage = `Failed to save brand (${response.status}: ${response.statusText})`
        }
        throw new Error(errorMessage)
      }

      onSuccess()
    } catch (error) {
      console.error('Failed to save brand:', error)
      toast({
        title: 'Failed to save brand',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const updateFormData = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const updateArrayField = (key: 'key_messages' | 'value_propositions', index: number, value: string) => {
    const arr = [...formData[key]]
    arr[index] = value
    updateFormData(key, arr)
  }

  const addArrayItem = (key: 'key_messages' | 'value_propositions') => {
    updateFormData(key, [...formData[key], ''])
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{brand ? 'Edit Brand' : 'Add Brand'}</DialogTitle>
        <DialogDescription>
          Define your brand guidelines for AI-generated content
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="basics" className="mt-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basics">
            <Settings2 className="h-4 w-4 mr-2" />
            Basics
          </TabsTrigger>
          <TabsTrigger value="colors">
            <Palette className="h-4 w-4 mr-2" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="typography">
            <Type className="h-4 w-4 mr-2" />
            Typography
          </TabsTrigger>
          <TabsTrigger value="messaging">
            <MessageSquare className="h-4 w-4 mr-2" />
            Messaging
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basics" className="space-y-4 mt-4">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="name">Brand Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                placeholder="Acme Corp"
                required
              />
            </div>
            <div>
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={formData.tagline}
                onChange={(e) => updateFormData('tagline', e.target.value)}
                placeholder="The future of productivity"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                placeholder="Brief description of your company..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website_url}
                onChange={(e) => updateFormData('website_url', e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="logo_primary">Primary Logo URL</Label>
                <Input
                  id="logo_primary"
                  value={formData.logo_primary_url}
                  onChange={(e) => updateFormData('logo_primary_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label htmlFor="logo_icon">Icon/Favicon URL</Label>
                <Input
                  id="logo_icon"
                  value={formData.logo_icon_url}
                  onChange={(e) => updateFormData('logo_icon_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="colors" className="space-y-4 mt-4">
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="primary_color">Primary Color *</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="primary_color"
                    value={formData.primary_color}
                    onChange={(e) => updateFormData('primary_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => updateFormData('primary_color', e.target.value)}
                    className="flex-1"
                    placeholder="#6366f1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="secondary_color">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="secondary_color"
                    value={formData.secondary_color}
                    onChange={(e) => updateFormData('secondary_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => updateFormData('secondary_color', e.target.value)}
                    className="flex-1"
                    placeholder="#8b5cf6"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="accent_color">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="accent_color"
                    value={formData.accent_color || '#10b981'}
                    onChange={(e) => updateFormData('accent_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.accent_color}
                    onChange={(e) => updateFormData('accent_color', e.target.value)}
                    className="flex-1"
                    placeholder="#10b981"
                  />
                </div>
              </div>
            </div>

            {/* Color Preview */}
            <div className="p-4 rounded-lg border">
              <Label className="mb-3 block">Preview</Label>
              <div
                className="h-24 rounded-lg flex items-center justify-center text-white font-semibold"
                style={{
                  background: `linear-gradient(135deg, ${formData.primary_color}, ${formData.secondary_color || formData.primary_color})`,
                }}
              >
                {formData.name || 'Brand Preview'}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="typography" className="space-y-4 mt-4">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="font_family">Primary Font Family</Label>
              <FontPicker
                value={formData.font_family}
                onChange={(value) => updateFormData('font_family', value)}
                placeholder="Select primary font"
              />
            </div>
            <div>
              <Label htmlFor="font_heading">Heading Font (optional)</Label>
              <FontPicker
                value={formData.font_heading || 'same-as-primary'}
                onChange={(value) => updateFormData('font_heading', value === 'same-as-primary' ? '' : value)}
                placeholder="Same as primary"
              />
            </div>

            {/* Typography Preview */}
            <div className="p-4 rounded-lg border">
              <Label className="mb-3 block">Preview</Label>
              <div style={{ fontFamily: formData.font_family }}>
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: formData.font_heading || formData.font_family }}>
                  Headline Text
                </h2>
                <p className="text-muted-foreground">
                  Body text looks like this. The quick brown fox jumps over the lazy dog.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="messaging" className="space-y-4 mt-4">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="voice">Brand Voice</Label>
              <Select
                value={formData.voice}
                onValueChange={(value) => updateFormData('voice', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select voice style" />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_OPTIONS.map((voice) => (
                    <SelectItem key={voice} value={voice}>
                      {voice}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Key Messages</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Core messages that should be reinforced in generated content
              </p>
              {formData.key_messages.map((message, index) => (
                <Input
                  key={index}
                  value={message}
                  onChange={(e) => updateArrayField('key_messages', index, e.target.value)}
                  placeholder={`Key message ${index + 1}`}
                  className="mb-2"
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayItem('key_messages')}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Message
              </Button>
            </div>

            <div>
              <Label>Value Propositions</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Core value props for your product/service
              </p>
              {formData.value_propositions.map((prop, index) => (
                <Input
                  key={index}
                  value={prop}
                  onChange={(e) => updateArrayField('value_propositions', index, e.target.value)}
                  placeholder={`Value prop ${index + 1}`}
                  className="mb-2"
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayItem('value_propositions')}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Value Prop
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between items-center mt-6 pt-4 border-t">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formData.is_default}
            onChange={(e) => updateFormData('is_default', e.target.checked)}
            className="rounded"
          />
          Set as default brand
        </label>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              {brand ? 'Save Changes' : 'Create Brand'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
