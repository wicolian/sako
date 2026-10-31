'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Brain,
  Palette,
  Users,
  BookOpen,
  ChevronRight,
  Plus,
  TrendingUp,
  Clock,
  Sparkles,
  Loader2,
  CheckCircle2,
  FileText,
  Link,
  Database,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface IQStats {
  brands: { total: number; recentlyUpdated: number }
  audiences: { total: number; recentlyUpdated: number }
  knowledge: { 
    total: number
    byType: Record<string, number>
    recentlyUpdated: number 
  }
}

interface LearningInsight {
  id: string
  statement: string
  confidence: number
  status: string
  averageConversionRate: number
  citations: number
  confidenceDelta: number
}

export default function IQDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<IQStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState<Array<{
    id: string
    type: 'brand' | 'audience' | 'knowledge'
    name: string
    action: string
    time: string
  }>>([])
  const [learningInsights, setLearningInsights] = useState<{
    topClaims: LearningInsight[]
    claimsToReview: LearningInsight[]
  }>({
    topClaims: [],
    claimsToReview: [],
  })

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // Get workspace
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

      // Fetch counts
      const [brandsResult, audiencesResult, knowledgeResult, learningResponse] = await Promise.all([
        supabase
          .from('brands')
          .select('*', { count: 'exact' })
          .eq('workspace_id', workspaceId),
        supabase
          .from('audiences')
          .select('*', { count: 'exact' })
          .eq('workspace_id', workspaceId),
        supabase
          .from('knowledge_items')
          .select('*')
          .eq('workspace_id', workspaceId)
          .is('parent_id', null),
        fetch('/api/brain/feedback').then((response) => response.ok ? response.json() : null),
      ])

      // Calculate knowledge by type
      const knowledgeByType: Record<string, number> = {}
      for (const item of (knowledgeResult.data || []) as Array<{ content_type: string }>) {
        knowledgeByType[item.content_type] = (knowledgeByType[item.content_type] || 0) + 1
      }

      setStats({
        brands: {
          total: brandsResult.count || 0,
          recentlyUpdated: Math.min(brandsResult.count || 0, 2),
        },
        audiences: {
          total: audiencesResult.count || 0,
          recentlyUpdated: Math.min(audiencesResult.count || 0, 3),
        },
        knowledge: {
          total: knowledgeResult.data?.length || 0,
          byType: knowledgeByType,
          recentlyUpdated: Math.min(knowledgeResult.data?.length || 0, 5),
        },
      })

      if (learningResponse) {
        setLearningInsights({
          topClaims: learningResponse.topClaims || [],
          claimsToReview: learningResponse.claimsToReview || [],
        })
      }

      // Mock recent activity
      setRecentActivity([
        { id: '1', type: 'brand', name: 'Acme Corp', action: 'Voice updated', time: '2 hours ago' },
        { id: '2', type: 'audience', name: 'Enterprise Decision Makers', action: 'Created', time: '5 hours ago' },
        { id: '3', type: 'knowledge', name: 'Product FAQ', action: 'Added', time: 'Yesterday' },
      ])
    } catch (error) {
      console.error('Failed to fetch IQ stats:', error)
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] min-h-screen bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const sections = [
    {
      id: 'brand-voice',
      title: 'Brand Voice',
      description: 'Define your brand personality, tone, and messaging guidelines',
      icon: Palette,
      color: 'from-violet-500 to-purple-500',
      href: '/brand-dna',
      stats: stats?.brands,
      statLabel: 'brand voices',
    },
    {
      id: 'audiences',
      title: 'Audiences',
      description: 'Create detailed audience profiles and personas',
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      href: '/audiences',
      stats: stats?.audiences,
      statLabel: 'audience profiles',
    },
    {
      id: 'knowledge',
      title: 'Knowledge Base',
      description: 'Upload documents, URLs, and data to enhance AI context',
      icon: BookOpen,
      color: 'from-emerald-500 to-teal-500',
      href: '/iq/knowledge',
      stats: stats?.knowledge,
      statLabel: 'knowledge items',
    },
  ]

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-lg shadow-primary/20">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">IQ</h1>
            <p className="text-muted-foreground">
              Your brand intelligence center
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Brand Voices</p>
                <p className="text-3xl font-bold">{stats?.brands.total || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                <Palette className="h-6 w-6 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Audience Profiles</p>
                <p className="text-3xl font-bold">{stats?.audiences.total || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Knowledge Items</p>
                <p className="text-3xl font-bold">{stats?.knowledge.total || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {sections.map((section, index) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group h-full"
              onClick={() => router.push(section.href)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg',
                      section.color
                    )}
                  >
                    <section.icon className="h-6 w-6 text-white" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle className="mt-4">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {section.stats?.total || 0} {section.statLabel}
                  </span>
                  {(section.stats?.recentlyUpdated || 0) > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {section.stats?.recentlyUpdated} updated recently
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Knowledge Type Breakdown */}
      {stats?.knowledge && stats.knowledge.total > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Knowledge Base Breakdown</CardTitle>
            <CardDescription>Content types in your knowledge base</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { type: 'document', icon: FileText, label: 'Documents', color: 'text-blue-500' },
                { type: 'url', icon: Link, label: 'URLs', color: 'text-green-500' },
                { type: 'manual', icon: Sparkles, label: 'Manual', color: 'text-purple-500' },
                { type: 'data', icon: Database, label: 'Data', color: 'text-orange-500' },
              ].map(({ type, icon: Icon, label, color }) => (
                <div key={type} className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn('h-4 w-4', color)} />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {stats.knowledge.byType[type] || 0}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Performing Claims</CardTitle>
            <CardDescription>Facts whose confidence improved after live campaign data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {learningInsights.topClaims.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Publish campaigns and sync performance to start improving fact confidence.
              </p>
            ) : (
              learningInsights.topClaims.map((claim) => (
                <div key={claim.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{claim.statement}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{claim.averageConversionRate}% CVR</Badge>
                    <Badge variant="secondary">{claim.citations} campaigns</Badge>
                    <Badge variant="secondary">+{claim.confidenceDelta.toFixed(3)} confidence</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Claims To Review</CardTitle>
            <CardDescription>Facts flagged because they underperform your workspace average.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {learningInsights.claimsToReview.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No claims are currently flagged for review.
              </p>
            ) : (
              learningInsights.claimsToReview.map((claim) => (
                <div key={claim.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{claim.statement}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{claim.averageConversionRate}% CVR</Badge>
                    <Badge variant="outline">{claim.citations} citations</Badge>
                    <Badge variant="outline" className="text-amber-600">Review required</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <CardDescription>Latest updates to your brand intelligence</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div
                    className={cn(
                      'h-10 w-10 rounded-full flex items-center justify-center',
                      activity.type === 'brand' && 'bg-violet-500/10 text-violet-500',
                      activity.type === 'audience' && 'bg-blue-500/10 text-blue-500',
                      activity.type === 'knowledge' && 'bg-emerald-500/10 text-emerald-500'
                    )}
                  >
                    {activity.type === 'brand' && <Palette className="h-5 w-5" />}
                    {activity.type === 'audience' && <Users className="h-5 w-5" />}
                    {activity.type === 'knowledge' && <BookOpen className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{activity.name}</p>
                    <p className="text-sm text-muted-foreground">{activity.action}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{activity.time}</span>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
