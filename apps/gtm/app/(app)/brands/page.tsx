'use client'

/**
 * Brands Page - List and manage imported brands
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Building2,
  Plus,
  Globe,
  Palette,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Trash2,
  Edit,
  Search,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface Brand {
  id: string
  name: string
  domain?: string
  logo_url?: string
  primary_color?: string
  created_at: string
}

export default function BrandsPage() {
  const router = useRouter()
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  useEffect(() => {
    fetch('/api/brands')
      .then(res => res.json())
      .then(data => setBrands(data.brands || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])
  
  const handleDelete = async (brandId: string) => {
    if (!confirm('Delete this brand? This cannot be undone.')) return
    
    try {
      await fetch(`/api/brands/${brandId}`, { method: 'DELETE' })
      setBrands(prev => prev.filter(b => b.id !== brandId))
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const filteredBrands = brands.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }
  
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 bg-background min-h-screen text-foreground">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Brands</h1>
          <p className="text-muted-foreground mt-1">Manage imported brand profiles and their visual identities.</p>
        </div>
        <Button onClick={() => router.push('/import')} size="lg" className="gap-2 shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" />
          Import Brand
        </Button>
      </div>

      {brands.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card/50 border-border/50 focus-visible:ring-primary/30"
            />
          </div>
          <div className="text-sm text-muted-foreground hidden sm:block">
            {filteredBrands.length} {filteredBrands.length === 1 ? 'brand' : 'brands'}
          </div>
        </div>
      )}
      
      {/* Brands List */}
      {brands.length === 0 ? (
        <Card className="border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden relative mt-8">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
          <CardContent className="py-20 text-center relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_-10px_rgba(132,204,22,0.5)]">
              <Building2 className="w-10 h-10 text-primary-foreground" />
            </div>
            <h3 className="text-2xl font-bold mb-3">No brands imported yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Import a website to automatically extract its visual identity, tone of voice, and value propositions.
            </p>
            <Button asChild size="lg" className="h-12 px-8 rounded-xl shadow-lg shadow-primary/20">
              <Link href="/import" className="gap-2">
                <Globe className="w-4 h-4" />
                Import from URL
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredBrands.map((brand, i) => (
              <motion.div
                key={brand.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Card className="hover:border-primary/50 bg-card/40 border-border/50 backdrop-blur-sm transition-all h-full group flex flex-col relative overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 right-0 h-1" 
                    style={{ backgroundColor: brand.primary_color || 'hsl(var(--primary))' }}
                  />
                  
                  <CardContent className="p-6 flex-1 flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div 
                        className="w-16 h-16 rounded-2xl flex items-center justify-center border border-border shadow-sm bg-background"
                      >
                        {brand.logo_url ? (
                          <img 
                            src={brand.logo_url} 
                            alt={brand.name}
                            className="w-10 h-10 object-contain"
                          />
                        ) : (
                          <Building2 
                            className="w-8 h-8"
                            style={{ color: brand.primary_color || 'hsl(var(--primary))' }}
                          />
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/brands/${brand.id}`)}>
                            <Edit className="w-4 h-4 mr-2" /> Edit Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(brand.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete Brand
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="space-y-1 mb-6 flex-1">
                      <h3 className="font-semibold text-xl truncate">{brand.name}</h3>
                      {brand.domain ? (
                        <a 
                          href={`https://${brand.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 w-fit"
                        >
                          {brand.domain}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground">No domain added</p>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                      {brand.primary_color ? (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-5 h-5 rounded-full border border-border shadow-sm"
                            style={{ backgroundColor: brand.primary_color }}
                          />
                          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                            {brand.primary_color}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Palette className="w-3.5 h-3.5" /> No color
                        </div>
                      )}
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs font-medium text-primary p-0 h-auto hover:bg-transparent hover:underline group-hover:translate-x-1 transition-transform"
                        onClick={() => router.push(`/campaigns/new?brand=${brand.id}`)}
                      >
                        Create Campaign <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}