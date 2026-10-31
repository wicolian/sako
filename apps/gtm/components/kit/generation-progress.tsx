'use client'

/**
 * Generation Progress - Animated progress UI for kit generation
 */

import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import {
  Wand2,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import type { GenerationProgress as GenerationProgressType } from '@/lib/kit/kit-types'

interface GenerationProgressProps {
  progress: GenerationProgressType | null
  error?: string
}

const STEPS = [
  { id: 'angles', label: 'Marketing Angles' },
  { id: 'landing_page', label: 'Landing Page' },
  { id: 'ads', label: 'Ad Variants' },
  { id: 'emails', label: 'Email Sequence' },
  { id: 'social', label: 'Social Posts' },
  { id: 'deck', label: 'Presentation' },
  { id: 'validation', label: 'Compliance Check' },
]

export function GenerationProgress({ progress, error }: GenerationProgressProps) {
  const currentStepIndex = progress?.step 
    ? STEPS.findIndex(s => s.id === progress.step)
    : -1
  
  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Generation Failed</h3>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardContent className="py-12">
        <div className="text-center space-y-4 mb-8">
          <Wand2 className="w-12 h-12 text-primary mx-auto animate-pulse" />
          <h3 className="text-xl font-semibold">
            {progress?.message || 'Generating your launch kit...'}
          </h3>
          <Progress value={progress?.progress || 0} className="h-2 max-w-sm mx-auto" />
          <p className="text-sm text-muted-foreground">
            {progress?.progress || 0}% complete
          </p>
        </div>
        
        {/* Step Progress */}
        <div className="max-w-sm mx-auto space-y-2">
          {STEPS.map((step, index) => {
            const isDone = currentStepIndex > index || (currentStepIndex === index && progress?.step === 'complete')
            const isCurrent = currentStepIndex === index && progress?.step !== 'complete'
            
            return (
              <div 
                key={step.id}
                className={`flex items-center gap-2 text-sm ${
                  isDone 
                    ? 'text-green-500' 
                    : isCurrent 
                      ? 'text-primary' 
                      : 'text-muted-foreground'
                }`}
              >
                {isDone ? (
                  <CheckCircle className="w-4 h-4" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-current" />
                )}
                <span>{step.label}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
