'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Plus, Search, Sparkles, Target, Briefcase, Brain, ShoppingCart, Edit2, Trash2, Copy, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface AudienceProfile {
  id: string
  name: string
  description?: string
  demographics: {
    age_range?: string
    gender?: string
    income_level?: string
    education?: string
    location?: string
    family_status?: string
  }
  professional: {
    job_titles?: string[]
    industries?: string[]
    company_size?: string
    seniority?: string
    department?: string
  }
  psychographics: {
    values?: string[]
    interests?: string[]
    lifestyle?: string
    personality_traits?: string[]
  }
  behavioral: {
    purchase_behavior?: string
    brand_loyalty?: string
    media_consumption?: string[]
    decision_factors?: string[]
  }
  pain_points: string[]
  goals: string[]
  created_at: string
  updated_at: string
}

interface AudienceManagerProps {
  workspaceId: string
  brandId?: string
  onSelectAudience?: (audience: AudienceProfile) => void
  selectable?: boolean
}

const categoryIcons: Record<string, React.ReactNode> = {
  demographics: <Users className="w-4 h-4" />,
  professional: <Briefcase className="w-4 h-4" />,
  psychographics: <Brain className="w-4 h-4" />,
  behavioral: <ShoppingCart className="w-4 h-4" />,
}

export function AudienceManager({ workspaceId, brandId, onSelectAudience, selectable }: AudienceManagerProps) {
  const [audiences, setAudiences] = useState<AudienceProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState<AudienceProfile | null>(null)
  const [generating, setGenerating] = useState(false)
  const [aiDescription, setAiDescription] = useState('')

  const fetchAudiences = useCallback(async () => {
    try {
      const params = new URLSearchParams({ workspace_id: workspaceId })
      if (brandId) params.append('brand_id', brandId)
      if (searchQuery) params.append('search', searchQuery)

      const response = await fetch(`/api/audiences?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAudiences(data.audiences || [])
      }
    } catch (error) {
      console.error('Failed to fetch audiences:', error)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, brandId, searchQuery])

  useEffect(() => {
    fetchAudiences()
  }, [fetchAudiences])

  const handleGenerateAudience = async () => {
    if (!aiDescription.trim()) return

    setGenerating(true)
    try {
      const response = await fetch('/api/audiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          workspace_id: workspaceId,
          brand_id: brandId,
          description: aiDescription,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setAudiences(prev => [data.audience, ...prev])
        setShowCreateDialog(false)
        setAiDescription('')
      }
    } catch (error) {
      console.error('Failed to generate audience:', error)
    } finally {
      setGenerating(false)
    }
  }

  const handleDeleteAudience = async (id: string) => {
    try {
      const response = await fetch('/api/audiences', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          audience_id: id,
        }),
      })

      if (response.ok) {
        setAudiences(prev => prev.filter(a => a.id !== id))
        setShowDetailDialog(null)
      }
    } catch (error) {
      console.error('Failed to delete audience:', error)
    }
  }

  const filteredAudiences = audiences.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            Audience Profiles
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Define customer segments for targeted content generation
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Audience
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search audiences..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-muted border-border"
        />
      </div>

      {/* Audience grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredAudiences.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredAudiences.map((audience, index) => (
              <motion.div
                key={audience.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <AudienceCard
                  audience={audience}
                  onView={() => setShowDetailDialog(audience)}
                  onSelect={selectable ? () => onSelectAudience?.(audience) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No audiences yet</h3>
          <p className="text-muted-foreground mb-6">
            Create audience profiles to target your content more effectively
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Audience
          </Button>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Create Audience Profile
            </DialogTitle>
            <DialogDescription>
              Describe your target audience and let AI generate a detailed profile
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label>Describe your target audience</Label>
              <Textarea
                placeholder="e.g., 'Small business owners in tech who struggle with marketing automation and want to grow their online presence...'"
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                className="mt-2 h-32 bg-muted border-border"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Be specific about demographics, goals, pain points, and behaviors
              </p>
            </div>

            {/* Quick templates */}
            <div>
              <Label className="text-xs text-muted-foreground">Quick templates</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  'SaaS startup founders',
                  'Enterprise marketing managers',
                  'E-commerce store owners',
                  'Content creators & influencers',
                  'Agency executives',
                ].map((template) => (
                  <Button
                    key={template}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setAiDescription(template)}
                  >
                    {template}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerateAudience}
                disabled={generating || !aiDescription.trim()}
              >
                {generating ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="mr-2"
                    >
                      <Sparkles className="w-4 h-4" />
                    </motion.div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Profile
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!showDetailDialog} onOpenChange={() => setShowDetailDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {showDetailDialog && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle>{showDetailDialog.name}</DialogTitle>
                    <DialogDescription className="mt-1">
                      {showDetailDialog.description}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive/80"
                      onClick={() => handleDeleteAudience(showDetailDialog.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Demographics */}
                <ProfileSection
                  title="Demographics"
                  icon={categoryIcons.demographics}
                  data={showDetailDialog.demographics}
                />

                {/* Professional */}
                <ProfileSection
                  title="Professional"
                  icon={categoryIcons.professional}
                  data={showDetailDialog.professional}
                />

                {/* Psychographics */}
                <ProfileSection
                  title="Psychographics"
                  icon={categoryIcons.psychographics}
                  data={showDetailDialog.psychographics}
                />

                {/* Behavioral */}
                <ProfileSection
                  title="Behavioral"
                  icon={categoryIcons.behavioral}
                  data={showDetailDialog.behavioral}
                />

                {/* Pain points */}
                {showDetailDialog.pain_points?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <span className="text-rose-400">⚡</span>
                      Pain Points
                    </h4>
                    <ul className="space-y-2">
                      {showDetailDialog.pain_points.map((point, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-rose-400">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Goals */}
                {showDetailDialog.goals?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <span className="text-emerald-400">🎯</span>
                      Goals
                    </h4>
                    <ul className="space-y-2">
                      {showDetailDialog.goals.map((goal, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-emerald-400">•</span>
                          {goal}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-border">
                  {selectable && (
                    <Button
                      className="flex-1"
                      onClick={() => {
                        onSelectAudience?.(showDetailDialog)
                        setShowDetailDialog(null)
                      }}
                    >
                      <Target className="w-4 h-4 mr-2" />
                      Use This Audience
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setShowDetailDialog(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AudienceCard({
  audience,
  onView,
  onSelect,
}: {
  audience: AudienceProfile
  onView: () => void
  onSelect?: () => void
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn(
        "p-5 rounded-xl border transition-colors cursor-pointer",
        "bg-card border-border hover:border-ring"
      )}
      onClick={onView}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        {onSelect && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      <h3 className="font-semibold mb-1">{audience.name}</h3>
      {audience.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {audience.description}
        </p>
      )}

      {/* Quick tags */}
      <div className="flex flex-wrap gap-1">
        {audience.demographics?.age_range && (
          <Badge variant="outline" className="text-xs bg-muted/50 border-border">
            {audience.demographics.age_range}
          </Badge>
        )}
        {audience.professional?.job_titles?.[0] && (
          <Badge variant="outline" className="text-xs bg-muted/50 border-border">
            {audience.professional.job_titles[0]}
          </Badge>
        )}
        {audience.professional?.industries?.[0] && (
          <Badge variant="outline" className="text-xs bg-muted/50 border-border">
            {audience.professional.industries[0]}
          </Badge>
        )}
      </div>

      {/* Pain points preview */}
      {audience.pain_points?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <span className="text-rose-400">⚡</span> {audience.pain_points[0].substring(0, 60)}...
          </p>
        </div>
      )}
    </motion.div>
  )
}

function ProfileSection({
  title,
  icon,
  data,
}: {
  title: string
  icon: React.ReactNode
  data: Record<string, any>
}) {
  const entries = Object.entries(data).filter(([_, v]) => v && (Array.isArray(v) ? v.length > 0 : true))
  
  if (entries.length === 0) return null

  return (
    <div>
      <h4 className="font-medium mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h4>
      <div className="grid grid-cols-2 gap-3">
        {entries.map(([key, value]) => (
          <div key={key} className="text-sm">
            <span className="text-muted-foreground capitalize">
              {key.replace(/_/g, ' ')}:
            </span>
            <div className="mt-1">
              {Array.isArray(value) ? (
                <div className="flex flex-wrap gap-1">
                  {value.map((item, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-muted/50 border-border">
                      {item}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-foreground">{value}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
