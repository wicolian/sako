'use client'

/**
 * Brief Form - Launch Kit brief intake form
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users,
  Gift,
  MousePointer,
  Target,
  Rocket,
  Sparkles,
  Calendar,
} from 'lucide-react'
import type { LaunchKitBrief, LaunchType } from '@/lib/kit/kit-types'

const LAUNCH_TYPES: Array<{ value: LaunchType; label: string; description: string; icon: React.ElementType }> = [
  { value: 'product', label: 'Product Launch', description: 'Full product announcement', icon: Rocket },
  { value: 'feature', label: 'Feature Launch', description: 'New feature or update', icon: Sparkles },
  { value: 'campaign', label: 'Campaign', description: 'Marketing campaign', icon: Target },
  { value: 'event', label: 'Event', description: 'Conference or event', icon: Calendar },
  { value: 'webinar', label: 'Webinar', description: 'Webinar or workshop', icon: Users },
]

interface BriefFormProps {
  initialValues?: Partial<LaunchKitBrief>
  onSubmit: (brief: Partial<LaunchKitBrief>) => void
  isLoading?: boolean
}

export function BriefForm({ initialValues, onSubmit, isLoading }: BriefFormProps) {
  const [brief, setBrief] = useState<Partial<LaunchKitBrief>>({
    launchType: 'product',
    audience: '',
    offer: '',
    cta: '',
    constraints: { mustInclude: [], mustAvoid: [] },
    ...initialValues,
  })
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(brief)
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Launch Brief</CardTitle>
          <CardDescription>
            Tell us about your launch and we'll generate a complete kit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Launch Type */}
          <div className="space-y-2">
            <Label>Launch Type</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LAUNCH_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setBrief(prev => ({ ...prev, launchType: type.value }))}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    brief.launchType === type.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <type.icon className="w-4 h-4 mb-1 text-primary" />
                  <div className="text-sm font-medium">{type.label}</div>
                  <div className="text-xs text-muted-foreground">{type.description}</div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Audience */}
          <div className="space-y-2">
            <Label htmlFor="audience">
              <Users className="w-4 h-4 inline mr-1" />
              Target Audience *
            </Label>
            <Input
              id="audience"
              placeholder="e.g., SaaS founders with 10-50 employees"
              value={brief.audience || ''}
              onChange={(e) => setBrief(prev => ({ ...prev, audience: e.target.value }))}
              required
            />
          </div>
          
          {/* Offer */}
          <div className="space-y-2">
            <Label htmlFor="offer">
              <Gift className="w-4 h-4 inline mr-1" />
              Main Offer / Value Proposition *
            </Label>
            <Textarea
              id="offer"
              placeholder="e.g., Ship your landing page 10x faster with AI-powered generation"
              value={brief.offer || ''}
              onChange={(e) => setBrief(prev => ({ ...prev, offer: e.target.value }))}
              rows={3}
              required
            />
          </div>
          
          {/* CTA */}
          <div className="space-y-2">
            <Label htmlFor="cta">
              <MousePointer className="w-4 h-4 inline mr-1" />
              Primary Call-to-Action *
            </Label>
            <Input
              id="cta"
              placeholder="e.g., Start Free Trial"
              value={brief.cta || ''}
              onChange={(e) => setBrief(prev => ({ ...prev, cta: e.target.value }))}
              required
            />
          </div>
          
          {/* Submit */}
          <Button 
            type="submit" 
            className="w-full"
            disabled={!brief.audience || !brief.offer || !brief.cta || isLoading}
          >
            {isLoading ? 'Saving...' : 'Continue'}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
