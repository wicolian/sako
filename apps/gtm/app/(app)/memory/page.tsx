'use client'

/**
 * Production Memory Dashboard - "What Sako Learned"
 * 
 * Shows approved content, performance insights, and learning patterns.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Brain,
  Sparkles,
  TrendingUp,
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  FileText,
  MessageSquare,
  Image,
  Mail,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import type { MemoryStats, MemorySearchResult } from '@/lib/memory/memory-types'

const CONTENT_TYPE_ICONS: Record<string, React.ElementType> = {
  claim: FileText,
  headline: MessageSquare,
  paragraph: FileText,
  email: Mail,
  ad: Image,
  social: MessageSquare,
  other: FileText,
}

export default function MemoryPage() {
  const router = useRouter()
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  
  // Fetch stats on load
  useEffect(() => {
    fetch('/api/memory?stats=true')
      .then(res => res.json())
      .then(data => setStats(data.stats))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])
  
  // Search handler
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setSearching(true)
    try {
      const response = await fetch(`/api/memory?query=${encodeURIComponent(searchQuery)}&limit=20`)
      const data = await response.json()
      setSearchResults(data.results || [])
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setSearching(false)
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 min-h-screen bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  return (
    <div className="container max-w-5xl py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          Production Memory
        </h1>
        <p className="text-muted-foreground">
          What Sako has learned from your approved content and performance data
        </p>
      </div>
      
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Memories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalItems}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">{stats.approvedItems}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                <XCircle className="w-3 h-3 text-red-500" />
                Rejected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.rejectedItems}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Avg Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.avgFeedbackScore > 0 ? '+' : ''}{Math.round(stats.avgFeedbackScore)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Tabs */}
      <Tabs defaultValue="search">
        <TabsList className="mb-4">
          <TabsTrigger value="search">Semantic Search</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>
        
        {/* Search Tab */}
        <TabsContent value="search">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Memory</CardTitle>
              <CardDescription>
                Find similar content from your approved memory bank
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Search for similar content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              {/* Results */}
              {searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map((result, i) => {
                    const Icon = CONTENT_TYPE_ICONS[result.item.contentType] || FileText
                    return (
                      <div 
                        key={i}
                        className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {result.item.contentType}
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={
                                  result.item.status === 'approved' 
                                    ? 'bg-green-500/10 text-emerald-500' 
                                    : 'bg-red-500/10 text-destructive'
                                }
                              >
                                {result.item.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {Math.round(result.similarity * 100)}% match
                              </span>
                            </div>
                            <p className="text-sm">{result.item.content}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : searchQuery && !searching ? (
                <p className="text-center text-muted-foreground py-8">
                  No matching memories found
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Insights Tab */}
        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Learning Insights</CardTitle>
              <CardDescription>
                Patterns Sako has learned from your content
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats && stats.totalItems > 0 ? (
                <div className="space-y-6">
                  {/* Content Type Distribution */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Content by Type</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(stats.itemsByType).map(([type, count]) => {
                        const Icon = CONTENT_TYPE_ICONS[type] || FileText
                        return (
                          <div 
                            key={type}
                            className="flex items-center gap-2 p-3 rounded-lg bg-muted/50"
                          >
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm capitalize">{type}</span>
                            <Badge variant="outline" className="ml-auto">
                              {count as number}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* Recommendations */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Recommendations</h4>
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="w-4 h-4 text-green-500" />
                          <span className="text-sm font-medium">What works</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Based on {stats.approvedItems} approved items, your audience responds well to 
                          specific, quantified claims over generic statements.
                        </p>
                      </div>
                      {stats.rejectedItems > 0 && (
                        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                          <div className="flex items-center gap-2 mb-1">
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm font-medium">What to avoid</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {stats.rejectedItems} items were rejected. Common issues include 
                            unsubstantiated superlatives and compliance violations.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Brain}
                  title="No memories yet"
                  description="As you approve content and track performance, Sako will learn what works for your brand."
                  action={{ label: "Create Your First Kit", onClick: () => router.push("/kit/new") }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
