'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Target, AlertTriangle, Star } from 'lucide-react'

interface AudienceData {
  primary?: string
  demographics?: string[]
  painPoints?: string[]
  goals?: string[]
}

interface AudienceInsightsProps {
  audience: AudienceData
}

export function AudienceInsights({ audience }: AudienceInsightsProps) {
  const demographics = audience.demographics || []
  const painPoints = audience.painPoints || []
  const goals = audience.goals || []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Target Audience
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary audience */}
        {audience.primary && (
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 text-sm font-medium text-primary mb-1">
              <Target className="h-4 w-4" />
              Primary Audience
            </div>
            <p className="text-lg font-medium">{audience.primary}</p>
          </div>
        )}

        {/* Demographics */}
        {demographics.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Demographics</p>
            <div className="flex flex-wrap gap-2">
              {demographics.map((demo, i) => (
                <Badge key={i} variant="outline">{demo}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Pain Points */}
        {painPoints.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-orange-600 mb-2">
              <AlertTriangle className="h-4 w-4" />
              Pain Points
            </div>
            <ul className="space-y-2">
              {painPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-orange-500 mt-1">•</span>
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Goals */}
        {goals.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-500 mb-2">
              <Star className="h-4 w-4" />
              Goals & Desires
            </div>
            <ul className="space-y-2">
              {goals.map((goal, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-green-500 mt-1">•</span>
                  <span className="text-muted-foreground">{goal}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Persona Summary */}
        {audience.primary && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-2">Persona Summary</p>
            <p className="text-sm text-muted-foreground">
              {audience.primary} who {painPoints[0]?.toLowerCase().includes('struggle') ? painPoints[0].toLowerCase() : `struggles with ${painPoints[0]?.toLowerCase() || 'various challenges'}`} and {goals[0]?.toLowerCase().includes('want') ? goals[0].toLowerCase() : `wants to ${goals[0]?.toLowerCase() || 'achieve their goals'}`}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
