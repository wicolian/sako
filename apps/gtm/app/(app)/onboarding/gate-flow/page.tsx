'use client'

import { Suspense } from 'react'



/**
 * Gate Flow Onboarding - Streamlined 3-step flow for users from /gate
 * 
 * 1. Import your brand (URL input, auto-extract)
 * 2. Create your first kit (brief pre-filled from gate copy)
 * 3. Done! (show kit, invite team CTA)
 */

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { retrieveGateCopy, clearGateCopy, type GateCopyData } from '@/lib/gate/copy-transfer'
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Globe,
  Wand2,
  CheckCircle,
  Terminal,
  XCircle,
  Users,
} from 'lucide-react'

const steps = [
  { id: 'brand', title: 'Import Brand', icon: Globe },
  { id: 'kit', title: 'Create Kit', icon: Wand2 },
  { id: 'done', title: 'Ready!', icon: CheckCircle },
]

interface GateFlowState {
  url: string
  confirmOwnership: boolean
  importProgress: number
  importStage: string
  importResult: unknown | null
  importError: string | null
  gateCopy: GateCopyData | null
}

export function GateFlowPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const action = searchParams.get('action')
  
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [state, setState] = useState<GateFlowState>({
    url: '',
    confirmOwnership: false,
    importProgress: 0,
    importStage: '',
    importResult: null,
    importError: null,
    gateCopy: null,
  })
  
  // Load gate copy on mount
  useEffect(() => {
    const gateCopy = retrieveGateCopy()
    if (gateCopy) {
      setState(prev => ({ ...prev, gateCopy }))
    }
  }, [])
  
  const goNext = () => setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
  const goBack = () => setCurrentStep(prev => Math.max(prev - 1, 0))
  
  const handleImport = async () => {
    if (!state.url || !state.confirmOwnership) return
    
    setIsLoading(true)
    setState(prev => ({ ...prev, importError: null, importResult: null, importProgress: 0 }))
    
    try {
      const response = await fetch('/api/import/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: state.url,
          confirmOwnership: state.confirmOwnership,
        }),
      })
      
      if (!response.ok || !response.body) {
        throw new Error('Failed to start import')
      }
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        chunk.split('\n\n').filter(Boolean).forEach(line => {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.substring(6))
              if (event.event === 'progress') {
                setState(prev => ({
                  ...prev,
                  importProgress: event.progress,
                  importStage: event.stage,
                }))
              } else if (event.event === 'complete') {
                setState(prev => ({ ...prev, importResult: event.data }))
                setIsLoading(false)
                
                // Save brand
                saveBrand(event.data).then(() => {
                  goNext()
                })
              } else if (event.event === 'error') {
                setState(prev => ({ ...prev, importError: event.message }))
                setIsLoading(false)
              }
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        })
      }
    } catch (err: unknown) {
      setState(prev => ({ 
        ...prev, 
        importError: err instanceof Error ? err.message : 'Import failed' 
      }))
      setIsLoading(false)
    }
  }
  
  const saveBrand = async (importResult: unknown) => {
    try {
      await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: (importResult as { brand?: { name?: string } })?.brand?.name || 'My Brand',
          imported_from_url: state.url,
          brand_data: (importResult as { brand?: unknown })?.brand,
          design_tokens: (importResult as { designTokens?: unknown })?.designTokens,
        }),
      })
    } catch (err) {
      console.error('Failed to save brand:', err)
    }
  }
  
  const handleSkipImport = () => {
    goNext()
  }
  
  const handleCreateKit = () => {
    // Redirect to kit wizard with gate copy pre-filled
    // The kit wizard will check for gate copy in sessionStorage
    router.push('/kit/new?source=gate')
  }
  
  const handleComplete = async () => {
    // Clear gate copy data
    clearGateCopy()
    
    // Mark onboarding as complete
    try {
      await fetch('/api/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString(),
            source: 'gate',
          },
        }),
      })
    } catch (err) {
      console.error('Failed to update workspace:', err)
    }
    
    router.push('/dashboard')
  }
  
  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'brand':
        return (
          <BrandStep
            state={state}
            setState={setState}
            onImport={handleImport}
            onSkip={handleSkipImport}
            isLoading={isLoading}
          />
        )
      case 'kit':
        return (
          <KitStep
            gateCopy={state.gateCopy}
            onCreateKit={handleCreateKit}
            onSkip={goNext}
          />
        )
      case 'done':
        return (
          <DoneStep
            onComplete={handleComplete}
            isLoading={isLoading}
          />
        )
      default:
        return null
    }
  }
  
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Progress */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                  ${idx < currentStep ? 'bg-green-500/20 text-green-500' : ''}
                  ${idx === currentStep ? 'bg-primary/20 text-primary ring-2 ring-primary/50' : ''}
                  ${idx > currentStep ? 'bg-muted text-muted-foreground' : ''}
                `}>
                  {idx < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-16 sm:w-24 h-0.5 mx-2 transition-colors duration-300 ${
                    idx < currentStep ? 'bg-green-500/50' : 'bg-border'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <Progress value={(currentStep / (steps.length - 1)) * 100} className="h-1" />
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 flex items-center justify-center pt-28 pb-12 px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-xl"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// Brand Import Step
function BrandStep({
  state,
  setState,
  onImport,
  onSkip,
  isLoading,
}: {
  state: GateFlowState
  setState: (fn: (prev: GateFlowState) => GateFlowState) => void
  onImport: () => void
  onSkip: () => void
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <Terminal className="w-12 h-12 text-primary mx-auto animate-pulse" />
            <h3 className="text-xl font-semibold">{state.importStage}...</h3>
            <Progress value={state.importProgress} className="h-2 max-w-xs mx-auto" />
            <p className="text-sm text-muted-foreground">{state.importProgress}% complete</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl flex items-center justify-center gap-2">
          <Globe className="w-6 h-6 text-primary" />
          Import Your Brand
        </CardTitle>
        <CardDescription>
          Paste your website URL and we'll extract your brand for on-brand generation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="url">Website URL</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://yourcompany.com"
            value={state.url}
            onChange={(e) => setState(prev => ({ ...prev, url: e.target.value }))}
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="confirm"
            checked={state.confirmOwnership}
            onCheckedChange={(checked) => setState(prev => ({ ...prev, confirmOwnership: !!checked }))}
          />
          <Label htmlFor="confirm" className="text-sm text-muted-foreground">
            I confirm I have rights to analyze this content
          </Label>
        </div>
        
        {state.importError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
            <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{state.importError}</p>
          </div>
        )}
        
        <Button
          onClick={onImport}
          disabled={!state.url || !state.confirmOwnership}
          className="w-full"
          size="lg"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Analyze Website
        </Button>
        
        <div className="text-center space-y-2">
          <Button variant="link" onClick={onSkip} className="text-muted-foreground text-sm">
            Skip for now →
          </Button>
          {typeof process !== 'undefined' && process.env?.NODE_ENV === 'development' && (
            <SkipOnboardingButton />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SkipOnboardingButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const handleSkip = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding/bypass', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        // Full navigation so middleware runs with updated workspace membership
        window.location.href = data.redirectTo ?? '/dashboard'
      }
    } finally {
      setLoading(false)
    }
  }
  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground text-xs"
        onClick={handleSkip}
        disabled={loading}
      >
        {loading ? 'Skipping...' : 'Skip onboarding (dev only)'}
      </Button>
    </div>
  )
}

// Kit Creation Step
function KitStep({
  gateCopy,
  onCreateKit,
  onSkip,
}: {
  gateCopy: GateCopyData | null
  onCreateKit: () => void
  onSkip: () => void
}) {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl flex items-center justify-center gap-2">
          <Wand2 className="w-6 h-6 text-primary" />
          Create Your First Kit
        </CardTitle>
        <CardDescription>
          {gateCopy 
            ? "We've saved your validated copy. Let's generate a complete launch kit from it."
            : "Generate a complete launch kit with landing page, ads, emails, and social posts."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Show preview of gate copy if available */}
        {gateCopy && (
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-xs font-medium text-muted-foreground mb-2">YOUR VALIDATED COPY</p>
            <p className="text-sm line-clamp-3">{gateCopy.copy}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Compliance Score: {100 - (gateCopy.results?.summary?.averageRiskScore || 0)}
            </p>
          </div>
        )}
        
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
          <h4 className="text-sm font-medium mb-2">Your kit will include:</h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>✦ Landing page</div>
            <div>✦ 6 ad variants</div>
            <div>✦ 5 email sequence</div>
            <div>✦ 10 social posts</div>
            <div>✦ 6-slide mini deck</div>
            <div>✦ All pre-validated</div>
          </div>
        </div>
        
        <Button onClick={onCreateKit} className="w-full" size="lg">
          <Wand2 className="w-4 h-4 mr-2" />
          Create Launch Kit
        </Button>
        
        <div className="text-center">
          <Button variant="link" onClick={onSkip} className="text-muted-foreground text-sm">
            Skip for now →
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Done Step
function DoneStep({
  onComplete,
  isLoading,
}: {
  onComplete: () => void
  isLoading: boolean
}) {
  return (
    <div className="text-center space-y-8">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
        className="w-24 h-24 mx-auto bg-gradient-to-br from-green-500 to-emerald-500 rounded-3xl flex items-center justify-center shadow-lg shadow-green-500/25"
      >
        <CheckCircle className="w-12 h-12 text-white" />
      </motion.div>
      
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">You're All Set!</h1>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Your workspace is ready. Start creating compliant marketing content at scale.
        </p>
      </div>
      
      <div className="space-y-3 max-w-sm mx-auto">
        <Button onClick={onComplete} className="w-full" size="lg" disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Go to Dashboard'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        
        <Button variant="outline" className="w-full" asChild>
          <a href="/settings/team">
            <Users className="w-4 h-4 mr-2" />
            Invite Team Members
          </a>
        </Button>
      </div>
    </div>
  )
}


export default function GateFlowPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <GateFlowPage />
    </Suspense>
  )
}
