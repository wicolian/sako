'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FlaskConical, Plus, Play, Pause, Trophy, BarChart2, Clock, Users, Target, CheckCircle, XCircle, Sparkles, ChevronDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ExperimentVariant {
  id: string
  name: string
  content: string
  traffic_percent: number
  impressions: number
  conversions: number
  conversion_rate: number
}

interface Experiment {
  id: string
  name: string
  description?: string
  status: 'draft' | 'running' | 'paused' | 'completed'
  variants: ExperimentVariant[]
  winner_variant_id?: string
  total_impressions: number
  confidence_level: number
  started_at?: string
  completed_at?: string
  created_at: string
}

interface ABTestPanelProps {
  workspaceId: string
  campaignId?: string
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
  running: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  paused: { bg: 'bg-amber-50 ', text: 'text-amber-500 ', border: 'border-amber-200 dark:border-amber-800' },
  completed: { bg: 'bg-blue-50 ', text: 'text-blue-500 ', border: 'border-blue-200 dark:border-blue-800' },
}

export function ABTestPanel({ workspaceId, campaignId }: ABTestPanelProps) {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null)
  const [newExperiment, setNewExperiment] = useState({
    name: '',
    description: '',
    variants: [
      { name: 'Control', content: '', traffic_percent: 50 },
      { name: 'Variant A', content: '', traffic_percent: 50 },
    ],
  })

  const fetchExperiments = useCallback(async () => {
    try {
      const params = new URLSearchParams({ workspace_id: workspaceId })
      if (campaignId) params.append('campaign_id', campaignId)

      const response = await fetch(`/api/experiments?${params}`)
      if (response.ok) {
        const data = await response.json()
        setExperiments(data.experiments || [])
      }
    } catch (error) {
      console.error('Failed to fetch experiments:', error)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, campaignId])

  useEffect(() => {
    fetchExperiments()
  }, [fetchExperiments])

  const handleCreateExperiment = async () => {
    try {
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          campaign_id: campaignId,
          ...newExperiment,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setExperiments(prev => [data.experiment, ...prev])
        setShowCreateDialog(false)
        setNewExperiment({
          name: '',
          description: '',
          variants: [
            { name: 'Control', content: '', traffic_percent: 50 },
            { name: 'Variant A', content: '', traffic_percent: 50 },
          ],
        })
      }
    } catch (error) {
      console.error('Failed to create experiment:', error)
    }
  }

  const handleUpdateStatus = async (experimentId: string, action: 'start' | 'pause' | 'complete') => {
    try {
      const response = await fetch('/api/experiments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          experiment_id: experimentId,
          action,
        }),
      })

      if (response.ok) {
        fetchExperiments()
        if (selectedExperiment?.id === experimentId) {
          const data = await response.json()
          setSelectedExperiment(data.experiment)
        }
      }
    } catch (error) {
      console.error('Failed to update experiment:', error)
    }
  }

  const addVariant = () => {
    const variantNumber = newExperiment.variants.length
    const newTrafficPercent = Math.floor(100 / (variantNumber + 1))
    
    setNewExperiment(prev => ({
      ...prev,
      variants: [
        ...prev.variants.map(v => ({ ...v, traffic_percent: newTrafficPercent })),
        { name: `Variant ${String.fromCharCode(65 + variantNumber - 1)}`, content: '', traffic_percent: newTrafficPercent },
      ],
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-amber-400" />
            A/B Experiments
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Test variations to find what performs best
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Experiment
        </Button>
      </div>

      {/* Experiments list */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : experiments.length > 0 ? (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {experiments.map((experiment, index) => (
              <motion.div
                key={experiment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <ExperimentCard
                  experiment={experiment}
                  onSelect={() => setSelectedExperiment(experiment)}
                  onStart={() => handleUpdateStatus(experiment.id, 'start')}
                  onPause={() => handleUpdateStatus(experiment.id, 'pause')}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-16">
          <FlaskConical className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No experiments yet</h3>
          <p className="text-muted-foreground mb-6">
            Create A/B tests to optimize your campaigns
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Experiment
          </Button>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-amber-400" />
              Create A/B Experiment
            </DialogTitle>
            <DialogDescription>
              Set up variants to test and find the best performing content
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            <div>
              <Label>Experiment Name</Label>
              <Input
                placeholder="e.g., Headline Test Q1"
                value={newExperiment.name}
                onChange={(e) => setNewExperiment(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 bg-muted border-border"
              />
            </div>

            <div>
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="What are you testing?"
                value={newExperiment.description}
                onChange={(e) => setNewExperiment(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 h-20 bg-muted border-border"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Variants</Label>
                <Button variant="outline" size="sm" onClick={addVariant}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add Variant
                </Button>
              </div>

              <div className="space-y-4">
                {newExperiment.variants.map((variant, index) => (
                  <div key={index} className="p-4 rounded-lg bg-muted border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <Input
                        value={variant.name}
                        onChange={(e) => {
                          const updated = [...newExperiment.variants]
                          updated[index].name = e.target.value
                          setNewExperiment(prev => ({ ...prev, variants: updated }))
                        }}
                        className="w-40 h-8 text-sm bg-muted/50 border-border"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Traffic:</span>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={variant.traffic_percent}
                          onChange={(e) => {
                            const updated = [...newExperiment.variants]
                            updated[index].traffic_percent = Number(e.target.value)
                            setNewExperiment(prev => ({ ...prev, variants: updated }))
                          }}
                          className="w-16 h-8 text-sm bg-muted/50 border-border"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Variant content..."
                      value={variant.content}
                      onChange={(e) => {
                        const updated = [...newExperiment.variants]
                        updated[index].content = e.target.value
                        setNewExperiment(prev => ({ ...prev, variants: updated }))
                      }}
                      className="h-24 bg-muted/50 border-border"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateExperiment}
                disabled={!newExperiment.name || newExperiment.variants.some(v => !v.content)}
              >
                Create Experiment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selectedExperiment} onOpenChange={() => setSelectedExperiment(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedExperiment && (
            <ExperimentDetail
              experiment={selectedExperiment}
              onStart={() => handleUpdateStatus(selectedExperiment.id, 'start')}
              onPause={() => handleUpdateStatus(selectedExperiment.id, 'pause')}
              onComplete={() => handleUpdateStatus(selectedExperiment.id, 'complete')}
              onClose={() => setSelectedExperiment(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ExperimentCard({
  experiment,
  onSelect,
  onStart,
  onPause,
}: {
  experiment: Experiment
  onSelect: () => void
  onStart: () => void
  onPause: () => void
}) {
  const colors = statusColors[experiment.status]
  const winner = experiment.variants.find(v => v.id === experiment.winner_variant_id)

  return (
    <div
      className={cn(
        "p-5 rounded-xl border cursor-pointer transition-colors",
        colors.bg,
        colors.border,
        "hover:border-ring"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{experiment.name}</h3>
            <Badge variant="outline" className={cn(colors.text, colors.border, "capitalize")}>
              {experiment.status}
            </Badge>
          </div>
          {experiment.description && (
            <p className="text-sm text-muted-foreground">{experiment.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {experiment.status === 'draft' && (
            <Button size="sm" onClick={onStart}>
              <Play className="w-4 h-4 mr-1" />
              Start
            </Button>
          )}
          {experiment.status === 'running' && (
            <Button size="sm" variant="outline" onClick={onPause}>
              <Pause className="w-4 h-4 mr-1" />
              Pause
            </Button>
          )}
          {experiment.status === 'paused' && (
            <Button size="sm" onClick={onStart}>
              <Play className="w-4 h-4 mr-1" />
              Resume
            </Button>
          )}
        </div>
      </div>

      {/* Variants preview */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {experiment.variants.map((variant) => (
          <div
            key={variant.id}
            className={cn(
              "p-3 rounded-lg bg-muted/50 dark:bg-black/20 border",
              variant.id === experiment.winner_variant_id
                ? "border-primary"
                : "border-transparent"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{variant.name}</span>
              {variant.id === experiment.winner_variant_id && (
                <Trophy className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              <span>{variant.conversion_rate.toFixed(2)}% CR</span>
              <span className="mx-2">•</span>
              <span>{variant.impressions} views</span>
            </div>
          </div>
        ))}
      </div>

      {/* Confidence */}
      {experiment.status !== 'draft' && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Statistical Confidence
            </span>
            <span className={cn(
              experiment.confidence_level >= 95 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            )}>
              {experiment.confidence_level}%
            </span>
          </div>
          <Progress
            value={experiment.confidence_level}
            className="h-1 mt-2 bg-muted/50"
          />
        </div>
      )}
    </div>
  )
}

function ExperimentDetail({
  experiment,
  onStart,
  onPause,
  onComplete,
  onClose,
}: {
  experiment: Experiment
  onStart: () => void
  onPause: () => void
  onComplete: () => void
  onClose: () => void
}) {
  const colors = statusColors[experiment.status]
  const winner = experiment.variants.find(v => v.id === experiment.winner_variant_id)
  const sortedVariants = [...experiment.variants].sort((a, b) => b.conversion_rate - a.conversion_rate)

  return (
    <>
      <DialogHeader>
        <div className="flex items-start justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2">
              {experiment.name}
              <Badge variant="outline" className={cn(colors.text, colors.border, "capitalize")}>
                {experiment.status}
              </Badge>
            </DialogTitle>
            <DialogDescription className="mt-1">
              {experiment.description || 'A/B test experiment'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-6 mt-4">
        {/* Stats overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-muted border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="w-4 h-4" />
              <span className="text-xs">Total Impressions</span>
            </div>
            <p className="text-2xl font-bold">{experiment.total_impressions.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <BarChart2 className="w-4 h-4" />
              <span className="text-xs">Confidence Level</span>
            </div>
            <p className={cn(
              "text-2xl font-bold",
              experiment.confidence_level >= 95 ? "text-emerald-400" : ""
            )}>
              {experiment.confidence_level}%
            </p>
          </div>
          <div className="p-4 rounded-lg bg-muted border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-xs">Duration</span>
            </div>
            <p className="text-2xl font-bold">
              {experiment.started_at
                ? Math.ceil((Date.now() - new Date(experiment.started_at).getTime()) / (1000 * 60 * 60 * 24))
                : 0}d
            </p>
          </div>
        </div>

        {/* Winner announcement */}
        {winner && experiment.status === 'completed' && (
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Winner: {winner.name}</p>
                <p className="text-sm text-muted-foreground">
                  {winner.conversion_rate.toFixed(2)}% conversion rate with {winner.conversions} conversions
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Variants comparison */}
        <div>
          <h4 className="font-medium mb-3">Variants Performance</h4>
          <div className="space-y-3">
            {sortedVariants.map((variant, index) => {
              const maxConversions = Math.max(...experiment.variants.map(v => v.conversions))
              const barWidth = maxConversions > 0 ? (variant.conversions / maxConversions) * 100 : 0
              const isWinner = variant.id === experiment.winner_variant_id

              return (
                <div
                  key={variant.id}
                  className={cn(
                    "p-4 rounded-lg border",
                    isWinner
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted border-border"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {index === 0 && experiment.status !== 'draft' && (
                        <span className="text-amber-400 text-sm">👑</span>
                      )}
                      <span className="font-medium">{variant.name}</span>
                      {isWinner && (
                        <Badge variant="default">
                          Winner
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {variant.traffic_percent}% traffic
                    </span>
                  </div>

                  {/* Content preview */}
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {variant.content}
                  </p>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Impressions</p>
                      <p className="font-medium">{variant.impressions.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Conversions</p>
                      <p className="font-medium">{variant.conversions.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Conv. Rate</p>
                      <p className={cn(
                        "font-medium",
                        index === 0 && experiment.status !== 'draft' && "text-emerald-600 dark:text-emerald-400"
                      )}>
                        {variant.conversion_rate.toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {/* Visual bar */}
                  <div className="mt-3 h-2 bg-muted/50 rounded overflow-hidden">
                    <motion.div
                      className={cn(
                        "h-full rounded",
                        isWinner ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-4 border-t border-border">
          {experiment.status === 'draft' && (
            <Button onClick={onStart}>
              <Play className="w-4 h-4 mr-2" />
              Start Experiment
            </Button>
          )}
          {experiment.status === 'running' && (
            <>
              <Button variant="outline" onClick={onPause}>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
              {experiment.confidence_level >= 95 && (
                <Button onClick={onComplete}>
                  <Trophy className="w-4 h-4 mr-2" />
                  Declare Winner
                </Button>
              )}
            </>
          )}
          {experiment.status === 'paused' && (
            <Button onClick={onStart}>
              <Play className="w-4 h-4 mr-2" />
              Resume
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="ml-auto">
            Close
          </Button>
        </div>
      </div>
    </>
  )
}
