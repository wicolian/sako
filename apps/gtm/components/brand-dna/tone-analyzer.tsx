'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { MessageSquare, AlertCircle, ThumbsUp, ThumbsDown } from 'lucide-react'

interface VoiceData {
  tone?: string[]
  personality?: string[]
  writingStyle?: string
  doNotUse?: string[]
}

interface ToneAnalyzerProps {
  voice: VoiceData
}

const TONE_DESCRIPTIONS: Record<string, { description: string; color: string }> = {
  professional: { description: 'Formal and business-like', color: 'bg-blue-500' },
  friendly: { description: 'Warm and approachable', color: 'bg-green-500' },
  casual: { description: 'Relaxed and conversational', color: 'bg-yellow-500' },
  authoritative: { description: 'Expert and confident', color: 'bg-purple-500' },
  playful: { description: 'Fun and lighthearted', color: 'bg-pink-500' },
  inspiring: { description: 'Motivational and uplifting', color: 'bg-orange-500' },
  empathetic: { description: 'Understanding and caring', color: 'bg-teal-500' },
  direct: { description: 'Clear and to the point', color: 'bg-red-500' },
}

export function ToneAnalyzer({ voice }: ToneAnalyzerProps) {
  const tones = voice.tone || []
  const personalities = voice.personality || []
  const doNotUse = voice.doNotUse || []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Voice & Tone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tone spectrum */}
        {tones.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Brand Tone</p>
            <div className="space-y-3">
              {tones.map((tone, i) => {
                const toneInfo = TONE_DESCRIPTIONS[tone.toLowerCase()] || {
                  description: 'Custom tone',
                  color: 'bg-muted/100',
                }
                // Calculate prominence (first items are more prominent)
                const prominence = 100 - (i * 20)
                return (
                  <div key={tone} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{tone}</span>
                      <span className="text-muted-foreground">{prominence}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${toneInfo.color} rounded-full transition-all`}
                        style={{ width: `${prominence}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{toneInfo.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Personality traits */}
        {personalities.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Personality Traits</p>
            <div className="flex flex-wrap gap-2">
              {personalities.map((trait, i) => (
                <Badge key={i} variant="secondary" className="capitalize">
                  {trait}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Writing style */}
        {voice.writingStyle && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Writing Style</p>
            <p className="text-sm">{voice.writingStyle}</p>
          </div>
        )}

        {/* Do's and Don'ts */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-500 mb-2">
              <ThumbsUp className="h-4 w-4" />
              Do Use
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {tones.slice(0, 3).map((tone, i) => (
                <li key={i}>• {tone} language</li>
              ))}
              {personalities.slice(0, 2).map((trait, i) => (
                <li key={i}>• {trait} messaging</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
              <ThumbsDown className="h-4 w-4" />
              Avoid
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {doNotUse.length > 0 ? (
                doNotUse.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))
              ) : (
                <>
                  <li>• Overly technical jargon</li>
                  <li>• Aggressive sales language</li>
                  <li>• Negative framing</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
