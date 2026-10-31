'use client'

import { useState, useEffect } from 'react'
import { Shield, Check, Loader2, FileText, Building2, Heart, Landmark, ShoppingCart, Scale, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface PolicyTemplate {
  id: string
  name: string
  description: string
}

const templateIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'default-b2b-saas': FileText,
  'soc2-compliance': Building2,
  'hipaa-healthcare': Heart,
  'fintech-financial-services': Landmark,
  'e-commerce-consumer-protection': ShoppingCart,
  'legal-services': Scale,
  'relaxed-creative': Palette,
}

interface PolicyTemplateSelectorProps {
  currentTemplateId?: string | null
  onTemplateApplied?: () => void
}

export function PolicyTemplateSelector({ currentTemplateId, onTemplateApplied }: PolicyTemplateSelectorProps) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<PolicyTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/policies/templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const applyTemplate = async (templateId: string) => {
    setApplying(templateId)
    try {
      const response = await fetch('/api/policies/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      })

      if (response.ok) {
        toast({
          title: 'Policy Applied',
          description: `The ${templates.find(t => t.id === templateId)?.name} policy is now active.`,
        })
        onTemplateApplied?.()
      } else {
        const error = await response.json()
        toast({
          title: 'Failed to apply policy',
          description: error.error || 'Unknown error',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Failed to apply template:', error)
      toast({
        title: 'Error',
        description: 'Failed to apply policy template',
        variant: 'destructive',
      })
    } finally {
      setApplying(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {templates.map((template) => {
        const Icon = templateIcons[template.id] || Shield
        const isActive = currentTemplateId === template.id

        return (
          <Card
            key={template.id}
            className={cn(
              'transition-all cursor-pointer hover:border-primary/50',
              isActive && 'border-primary ring-2 ring-primary/20'
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {isActive && (
                      <Badge variant="secondary" className="mt-1">
                        <Check className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                {template.description}
              </CardDescription>
              {!isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => applyTemplate(template.id)}
                  disabled={applying === template.id}
                >
                  {applying === template.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    'Apply Template'
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
