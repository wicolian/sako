'use client'

/**
 * Image Picker Modal
 * 
 * Multi-source image selection:
 * - Unsplash API
 * - User uploads
 * - URL import
 * - AI generation
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Upload,
  Link,
  Sparkles,
  Image as ImageIcon,
  X,
  Check,
  Loader2,
  ExternalLink,
  Grid,
  LayoutList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { UnsplashPhoto } from '@/lib/assets/unsplash-client'

interface ImagePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (image: SelectedImage) => void
  aspectRatio?: 'landscape' | 'portrait' | 'square' | 'any'
}

export interface SelectedImage {
  url: string
  thumbnailUrl?: string
  alt?: string
  attribution?: string
  attributionLink?: string
  width?: number
  height?: number
  source: 'unsplash' | 'upload' | 'url' | 'ai'
}

type ViewMode = 'grid' | 'list'

export function ImagePicker({
  open,
  onOpenChange,
  onSelect,
  aspectRatio = 'any',
}: ImagePickerProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'upload' | 'url' | 'ai'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [orientation, setOrientation] = useState<string>(
    aspectRatio === 'landscape' ? 'landscape' :
    aspectRatio === 'portrait' ? 'portrait' :
    aspectRatio === 'square' ? 'squarish' : 'any'
  )
  const [color, setColor] = useState<string>('any')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [urlInput, setUrlInput] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<UnsplashPhoto | null>(null)

  // Search Unsplash
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['unsplash-search', searchQuery, orientation, color],
    queryFn: async () => {
      if (!searchQuery.trim()) return null
      
      const params = new URLSearchParams({
        query: searchQuery,
        per_page: '30',
      })
      if (orientation !== 'any') params.set('orientation', orientation)
      if (color !== 'any') params.set('color', color)
      
      const res = await fetch(`/api/images/search?${params}`)
      if (!res.ok) throw new Error('Search failed')
      return res.json()
    },
    enabled: activeTab === 'search' && searchQuery.length > 0,
  })

  // Get curated photos when no search
  const { data: curatedPhotos, isLoading: isLoadingCurated } = useQuery({
    queryKey: ['unsplash-curated'],
    queryFn: async () => {
      const res = await fetch('/api/images/curated')
      if (!res.ok) throw new Error('Failed to load curated photos')
      return res.json()
    },
    enabled: activeTab === 'search' && !searchQuery,
  })

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!res.ok) throw new Error('Upload failed')
      return res.json()
    },
    onSuccess: (data) => {
      handleSelect({
        url: data.url,
        thumbnailUrl: data.thumbnailUrl,
        width: data.width,
        height: data.height,
        source: 'upload',
      })
    },
  })

  // AI generation mutation
  const generateMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      
      if (!res.ok) throw new Error('Generation failed')
      return res.json()
    },
    onSuccess: (data) => {
      handleSelect({
        url: data.url,
        alt: aiPrompt,
        source: 'ai',
      })
    },
  })

  const handleSelect = useCallback((image: SelectedImage) => {
    onSelect(image)
    onOpenChange(false)
    setSelectedPhoto(null)
  }, [onSelect, onOpenChange])

  const handleUnsplashSelect = useCallback((photo: UnsplashPhoto) => {
    // Track download as required by Unsplash
    fetch(`/api/images/track-download?url=${encodeURIComponent(photo.links.download_location)}`)
    
    handleSelect({
      url: photo.urls.regular,
      thumbnailUrl: photo.urls.small,
      alt: photo.alt_description || photo.description || undefined,
      attribution: `Photo by ${photo.user.name} on Unsplash`,
      attributionLink: `${photo.links.html}?utm_source=sako&utm_medium=referral`,
      width: photo.width,
      height: photo.height,
      source: 'unsplash',
    })
  }, [handleSelect])

  const handleUrlSubmit = useCallback(() => {
    if (!urlInput.trim()) return
    
    handleSelect({
      url: urlInput.trim(),
      source: 'url',
    })
    setUrlInput('')
  }, [urlInput, handleSelect])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadMutation.mutate(file)
    }
  }, [uploadMutation])

  const photos = searchQuery ? searchResults?.results : curatedPhotos
  const isLoading = searchQuery ? isSearching : isLoadingCurated

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Choose an Image</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 grid grid-cols-4 w-auto">
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Search
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-2">
              <Link className="h-4 w-4" />
              URL
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="h-4 w-4" />
              AI Generate
            </TabsTrigger>
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="flex-1 flex flex-col overflow-hidden m-0 p-6 pt-4">
            {/* Search Controls */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search free high-resolution photos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={orientation} onValueChange={setOrientation}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Orientation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="squarish">Square</SelectItem>
                </SelectContent>
              </Select>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Color</SelectItem>
                  <SelectItem value="black_and_white">B&W</SelectItem>
                  <SelectItem value="black">Black</SelectItem>
                  <SelectItem value="white">White</SelectItem>
                  <SelectItem value="blue">Blue</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                  <SelectItem value="orange">Orange</SelectItem>
                  <SelectItem value="yellow">Yellow</SelectItem>
                  <SelectItem value="purple">Purple</SelectItem>
                  <SelectItem value="teal">Teal</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-9 w-9 rounded-r-none"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-9 w-9 rounded-l-none"
                  onClick={() => setViewMode('list')}
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Photo Grid */}
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : photos?.length ? (
                <div className={cn(
                  viewMode === 'grid'
                    ? 'grid grid-cols-3 gap-3'
                    : 'space-y-2'
                )}>
                  {photos.map((photo: UnsplashPhoto) => (
                    <motion.div
                      key={photo.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "group relative cursor-pointer rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors",
                        selectedPhoto?.id === photo.id && "border-primary"
                      )}
                      onClick={() => handleUnsplashSelect(photo)}
                    >
                      {viewMode === 'grid' ? (
                        <div className="aspect-[4/3]">
                          <img
                            src={photo.urls.small}
                            alt={photo.alt_description || ''}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Check className="h-8 w-8 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-2">
                          <img
                            src={photo.urls.thumb}
                            alt={photo.alt_description || ''}
                            className="w-16 h-12 object-cover rounded"
                            loading="lazy"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {photo.alt_description || 'Untitled'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              by {photo.user.name}
                            </p>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {photo.width}×{photo.height}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No photos found for "{searchQuery}"</p>
                </div>
              ) : null}
            </ScrollArea>

            <p className="text-xs text-muted-foreground mt-4">
              Photos provided by <a href="https://unsplash.com/?utm_source=sako&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="underline">Unsplash</a>
            </p>
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload" className="flex-1 m-0 p-6 pt-4">
            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12">
              {uploadMutation.isPending ? (
                <div className="text-center">
                  <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                  <p className="text-muted-foreground">Uploading...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Drop an image here</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    or click to browse (max 10MB)
                  </p>
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <Button asChild>
                      <span>Choose File</span>
                    </Button>
                    <Input
                      id="file-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </Label>
                </>
              )}
            </div>
          </TabsContent>

          {/* URL Tab */}
          <TabsContent value="url" className="flex-1 m-0 p-6 pt-4">
            <div className="space-y-4">
              <div>
                <Label>Image URL</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="https://example.com/image.jpg"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                  />
                  <Button onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
                    Import
                  </Button>
                </div>
              </div>

              {urlInput && (
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                  <img
                    src={urlInput}
                    alt="Preview"
                    className="max-w-full max-h-64 rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          {/* AI Generate Tab */}
          <TabsContent value="ai" className="flex-1 m-0 p-6 pt-4">
            <div className="space-y-4">
              <div>
                <Label>Describe the image you want</Label>
                <textarea
                  placeholder="A modern office space with natural lighting, minimalist furniture, and plants..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="mt-2 w-full h-32 px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <Button
                onClick={() => generateMutation.mutate(aiPrompt)}
                disabled={!aiPrompt.trim() || generateMutation.isPending}
                className="w-full"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Image
                  </>
                )}
              </Button>

              {generateMutation.data && (
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">Generated:</p>
                  <img
                    src={generateMutation.data.url}
                    alt={aiPrompt}
                    className="max-w-full rounded"
                  />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
