'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Loader2, RefreshCcw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AnimatedGauge } from '@/components/ui/animated-gauge'
import { cn } from '@/lib/utils'

interface PredictionCardProps {
  campaignId: string
}

interface Prediction {
  predictedConversionRate: number
  confidenceLevel: 'low' | 'medium' | 'high'
  benchmarkComparison: {
    industryAverage: number
    topPerformer: number
    yourPrediction: number
  }
  improvementSuggestions: Array<{
    area: string
    currentState: string
    suggestion: string
    estimatedImpact: number
  }>
  similarCampaigns: Array<{
    campaignId: string
    campaignName: string
    conversionRate: number
    similarity: number
  }>
  riskFactors: Array<{
    factor: string
    severity: 'low' | 'medium' | 'high'
    mitigation: string
  }>
}

export function PredictionCard({ campaignId }: PredictionCardProps) {
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPrediction = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/predict`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch prediction')
      }
      const data = await response.json()
      setPrediction(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prediction')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrediction()
  }, [campaignId])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={fetchPrediction} size="sm">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!prediction) return null

  const isAboveAverage = prediction.predictedConversionRate > prediction.benchmarkComparison.industryAverage

  return (
    <div className="space-y-4">
      {/* Main Prediction */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Performance Prediction
          </CardTitle>
          <CardDescription>
            AI-powered estimate based on historical data and content analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <AnimatedGauge
              value={prediction.predictedConversionRate * 10} // Scale for gauge display
              max={100}
              size="lg"
              label="Predicted"
            />

            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-4xl font-bold">
                  {prediction.predictedConversionRate.toFixed(1)}%
                </span>
                <Badge
                  variant={isAboveAverage ? 'default' : 'secondary'}
                  className={cn(
                    isAboveAverage
                      ? 'bg-emerald-500/10 text-green-800  '
                      : ''
                  )}
                >
                  {isAboveAverage ? (
                    <>
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Above Average
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-3 h-3 mr-1" />
                      Below Average
                    </>
                  )}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-2 bg-muted rounded-lg">
                  <div className="font-medium">{prediction.benchmarkComparison.industryAverage.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Industry Avg</div>
                </div>
                <div className="text-center p-2 bg-muted rounded-lg">
                  <div className="font-medium">{prediction.benchmarkComparison.topPerformer.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Top Performer</div>
                </div>
                <div className="text-center p-2 bg-muted rounded-lg">
                  <div className="font-medium capitalize">{prediction.confidenceLevel}</div>
                  <div className="text-xs text-muted-foreground">Confidence</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Improvement Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="w-4 h-4" />
            Improvement Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {prediction.improvementSuggestions.map((suggestion, i) => (
              <div key={i} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-sm">{suggestion.area}</div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Current: {suggestion.currentState}
                  </div>
                  <div className="text-sm">{suggestion.suggestion}</div>
                </div>
                <Badge variant="outline" className="h-fit">
                  +{suggestion.estimatedImpact}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risk Factors */}
      {prediction.riskFactors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-4 h-4" />
              Risk Factors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {prediction.riskFactors.map((risk, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex justify-between items-center p-2 rounded-lg',
                    risk.severity === 'high' && 'bg-red-50 ',
                    risk.severity === 'medium' && 'bg-amber-50 ',
                    risk.severity === 'low' && 'bg-muted/50'
                  )}
                >
                  <div>
                    <span className="text-sm font-medium">{risk.factor}</span>
                    <p className="text-xs text-muted-foreground">{risk.mitigation}</p>
                  </div>
                  <Badge
                    variant={
                      risk.severity === 'high'
                        ? 'destructive'
                        : risk.severity === 'medium'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {risk.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Similar Campaigns */}
      {prediction.similarCampaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Similar Campaigns</CardTitle>
            <CardDescription>Historical campaigns with similar attributes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {prediction.similarCampaigns.map((campaign) => (
                <div
                  key={campaign.campaignId}
                  className="flex justify-between items-center p-2 bg-muted/50 rounded-lg"
                >
                  <div>
                    <span className="text-sm font-medium">{campaign.campaignName}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {campaign.similarity}% similar
                    </span>
                  </div>
                  <Badge variant="outline">{campaign.conversionRate.toFixed(1)}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
