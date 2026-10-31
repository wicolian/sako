'use client'

import { Suspense } from 'react'



/**
 * Launch Kit Wizard - 5-step wizard for creating launch kits
 * 
 * Steps:
 * 1. Brief - Launch type, audience, offer, CTA
 * 2. Brand - Select/confirm brand
 * 3. Generation - Streaming progress UI
 * 4. Review - Tabbed asset review
 * 5. Export - Export options
 */

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { retrieveGateCopy, clearGateCopy, extractBriefFromGateCopy } from '@/lib/gate/copy-transfer'
import type { LaunchKitBrief, LaunchType, KitGenerationOptions, GenerationProgress, LaunchKit } from '@/lib/kit/kit-types'
import type { GenerationPlan, ReviewActionId } from '@/lib/planning/types'
import { applyReviewActionToPlan } from '@/lib/planning/plan-helpers'
import { buildReviewSignals, recommendReviewActions } from '@/lib/planning/review-signals'
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  FileText,
  Wand2,
  CheckCircle,
  Rocket,
  Users,
  Target,
  Gift,
  MousePointer,
  Building2,
  Loader2,
  AlertCircle,
  Activity,
  CheckCircle2,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GenerationPlanStep } from '@/components/planning/generation-plan-step'
import { GuidedReviewRail } from '@/components/planning/guided-review-rail'

type DesignDirection = 'auto' | 'trust' | 'product' | 'editorial' | 'technical' | 'conversion'

const DESIGN_DIRECTIONS: Array<{ value: DesignDirection; label: string; description: string }> = [
  { value: 'auto', label: 'Auto', description: 'Use brand and launch context automatically' },
  { value: 'trust', label: 'Trust & Proof', description: 'Proof-first and measured' },
  { value: 'product', label: 'Product Demo', description: 'Clear product-led presentation' },
  { value: 'editorial', label: 'Editorial', description: 'Narrative and typographic' },
  { value: 'technical', label: 'Technical', description: 'Sharp and minimal' },
  { value: 'conversion', label: 'Conversion', description: 'Direct and action-oriented' },
]

const steps = [
  { id: 'brief', title: 'Brief', icon: FileText },
  { id: 'brand', title: 'Brand', icon: Building2 },
  { id: 'plan', title: 'Plan', icon: Activity },
  { id: 'generate', title: 'Generate', icon: Wand2 },
  { id: 'review', title: 'Review', icon: CheckCircle2 },
  { id: 'export', title: 'Export', icon: Rocket },
]

const launchTypes: Array<{ value: LaunchType; label: string; description: string; icon: React.ElementType }> = [
  { value: 'product', label: 'Product Launch', description: 'Full product announcement', icon: Rocket },
  { value: 'feature', label: 'Feature Launch', description: 'New feature or update', icon: Sparkles },
  { value: 'campaign', label: 'Campaign', description: 'Marketing campaign', icon: Target },
  { value: 'event', label: 'Event', description: 'Conference or event', icon: Users },
  { value: 'webinar', label: 'Webinar', description: 'Webinar or workshop', icon: Gift },
]

interface WizardState {
  brief: Partial<LaunchKitBrief>
  selectedBrandId: string | null
  options: KitGenerationOptions
  generationProgress: GenerationProgress | null
  kit: LaunchKit | null
  campaignId: string | null
  error: string | null
}

export function KitWizardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const source = searchParams.get('source')
  
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isPlanning, setIsPlanning] = useState(false)
  const [planningError, setPlanningError] = useState<string | null>(null)
  const [state, setState] = useState<WizardState>({
    brief: {
      launchType: 'product',
      audience: '',
      offer: '',
      cta: '',
      constraints: { mustInclude: [], mustAvoid: [] },
    },
    selectedBrandId: null,
    options: {
      designDirection: 'auto',
    },
    generationProgress: null,
    kit: null,
    campaignId: null,
    error: null,
  })
  
  // Load gate copy if coming from gate
  useEffect(() => {
    if (source === 'gate') {
      const gateCopy = retrieveGateCopy()
      if (gateCopy) {
        const extracted = extractBriefFromGateCopy(gateCopy)
        setState(prev => ({
          ...prev,
          brief: {
            ...prev.brief,
            audience: extracted.audience || prev.brief.audience,
            offer: extracted.offer || prev.brief.offer,
            validatedCopy: gateCopy.copy,
            validatedClaims: extracted.claims,
          },
        }))
      }
    }
  }, [source])
  
  const goNext = () => setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
  const goBack = () => setCurrentStep(prev => Math.max(prev - 1, 0))
  
  const updateBrief = (updates: Partial<LaunchKitBrief>) => {
    setState(prev => ({
      ...prev,
      brief: { ...prev.brief, ...updates },
    }))
  }

  const buildKitPlan = async (): Promise<GenerationPlan | null> => {
    setIsPlanning(true)
    setPlanningError(null)

    try {
      const response = await fetch('/api/kit/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: {
            ...state.brief,
            brandId: state.selectedBrandId || '',
          },
          options: state.options,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error((error as { error?: string }).error || 'Failed to build plan')
      }

      const data = (await response.json()) as { plan?: GenerationPlan }
      const plan = data.plan ?? null
      if (plan) {
        setState(prev => ({
          ...prev,
          brief: { ...prev.brief, planning: plan },
        }))
      }
      return plan
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to build plan'
      setPlanningError(message)
      return null
    } finally {
      setIsPlanning(false)
    }
  }

  const handlePreparePlan = async () => {
    if (!state.brief.audience || !state.brief.offer || !state.brief.cta) {
      setState(prev => ({ ...prev, error: 'Please fill in all required fields' }))
      return
    }

    const plan = await buildKitPlan()
    if (plan) {
      setCurrentStep(steps.findIndex((step) => step.id === 'plan'))
    }
  }
  
  const handleGenerate = async (overrides?: { plan?: GenerationPlan }) => {
    if (!state.brief.audience || !state.brief.offer || !state.brief.cta) {
      setState(prev => ({ ...prev, error: 'Please fill in all required fields' }))
      return
    }

    const reviewedPlan = overrides?.plan ?? state.brief.planning ?? (await buildKitPlan())
    if (!reviewedPlan) {
      return
    }

    setIsLoading(true)
    setState(prev => ({ ...prev, error: null, generationProgress: null }))
    setCurrentStep(steps.findIndex((step) => step.id === 'generate'))

    try {
      const response = await fetch('/api/kit/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: {
            ...state.brief,
            brandId: state.selectedBrandId || '',
            planning: reviewedPlan,
          } as LaunchKitBrief,
          options: {
            ...state.options,
            plan: reviewedPlan,
          },
        }),
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        const message = (errBody as { error?: string })?.error ?? `Generation failed (${response.status})`
        setState(prev => ({ ...prev, error: message }))
        setIsLoading(false)
        return
      }

      if (!response.body) {
        setState(prev => ({ ...prev, error: 'No response stream' }))
        setIsLoading(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const messages = buffer.split('\n\n')
        buffer = messages.pop() ?? ''

        for (const line of messages) {
          if (!line.startsWith('event: ')) continue
          const eventEnd = line.indexOf('\n')
          const eventType = line.substring(7, eventEnd)
          const dataLine = line.substring(eventEnd + 1)

          if (!dataLine.startsWith('data: ')) continue
          try {
            const data = JSON.parse(dataLine.substring(6)) as {
              message?: string
              kit?: LaunchKit
              campaignId?: string
            }

            if (eventType === 'progress') {
              setState(prev => ({ ...prev, generationProgress: data as GenerationProgress }))
            } else if (eventType === 'complete') {
              setState(prev => ({
                ...prev,
                kit: data.kit ?? null,
                campaignId: data.campaignId ?? null,
              }))
              setIsLoading(false)

              if (source === 'gate') {
                clearGateCopy()
              }

              if (data.campaignId) {
                router.push(`/campaigns/${data.campaignId}`)
              } else {
                setState(prev => ({ ...prev, error: 'Campaign created but no destination was returned.' }))
              }
            } else if (eventType === 'error') {
              setState(prev => ({ ...prev, error: data.message ?? 'Generation failed' }))
              setIsLoading(false)
            }
          } catch (e) {
            console.error('Parse error:', e)
          }
        }
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Generation failed',
      }))
      setIsLoading(false)
    }
  }

  const handlePlanChange = (plan: GenerationPlan) => {
    setState(prev => ({
      ...prev,
      brief: { ...prev.brief, planning: plan },
    }))
  }

  const handleRefine = async (action: ReviewActionId) => {
    if (!state.brief.planning) {
      return
    }

    const nextPlan = applyReviewActionToPlan(state.brief.planning, action)
    handlePlanChange(nextPlan)
    await handleGenerate({ plan: nextPlan })
  }
  
  const handleExport = (format: string) => {
    router.push(`/kit/${state.kit?.id}?export=${format}`)
  }
  
  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'brief':
        return (
          <BriefStep
            brief={state.brief}
            options={state.options}
            updateBrief={updateBrief}
            updateOptions={(updates) =>
              setState(prev => ({ ...prev, options: { ...prev.options, ...updates } }))
            }
            onNext={goNext}
            hasGateCopy={!!state.brief.validatedCopy}
          />
        )
      case 'brand':
        return (
          <BrandStep
            selectedBrandId={state.selectedBrandId}
            onSelect={(id) => setState(prev => ({ ...prev, selectedBrandId: id }))}
            onNext={handlePreparePlan}
            onBack={goBack}
            isLoading={isLoading || isPlanning}
          />
        )
      case 'plan':
        return (
          <PlanStep
            plan={state.brief.planning ?? null}
            error={planningError}
            isPlanning={isPlanning}
            onBack={goBack}
            onRefresh={buildKitPlan}
            onPlanChange={handlePlanChange}
            onNext={() => void handleGenerate()}
          />
        )
      case 'generate':
        return (
          <GenerateStep
            progress={state.generationProgress}
            error={state.error}
            onRetry={() => {
              setCurrentStep(1) // Go back to brand step
              setState(prev => ({ ...prev, error: null }))
            }}
          />
        )
      case 'review':
        return (
          <ReviewStep
            kit={state.kit}
            plan={state.brief.planning ?? null}
            onNext={goNext}
            onBack={() => {
              setCurrentStep(0) // Start over
              setState(prev => ({ ...prev, kit: null }))
            }}
            onRefine={(action) => void handleRefine(action)}
          />
        )
      case 'export':
        return (
          <ExportStep
            kit={state.kit}
            onExport={handleExport}
          />
        )
      default:
        return null
    }
  }
  
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Progress Header */}
      <div className="border-b border-border/50 bg-background/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-3xl py-5 px-6">
          <div className="flex items-center justify-between mb-4 relative z-10">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex flex-col items-center gap-2 relative">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 relative z-10",
                  idx < currentStep ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "",
                  idx === currentStep ? "bg-primary/20 text-primary ring-4 ring-primary/20 border border-primary/30 shadow-[0_0_15px_rgba(132,204,22,0.3)]" : "",
                  idx > currentStep ? "bg-muted/50 text-muted-foreground border border-border/50" : ""
                )}>
                  {idx < currentStep ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider hidden sm:block absolute -bottom-6 w-max text-center transition-colors",
                  idx <= currentStep ? "text-foreground" : "text-muted-foreground"
                )}>
                  {step.title}
                </span>
              </div>
            ))}
            {/* Connecting lines */}
            <div className="absolute top-5 left-[5%] right-[5%] h-0.5 bg-border/50 -z-0">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="container max-w-2xl py-12 px-4 flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ============================================================================
// Step Components
// ============================================================================

function BriefStep({
  brief,
  options,
  updateBrief,
  updateOptions,
  onNext,
  hasGateCopy,
}: {
  brief: Partial<LaunchKitBrief>
  options: KitGenerationOptions
  updateBrief: (updates: Partial<LaunchKitBrief>) => void
  updateOptions: (updates: Partial<KitGenerationOptions>) => void
  onNext: () => void
  hasGateCopy: boolean
}) {
  return (
    <Card className="bg-card/40 backdrop-blur-xl border-border/60 shadow-2xl overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      <CardHeader className="pb-4 relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Launch Brief</CardTitle>
            <CardDescription className="text-base mt-1">
              {hasGateCopy 
                ? "We've pre-filled some fields from your validated copy."
                : "Tell us about your launch and we'll generate a complete kit."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8 relative z-10">
        {/* Launch Type */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Launch Type</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {launchTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => updateBrief({ launchType: type.value })}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all group flex flex-col gap-2",
                  brief.launchType === type.value
                    ? "border-primary bg-primary/10 ring-1 ring-primary/50 shadow-sm"
                    : "border-border/50 bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
                )}
              >
                <div className={cn("p-2 rounded-lg w-fit", brief.launchType === type.value ? "bg-primary text-primary-foreground" : "bg-background border border-border/50 text-muted-foreground group-hover:text-primary")}>
                  <type.icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{type.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{type.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        
        <div className="space-y-5">
          {/* Audience */}
          <div className="space-y-2 relative group">
            <Label htmlFor="audience" className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              Target Audience
            </Label>
            <Input
              id="audience"
              placeholder="e.g., SaaS founders with 10-50 employees"
              value={brief.audience || ''}
              onChange={(e) => updateBrief({ audience: e.target.value })}
              className="h-12 bg-muted/30 border-border/50 focus-visible:ring-primary/30"
            />
          </div>
          
          {/* Offer */}
          <div className="space-y-2 relative group">
            <Label htmlFor="offer" className="text-sm font-medium flex items-center gap-2">
              <Gift className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              Main Offer / Value Proposition
            </Label>
            <Textarea
              id="offer"
              placeholder="e.g., Ship your landing page 10x faster with AI-powered generation"
              value={brief.offer || ''}
              onChange={(e) => updateBrief({ offer: e.target.value })}
              rows={4}
              className="bg-muted/30 border-border/50 resize-none focus-visible:ring-primary/30"
            />
          </div>
          
          {/* CTA */}
          <div className="space-y-2 relative group">
            <Label htmlFor="cta" className="text-sm font-medium flex items-center gap-2">
              <MousePointer className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              Primary Call-to-Action
            </Label>
            <Input
              id="cta"
              placeholder="e.g., Start Free Trial"
              value={brief.cta || ''}
              onChange={(e) => updateBrief({ cta: e.target.value })}
              className="h-12 bg-muted/30 border-border/50 focus-visible:ring-primary/30"
            />
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" />
              <div>
                <Label className="text-sm font-medium">Design Direction</Label>
                <p className="text-xs text-muted-foreground mt-1">Auto is recommended unless you need a stronger bias.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DESIGN_DIRECTIONS.map((direction) => {
                const active = (options.designDirection ?? 'auto') === direction.value
                return (
                  <button
                    key={direction.value}
                    type="button"
                    onClick={() => updateOptions({ designDirection: direction.value })}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left transition-colors',
                      active
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border/50 bg-background hover:border-primary/40',
                    )}
                  >
                    <div className="text-sm font-medium">{direction.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{direction.description}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        
        {hasGateCopy && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-500">Copy pre-validated</p>
              <p className="text-xs text-emerald-600/80 mt-1">Your content passed compliance checks via the Gate.</p>
            </div>
          </div>
        )}
        
        <div className="pt-4">
          <Button 
            size="lg"
            onClick={onNext} 
            className="w-full h-12 text-base shadow-xl shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 transition-all group"
            disabled={!brief.audience || !brief.offer || !brief.cta}
          >
            Continue <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function BrandStep({
  selectedBrandId,
  onSelect,
  onNext,
  onBack,
  isLoading,
}: {
  selectedBrandId: string | null
  onSelect: (id: string | null) => void
  onNext: () => void
  onBack: () => void
  isLoading: boolean
}) {
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetch('/api/brands')
      .then(res => res.json())
      .then(data => {
        setBrands(data.brands || [])
        // Auto-select first brand if only one
        if (data.brands?.length === 1) {
          onSelect(data.brands[0].id)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [onSelect])
  
  return (
    <Card className="bg-card/40 backdrop-blur-xl border-border/60 shadow-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Select Brand</CardTitle>
            <CardDescription className="text-base mt-1">
              Choose a brand identity to apply consistent voice and design tokens.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            Loading brand profiles...
          </div>
        ) : brands.length === 0 ? (
          <div className="py-12 text-center space-y-6">
            <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-border/50">
              <Building2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="max-w-xs mx-auto">
              <h3 className="text-lg font-semibold mb-2">No brands available</h3>
              <p className="text-sm text-muted-foreground mb-6">Generate your kit with a neutral fallback style, or import a brand first to get personalized assets.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={onNext} disabled={isLoading} size="lg" className="h-12 px-6">
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Wand2 className="w-4 h-4 mr-2" /> Use neutral fallback</>
                )}
              </Button>
              <Button variant="outline" asChild size="lg" className="h-12 px-6">
                <a href="/import">Import a Brand</a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {brands.map((brand) => (
              <button
                key={brand.id}
                onClick={() => onSelect(brand.id)}
                className={cn(
                  "w-full p-5 rounded-xl border text-left transition-all flex items-center justify-between group",
                  selectedBrandId === brand.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary/50 shadow-sm"
                    : "border-border/50 bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center transition-colors", selectedBrandId === brand.id ? "bg-primary text-primary-foreground" : "bg-background border border-border/50 text-muted-foreground group-hover:text-primary")}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="font-semibold text-base">{brand.name}</div>
                </div>
                {selectedBrandId === brand.id && (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
        
        {brands.length > 0 && (
          <div className="flex gap-3 pt-6 border-t border-border/50">
            <Button variant="ghost" size="lg" onClick={onBack} className="flex-1 h-12">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button 
              size="lg" 
              onClick={onNext} 
              className="flex-1 h-12 shadow-xl shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 transition-all group" 
              disabled={isLoading || !selectedBrandId}
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
              ) : (
                <>Generate Kit <Sparkles className="w-5 h-5 ml-2 group-hover:rotate-12 transition-transform" /></>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PlanStep({
  plan,
  error,
  isPlanning,
  onBack,
  onRefresh,
  onPlanChange,
  onNext,
}: {
  plan: GenerationPlan | null
  error: string | null
  isPlanning: boolean
  onBack: () => void
  onRefresh: () => Promise<GenerationPlan | null>
  onPlanChange: (plan: GenerationPlan) => void
  onNext: () => void
}) {
  return (
    <div className="space-y-6">
      <GenerationPlanStep
        plan={plan}
        loading={isPlanning}
        error={error}
        onRefresh={() => void onRefresh()}
        onPlanChange={onPlanChange}
      />

      <div className="flex gap-3">
        <Button variant="ghost" size="lg" onClick={onBack} className="flex-1 h-12">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button
          size="lg"
          onClick={onNext}
          className="flex-1 h-12 shadow-xl shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!plan || isPlanning}
        >
          Generate kit <Sparkles className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  )
}

function GenerateStep({
  progress,
  error,
  onRetry,
}: {
  progress: GenerationProgress | null
  error: string | null
  onRetry: () => void
}) {
  if (error) {
    return (
      <Card className="bg-card/40 backdrop-blur-xl border-destructive/20 shadow-2xl">
        <CardContent className="py-16 text-center">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
          <h3 className="text-2xl font-bold mb-3">Generation Failed</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-8">{error}</p>
          <Button onClick={onRetry} size="lg" className="h-12 px-8">Try Again</Button>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="bg-card/40 backdrop-blur-xl border-border/60 shadow-2xl overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none opacity-50" />
      <CardContent className="py-16 px-8 relative z-10">
        <div className="text-center space-y-6 mb-12">
          <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto shadow-[0_0_40px_-10px_rgba(132,204,22,0.5)] border border-primary/20">
            <Wand2 className="w-12 h-12 text-primary animate-pulse" />
          </div>
          <div>
            <h3 className="text-2xl font-bold tracking-tight mb-2">
              {progress?.message || 'Synthesizing your launch kit...'}
            </h3>
            <p className="text-muted-foreground">
              Grounding AI in brand voice and checking compliance in real-time.
            </p>
          </div>
          
          <div className="max-w-sm mx-auto relative pt-4">
            <Progress value={progress?.progress || 0} className="h-2 w-full bg-muted/50" />
            <div className="absolute top-8 left-0 right-0 text-center">
              <span className="text-xs font-mono font-bold text-primary tracking-widest">{progress?.progress || 0}% COMPLETE</span>
            </div>
          </div>
        </div>
        
        {/* Progress stages */}
        <div className="max-w-sm mx-auto space-y-4 bg-background/50 backdrop-blur rounded-2xl p-6 border border-border/50">
          {['angles', 'landing_page', 'ads', 'emails', 'social', 'deck', 'validation'].map((stage) => {
            const stageIndex = ['angles', 'landing_page', 'ads', 'emails', 'social', 'deck', 'validation'].indexOf(stage)
            const currentIndex = progress?.step ? ['angles', 'landing_page', 'ads', 'emails', 'social', 'deck', 'validation', 'complete'].indexOf(progress.step) : -1
            const isDone = currentIndex > stageIndex
            const isCurrent = progress?.step === stage
            
            return (
              <div key={stage} className={cn(
                "flex items-center gap-3 text-sm font-medium transition-colors",
                isDone ? "text-emerald-500" : isCurrent ? "text-primary" : "text-muted-foreground/50"
              )}>
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-current" />
                )}
                <span className="capitalize tracking-wide">{stage.replace('_', ' ')}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function ReviewStep({
  kit,
  plan,
  onNext,
  onBack,
  onRefine,
}: {
  kit: LaunchKit | null
  plan: GenerationPlan | null
  onNext: () => void
  onBack: () => void
  onRefine: (action: ReviewActionId) => void
}) {
  if (!kit) {
    return (
      <Card className="bg-card/40 backdrop-blur-xl border-border/60 shadow-2xl">
        <CardContent className="py-16 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-6">No kit generated</p>
          <Button onClick={onBack} size="lg">Start Over</Button>
        </CardContent>
      </Card>
    )
  }

  const reviewSignals = plan && kit.assets.landingPage
    ? buildReviewSignals('landing-page', kit.assets.landingPage.html, plan)
    : []
  const reviewActions = recommendReviewActions(reviewSignals)
  
  return (
    <Card className="bg-card/40 backdrop-blur-xl border-border/60 shadow-2xl overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-emerald-400 to-primary" />
      <CardHeader className="pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Campaign Generated</CardTitle>
            <CardDescription className="text-base mt-1">
              Your launch assets are ready and compliant.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-xl bg-muted/20 border border-border/50">
            <div className="text-3xl font-bold text-foreground mb-1">{kit.assets.ads.length}</div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ad Variants</div>
          </div>
          <div className="text-center p-4 rounded-xl bg-muted/20 border border-border/50">
            <div className="text-3xl font-bold text-foreground mb-1">{kit.assets.emails?.emails.length || 0}</div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Emails</div>
          </div>
          <div className="text-center p-4 rounded-xl bg-muted/20 border border-border/50">
            <div className="text-3xl font-bold text-foreground mb-1">{kit.assets.socialPosts.length}</div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Social Posts</div>
          </div>
        </div>
        
        {/* Compliance Summary */}
        <div className="p-5 rounded-xl bg-muted/20 border border-border/50">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Compliance Scan
          </h4>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">
              {kit.compliance.approved} claims verified
            </Badge>
            {kit.compliance.needsReview > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1">
                {kit.compliance.needsReview} require review
              </Badge>
            )}
            {kit.compliance.blocked > 0 && (
              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 px-3 py-1">
                {kit.compliance.blocked} blocked terms
              </Badge>
            )}
          </div>
        </div>

        {reviewSignals.length > 0 ? (
          <GuidedReviewRail
            signals={reviewSignals}
            actions={reviewActions}
            onAction={onRefine}
          />
        ) : null}
        
        <div className="flex gap-4 pt-4 border-t border-border/50">
          <Button variant="ghost" size="lg" onClick={onBack} className="flex-1 h-12">
            Discard
          </Button>
          <Button size="lg" onClick={onNext} className="flex-1 h-12 shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90">
            Finalize & Export <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ExportStep({
  kit,
  onExport,
}: {
  kit: LaunchKit | null
  onExport: (format: string) => void
}) {
  const exportOptions = [
    { id: 'zip', label: 'Download ZIP', description: 'All raw assets and markdown', icon: '📦' },
    { id: 'figma', label: 'Export to Figma', description: 'Create editable Figma designs', icon: '🎨' },
    { id: 'subdomain', label: 'Publish to Sako', description: 'Deploy landing page instantly', icon: '🌐' },
  ]
  
  return (
    <Card className="bg-card/40 backdrop-blur-xl border-border/60 shadow-2xl">
      <CardHeader className="pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Rocket className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Export Kit</CardTitle>
            <CardDescription className="text-base mt-1">
              Choose your deployment method for this campaign.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3">
          {exportOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => onExport(option.id)}
              className="w-full p-5 rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/30 hover:border-primary/50 text-left transition-all flex items-center gap-5 group"
            >
              <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center text-2xl shadow-sm border border-border/50">
                {option.icon}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-base group-hover:text-primary transition-colors">{option.label}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{option.description}</div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>
        
        <div className="pt-6 border-t border-border/50">
          <Button variant="outline" size="lg" className="w-full h-12" asChild>
            <a href={`/campaigns/${kit?.campaignId}`}>Go to Campaign Dashboard</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SuspenseWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <KitWizardPage />
    </Suspense>
  )
}
