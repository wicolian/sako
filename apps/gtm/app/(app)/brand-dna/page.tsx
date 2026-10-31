'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import {
  Globe,
  RefreshCw,
  Sparkles,
  Palette,
  Type,
  Users,
  MessageSquare,
  Target,
  Loader2,
  Plus,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { DnaOverview } from '@/components/brand-dna/dna-overview'
import { ToneAnalyzer } from '@/components/brand-dna/tone-analyzer'
import { AudienceInsights } from '@/components/brand-dna/audience-insights'
import { ColorPalette } from '@/components/brand-dna/color-palette'

interface BrandData {
  id: string
  name: string
  website_url: string
  logo_url?: string
  colors: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
    palette?: string[]
  }
  voice: {
    tone?: string[]
    personality?: string[]
    writingStyle?: string
    doNotUse?: string[]
  }
  audience: {
    primary?: string
    demographics?: string[]
    painPoints?: string[]
    goals?: string[]
  }
  industry?: string
  tagline?: string
  mission?: string
  values?: string[]
  competitors?: string[]
  keywords?: string[]
  analyzed_at?: string
  confidence_score?: number
}

export default function BrandDnaPage() {
  const [brand, setBrand] = useState<BrandData | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [importStage, setImportStage] = useState('')

  useEffect(() => {
    loadBrandData()
  }, [])

  const loadBrandData = async () => {
    const supabase = createClient()
    
    // Get workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle() as { data: { workspace_id: string } | null }

    if (!membership?.workspace_id) {
      setLoading(false)
      return
    }

    setWorkspaceId(membership.workspace_id)

    // Get brand
    const { data: brands } = await supabase
      .from('brands')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at', { ascending: false })
      .limit(1) as { data: Record<string, unknown>[] | null }

    if (brands && brands.length > 0) {
      const b = brands[0]
      setBrand({
        id: b.id as string,
        name: b.name as string,
        website_url: (b.website_url as string) || '',
        logo_url: b.logo_url as string | undefined,
        colors: (b.colors as BrandData['colors']) || {},
        voice: (b.voice as BrandData['voice']) || {},
        audience: (b.audience as BrandData['audience']) || {},
        industry: b.industry as string | undefined,
        tagline: b.tagline as string | undefined,
        mission: b.mission as string | undefined,
        values: b.values as string[] | undefined,
        competitors: b.competitors as string[] | undefined,
        keywords: b.keywords as string[] | undefined,
        analyzed_at: b.updated_at as string | undefined,
        confidence_score: b.confidence_score as number | undefined,
      })
    }

    setLoading(false)
  }

  const analyzeUrl = async () => {
    if (!urlInput.trim() || !workspaceId) return

    setAnalyzing(true)
    setImportProgress(0)
    setImportStage('')

    try {
      const response = await fetch('/api/import/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput,
          confirmOwnership: true,
        }),
      })

      if (!response.ok || !response.body) {
        const errorText = await response.text()
        let errorMessage = 'Analysis failed'
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error || errorMessage
        } catch {
          // Not JSON, use default message
        }
        throw new Error(errorMessage)
      }

      // Handle streaming SSE response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        chunk.split('\n\n').filter(Boolean).forEach(line => {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.substring(6))
              if (event.event === 'progress') {
                setImportProgress(event.progress)
                setImportStage(event.message || event.stage)
              } else if (event.event === 'complete') {
                toast.success('Brand DNA extracted successfully!')
                loadBrandData()
                setUrlInput('')
                setAnalyzing(false)
              } else if (event.event === 'error') {
                throw new Error(event.error || 'Analysis failed')
              }
            } catch (e) {
              if (e instanceof Error && e.message !== 'Analysis failed') {
                console.error('Parse error:', e)
              } else {
                throw e
              }
            }
          }
        })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to analyze URL')
      setAnalyzing(false)
    }
  }

  const refreshAnalysis = async () => {
    if (!brand?.website_url) return

    setAnalyzing(true)
    setImportProgress(0)
    setImportStage('')

    try {
      const response = await fetch('/api/import/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: brand.website_url,
          confirmOwnership: true,
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error('Refresh failed')
      }

      // Handle streaming SSE response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        chunk.split('\n\n').filter(Boolean).forEach(line => {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.substring(6))
              if (event.event === 'progress') {
                setImportProgress(event.progress)
                setImportStage(event.message || event.stage)
              } else if (event.event === 'complete') {
                toast.success('Brand DNA refreshed!')
                loadBrandData()
                setAnalyzing(false)
              } else if (event.event === 'error') {
                throw new Error(event.error || 'Refresh failed')
              }
            } catch (e) {
              if (e instanceof Error && e.message !== 'Refresh failed') {
                console.error('Parse error:', e)
              } else {
                throw e
              }
            }
          }
        })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh analysis')
      setAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Brand DNA
              </h1>
              <p className="text-muted-foreground mt-1">
                Your brand's unique identity, extracted and analyzed
              </p>
            </div>
            
            {brand && (
              <div className="flex items-center gap-4">
                {analyzing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{importStage || 'Analyzing...'}</span>
                    <span className="font-medium">{importProgress}%</span>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={refreshAnalysis}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Re-analyze
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!brand ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xl mx-auto text-center py-16"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
              <Globe className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Extract Your Brand DNA</h2>
            <p className="text-muted-foreground mb-8">
              Enter your website URL and we'll analyze it to extract your brand's colors,
              voice, audience insights, and more.
            </p>

            <div className="flex gap-2 max-w-md mx-auto">
              <Input
                placeholder="https://your-website.com"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && analyzeUrl()}
                disabled={analyzing}
              />
              <Button onClick={analyzeUrl} disabled={analyzing || !urlInput.trim()}>
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze
                  </>
                )}
              </Button>
            </div>

            {/* Import Progress */}
            {analyzing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 max-w-md mx-auto space-y-2"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{importStage || 'Starting...'}</span>
                  <span className="font-medium">{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </motion.div>
            )}
          </motion.div>
        ) : (
          /* Brand DNA Dashboard */
          <div className="space-y-8">
            {/* Overview Card */}
            <DnaOverview brand={brand} />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Colors */}
              <ColorPalette colors={brand.colors} />

              {/* Voice & Tone */}
              <ToneAnalyzer voice={brand.voice} />

              {/* Audience */}
              <AudienceInsights audience={brand.audience} />

              {/* Keywords & Competitors */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Market Position
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {brand.keywords && brand.keywords.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Keywords</p>
                      <div className="flex flex-wrap gap-2">
                        {brand.keywords.map((keyword, i) => (
                          <Badge key={i} variant="secondary">{keyword}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {brand.competitors && brand.competitors.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Competitors</p>
                      <div className="flex flex-wrap gap-2">
                        {brand.competitors.map((competitor, i) => (
                          <Badge key={i} variant="outline">{competitor}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {brand.values && brand.values.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Brand Values</p>
                      <div className="flex flex-wrap gap-2">
                        {brand.values.map((value, i) => (
                          <Badge key={i}>{value}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Analysis Metadata */}
            {brand.analyzed_at && (
              <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Last analyzed: {new Date(brand.analyzed_at).toLocaleString()}
                </div>
                {brand.confidence_score && (
                  <div className="flex items-center gap-2">
                    Confidence: 
                    <Progress value={brand.confidence_score * 100} className="w-24" />
                    {Math.round(brand.confidence_score * 100)}%
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
