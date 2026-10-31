'use client'

/**
 * New Request Page - Intake form for team requests
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  FileText,
  Image,
  Mail,
  Presentation,
  Share2,
  MoreHorizontal,
  Loader2,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { AssetType, Priority, CreateRequestInput } from '@/lib/requests/request-types'

const ASSET_TYPES: Array<{ value: AssetType; label: string; icon: React.ElementType; description: string }> = [
  { value: 'landing_page', label: 'Landing Page', icon: FileText, description: 'Marketing or product landing page' },
  { value: 'ads', label: 'Ads', icon: Image, description: 'Display, social, or search ads' },
  { value: 'emails', label: 'Email Sequence', icon: Mail, description: 'Nurture or campaign emails' },
  { value: 'deck', label: 'Presentation', icon: Presentation, description: 'Sales or marketing deck' },
  { value: 'social', label: 'Social Posts', icon: Share2, description: 'LinkedIn, Twitter, etc.' },
  { value: 'other', label: 'Other', icon: MoreHorizontal, description: 'Something else' },
]

const PRIORITIES: Array<{ value: Priority; label: string; color: string }> = [
  { value: 'urgent', label: 'Urgent', color: 'text-red-500' },
  { value: 'normal', label: 'Normal', color: 'text-foreground' },
  { value: 'low', label: 'Low Priority', color: 'text-muted-foreground' },
]

export default function NewRequestPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<CreateRequestInput>({
    assetType: 'landing_page',
    title: '',
    brief: {
      audience: '',
      offer: '',
      context: '',
    },
    priority: 'normal',
  })
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.title.trim()) {
      toast.error('Please enter a title')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      
      const data = await response.json()
      
      if (data.request) {
        toast.success('Request created!')
        router.push(`/requests/${data.request.id}`)
      } else {
        toast.error(data.error || 'Failed to create request')
      }
    } catch (error) {
      toast.error('Failed to create request')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="container max-w-2xl py-8 min-h-screen bg-background text-foreground">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/requests')}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Requests
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle>New Request</CardTitle>
          <CardDescription>
            Submit a request for marketing assets. Your team will generate them using AI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Asset Type */}
            <div className="space-y-2">
              <Label>What do you need?</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ASSET_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, assetType: type.value }))}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      form.assetType === type.value
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
            
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Q1 Product Launch Landing Page"
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
            
            {/* Target Audience */}
            <div className="space-y-2">
              <Label htmlFor="audience">Target Audience</Label>
              <Input
                id="audience"
                placeholder="e.g., SaaS founders with 10-50 employees"
                value={form.brief.audience || ''}
                onChange={(e) => setForm(prev => ({ 
                  ...prev, 
                  brief: { ...prev.brief, audience: e.target.value } 
                }))}
              />
            </div>
            
            {/* Main Offer */}
            <div className="space-y-2">
              <Label htmlFor="offer">Main Offer / Value Proposition</Label>
              <Input
                id="offer"
                placeholder="e.g., Ship landing pages 10x faster with AI"
                value={form.brief.offer || ''}
                onChange={(e) => setForm(prev => ({ 
                  ...prev, 
                  brief: { ...prev.brief, offer: e.target.value } 
                }))}
              />
            </div>
            
            {/* Additional Context */}
            <div className="space-y-2">
              <Label htmlFor="context">Additional Context</Label>
              <Textarea
                id="context"
                placeholder="Any specific requirements, references, or things to include/avoid..."
                value={form.brief.context || ''}
                onChange={(e) => setForm(prev => ({ 
                  ...prev, 
                  brief: { ...prev.brief, context: e.target.value } 
                }))}
                rows={4}
              />
            </div>
            
            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(value: Priority) => setForm(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className={p.color}>{p.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (optional)</Label>
              <Input
                id="dueDate"
                type="date"
                value={form.dueDate || ''}
                onChange={(e) => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            
            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/requests')}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Create Request
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
