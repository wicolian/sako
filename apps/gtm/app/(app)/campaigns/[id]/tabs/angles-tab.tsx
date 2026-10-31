'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Campaign, Angle } from '@/lib/supabase/types'

interface AnglesTabProps {
  campaign: Campaign
  angles: Angle[]
}

import { EmptyState } from '@/components/ui/empty-state'

export function AnglesTab({ campaign, angles }: AnglesTabProps) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [selecting, setSelecting] = useState<string | null>(null)

  const generateAngles = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/ai/generate-angles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
        }),
      })
      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to generate angles:', error)
    } finally {
      setGenerating(false)
    }
  }

  const selectAngle = async (angleId: string) => {
    setSelecting(angleId)
    try {
      await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_angle_id: angleId }),
      })
      router.refresh()
    } catch (error) {
      console.error('Failed to select angle:', error)
    } finally {
      setSelecting(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Campaign Angles</h2>
          <p className="text-sm text-muted-foreground">
            Different approaches for your campaign messaging
          </p>
        </div>
        <Button onClick={generateAngles} disabled={generating}>
          {generating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {angles.length > 0 ? 'Regenerate Angles' : 'Generate Angles'}
        </Button>
      </div>

      {angles.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No angles yet"
          description="Generate different campaign approaches to test with your audience."
          action={{
            label: generating ? 'Generating...' : 'Generate Angles',
            onClick: generateAngles,
            icon: generating ? Loader2 : Sparkles
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {angles.map((angle) => {
            const isSelected = campaign.selected_angle_id === angle.id
            const isRecommended = angle.rank === 1
            
            return (
              <Card
                key={angle.id}
                className={`relative transition-all ${
                  isSelected
                    ? 'ring-2 ring-primary'
                    : 'hover:border-primary/50'
                }`}
              >
                {isRecommended && (
                  <div className="absolute -top-2 -right-2">
                    <Badge className="bg-primary text-primary-foreground">
                      Recommended
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-base">{angle.name}</CardTitle>
                  <CardDescription>{angle.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Trust Score</span>
                      <span className="font-medium">{angle.trust_score}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${angle.trust_score}%` }}
                      />
                    </div>
                  </div>
                  
                  {angle.rationale && (
                    <p className="text-xs text-muted-foreground mb-4">
                      {angle.rationale}
                    </p>
                  )}

                  <Button
                    variant={isSelected ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => selectAngle(angle.id)}
                    disabled={selecting === angle.id || isSelected}
                  >
                    {selecting === angle.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : isSelected ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : null}
                    {isSelected ? 'Selected' : 'Select Angle'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
