'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, Sparkles, Target, AlertCircle, CheckCircle, ArrowRight, RefreshCw, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface PredictionFactor {
  name: string
  impact: 'positive' | 'negative' | 'neutral'
  description: string
  weight: number
}

interface SimilarCampaign {
  id: string
  name: string
  similarity_score: number
  performance_score: number
}

interface Prediction {
  score: number
  confidence: number
  factors: PredictionFactor[]
  recommendations: string[]
  similar_campaigns: SimilarCampaign[]
  predicted_metrics: {
    engagement_rate?: number
    conversion_rate?: number
    reach_potential?: number
  }
}

interface PerformancePredictionsProps {
  campaignId: string
  campaignData?: {
    name: string
    audience?: string
    goal?: string
    content?: string
  }
  compact?: boolean
}

const scoreColors = {
  high: { bg: 'bg-emerald-950/30', text: 'text-emerald-400', border: 'border-emerald-800' },
  medium: { bg: 'bg-amber-950/30', text: 'text-amber-400', border: 'border-amber-800' },
  low: { bg: 'bg-rose-950/30', text: 'text-rose-400', border: 'border-rose-800' },
}

function getScoreLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

export function PerformancePredictions({ campaignId, campaignData, compact }: PerformancePredictionsProps) {
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPrediction = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaignId,
          campaign_data: campaignData,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setPrediction(data.prediction)
      } else {
        setError('Failed to generate prediction')
      }
    } catch (err) {
      setError('Unable to connect to prediction service')
    } finally {
      setLoading(false)
    }
  }, [campaignId, campaignData])

  useEffect(() => {
    fetchPrediction()
  }, [fetchPrediction])

  if (loading) {
    return (
      <div className={cn(
        "flex items-center justify-center",
        compact ? "h-24" : "h-64"
      )}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Sparkles className="w-6 h-6 text-amber-400" />
        </motion.div>
      </div>
    )
  }

  if (error || !prediction) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-4" : "py-12"
      )}>
        <AlertCircle className="w-8 h-8 text-rose-400 mb-3" />
        <p className="text-sm text-muted-foreground mb-3">{error || 'No prediction available'}</p>
        <Button variant="outline" size="sm" onClick={fetchPrediction}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  const scoreLevel = getScoreLevel(prediction.score)
  const colors = scoreColors[scoreLevel]

  if (compact) {
    return (
      <CompactPrediction
        prediction={prediction}
        scoreLevel={scoreLevel}
        colors={colors}
        onRefresh={fetchPrediction}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold">Performance Prediction</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchPrediction}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Main score */}
      <div className={cn(
        "p-6 rounded-xl border",
        colors.bg,
        colors.border
      )}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Predicted Performance</p>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-4xl font-bold", colors.text)}>
                {prediction.score}
              </span>
              <span className="text-muted-foreground">/ 100</span>
            </div>
          </div>
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center",
            colors.bg
          )}>
            {scoreLevel === 'high' && <TrendingUp className={cn("w-8 h-8", colors.text)} />}
            {scoreLevel === 'medium' && <Minus className={cn("w-8 h-8", colors.text)} />}
            {scoreLevel === 'low' && <TrendingDown className={cn("w-8 h-8", colors.text)} />}
          </div>
        </div>

        <Progress
          value={prediction.score}
          className="h-2 bg-muted"
        />

        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">
            Confidence: {Math.round(prediction.confidence * 100)}%
          </span>
          <Badge variant="outline" className={cn(colors.text, colors.border)}>
            {scoreLevel === 'high' && 'Strong Potential'}
            {scoreLevel === 'medium' && 'Moderate Potential'}
            {scoreLevel === 'low' && 'Needs Improvement'}
          </Badge>
        </div>
      </div>

      {/* Predicted metrics */}
      {prediction.predicted_metrics && (
        <div className="grid grid-cols-3 gap-4">
          {prediction.predicted_metrics.engagement_rate !== undefined && (
            <MetricCard
              label="Engagement Rate"
              value={`${prediction.predicted_metrics.engagement_rate}%`}
              icon={<Target className="w-4 h-4" />}
            />
          )}
          {prediction.predicted_metrics.conversion_rate !== undefined && (
            <MetricCard
              label="Conversion Rate"
              value={`${prediction.predicted_metrics.conversion_rate}%`}
              icon={<CheckCircle className="w-4 h-4" />}
            />
          )}
          {prediction.predicted_metrics.reach_potential !== undefined && (
            <MetricCard
              label="Reach Potential"
              value={prediction.predicted_metrics.reach_potential.toLocaleString()}
              icon={<Sparkles className="w-4 h-4" />}
            />
          )}
        </div>
      )}

      {/* Factors */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          Key Factors
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">
                  These factors influence the predicted performance based on historical data and best practices.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h4>
        <div className="space-y-2">
          {prediction.factors.map((factor, index) => (
            <FactorItem key={index} factor={factor} />
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {prediction.recommendations.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Recommendations</h4>
          <div className="space-y-2">
            {prediction.recommendations.map((rec, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border"
              >
                <ArrowRight className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">{rec}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Similar campaigns */}
      {prediction.similar_campaigns.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Similar High-Performing Campaigns</h4>
          <div className="space-y-2">
            {prediction.similar_campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center justify-between p-3 rounded-lg bg-card border border-border"
              >
                <div>
                  <p className="font-medium text-sm">{campaign.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(campaign.similarity_score * 100)}% similar
                  </p>
                </div>
                <Badge variant="outline" className="bg-emerald-950/30 text-emerald-400 border-emerald-800">
                  Score: {campaign.performance_score}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CompactPrediction({
  prediction,
  scoreLevel,
  colors,
  onRefresh,
}: {
  prediction: Prediction
  scoreLevel: 'high' | 'medium' | 'low'
  colors: typeof scoreColors.high
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      colors.bg,
      colors.border
    )}>
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              colors.bg
            )}>
              {scoreLevel === 'high' && <TrendingUp className={cn("w-5 h-5", colors.text)} />}
              {scoreLevel === 'medium' && <Minus className={cn("w-5 h-5", colors.text)} />}
              {scoreLevel === 'low' && <TrendingDown className={cn("w-5 h-5", colors.text)} />}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Performance Score</p>
              <p className={cn("text-xl font-bold", colors.text)}>
                {prediction.score}/100
              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn(colors.text, colors.border, "text-xs")}>
            {prediction.factors.filter(f => f.impact === 'positive').length} strengths
          </Badge>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
              {prediction.factors.slice(0, 3).map((factor, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  {factor.impact === 'positive' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                  {factor.impact === 'negative' && <AlertCircle className="w-4 h-4 text-rose-400" />}
                  {factor.impact === 'neutral' && <Minus className="w-4 h-4 text-muted-foreground" />}
                  <span className="text-muted-foreground">{factor.name}</span>
                </div>
              ))}
              {prediction.recommendations[0] && (
                <div className="p-2 rounded bg-black/20 text-xs text-muted-foreground">
                  💡 {prediction.recommendations[0]}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="p-4 rounded-lg bg-card border border-border">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

function FactorItem({ factor }: { factor: PredictionFactor }) {
  const impactColors = {
    positive: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    negative: { bg: 'bg-rose-500/20', text: 'text-rose-400' },
    neutral: { bg: 'bg-zinc-500/20', text: 'text-muted-foreground' },
  }

  const colors = impactColors[factor.impact]

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colors.bg)}>
        {factor.impact === 'positive' && <TrendingUp className={cn("w-4 h-4", colors.text)} />}
        {factor.impact === 'negative' && <TrendingDown className={cn("w-4 h-4", colors.text)} />}
        {factor.impact === 'neutral' && <Minus className={cn("w-4 h-4", colors.text)} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{factor.name}</p>
        <p className="text-xs text-muted-foreground truncate">{factor.description}</p>
      </div>
      <div className="text-right">
        <span className={cn("text-sm font-medium", colors.text)}>
          {factor.impact === 'positive' && '+'}
          {factor.impact === 'negative' && '-'}
          {Math.round(factor.weight * 100)}%
        </span>
      </div>
    </div>
  )
}
