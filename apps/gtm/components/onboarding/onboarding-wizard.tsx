'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Building2, 
  Puzzle, 
  Shield, 
  PartyPopper,
  Check,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  type OnboardingStep,
  type OnboardingState,
  INDUSTRIES,
  COMPANY_SIZES,
  PRIMARY_GOALS,
  RECOMMENDED_PROVIDERS,
  POLICY_TEMPLATES,
} from '@/lib/onboarding/types'

const STEPS: { id: OnboardingStep; title: string; icon: React.ReactNode }[] = [
  { id: 'welcome', title: 'Welcome', icon: <Sparkles className="h-5 w-5" /> },
  { id: 'workspace', title: 'Workspace', icon: <Building2 className="h-5 w-5" /> },
  { id: 'industry', title: 'Industry', icon: <Building2 className="h-5 w-5" /> },
  { id: 'integration', title: 'Integrations', icon: <Puzzle className="h-5 w-5" /> },
  { id: 'compliance', title: 'Compliance', icon: <Shield className="h-5 w-5" /> },
  { id: 'complete', title: 'Complete', icon: <PartyPopper className="h-5 w-5" /> },
]

interface OnboardingWizardProps {
  onComplete: () => void
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [state, setState] = useState<OnboardingState>({
    currentStep: 'welcome',
    completed: false,
    data: {},
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentStepIndex = STEPS.findIndex(s => s.id === state.currentStep)

  const goToStep = useCallback((step: OnboardingStep) => {
    setState(prev => ({ ...prev, currentStep: step }))
  }, [])

  const nextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      goToStep(STEPS[nextIndex].id)
    }
  }, [currentStepIndex, goToStep])

  const prevStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      goToStep(STEPS[prevIndex].id)
    }
  }, [currentStepIndex, goToStep])

  const updateData = useCallback((data: Partial<OnboardingState['data']>) => {
    setState(prev => ({
      ...prev,
      data: { ...prev.data, ...data },
    }))
  }, [])

  const handleComplete = async () => {
    setIsSubmitting(true)
    try {
      // Save onboarding data
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.data),
      })
      setState(prev => ({ ...prev, completed: true }))
      onComplete()
    } catch (error) {
      console.error('Failed to save onboarding:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative w-full max-w-3xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-2 text-sm transition-colors',
                  index <= currentStepIndex ? 'text-white' : 'text-white/40'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all',
                    index < currentStepIndex
                      ? 'bg-indigo-500 border-indigo-500'
                      : index === currentStepIndex
                      ? 'border-indigo-500 bg-indigo-500/20'
                      : 'border-white/20'
                  )}
                >
                  {index < currentStepIndex ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step.icon
                  )}
                </div>
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
          <div className="h-1 bg-card/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStepIndex + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={state.currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-card/40 backdrop-blur-sm/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl"
          >
            {state.currentStep === 'welcome' && (
              <WelcomeStep onNext={nextStep} />
            )}
            
            {state.currentStep === 'workspace' && (
              <WorkspaceStep
                data={state.data}
                onUpdate={updateData}
                onNext={nextStep}
                onBack={prevStep}
              />
            )}
            
            {state.currentStep === 'industry' && (
              <IndustryStep
                data={state.data}
                onUpdate={updateData}
                onNext={nextStep}
                onBack={prevStep}
              />
            )}
            
            {state.currentStep === 'integration' && (
              <IntegrationStep
                data={state.data}
                onUpdate={updateData}
                onNext={nextStep}
                onBack={prevStep}
              />
            )}
            
            {state.currentStep === 'compliance' && (
              <ComplianceStep
                data={state.data}
                onUpdate={updateData}
                onNext={nextStep}
                onBack={prevStep}
              />
            )}
            
            {state.currentStep === 'complete' && (
              <CompleteStep
                data={state.data}
                onComplete={handleComplete}
                isSubmitting={isSubmitting}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// Step Components

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center"
      >
        <Sparkles className="h-10 w-10 text-white" />
      </motion.div>
      
      <h1 className="text-3xl font-bold text-white mb-4">
        Welcome to Sako Composer
      </h1>
      <p className="text-white/60 mb-8 max-w-md mx-auto">
        Your all-in-one GTM operating system. Let&apos;s set up your workspace
        to get you launching campaigns in minutes, not weeks.
      </p>
      
      <div className="grid gap-4 max-w-sm mx-auto text-left mb-8">
        <div className="flex items-center gap-3 text-white/80">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-indigo-400" />
          </div>
          <span>AI-powered campaign generation</span>
        </div>
        <div className="flex items-center gap-3 text-white/80">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Shield className="h-4 w-4 text-violet-400" />
          </div>
          <span>Real-time compliance checking</span>
        </div>
        <div className="flex items-center gap-3 text-white/80">
          <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
            <Puzzle className="h-4 w-4 text-pink-400" />
          </div>
          <span>20+ deployment integrations</span>
        </div>
      </div>
      
      <Button
        onClick={onNext}
        size="lg"
        className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600"
      >
        Get Started <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}

interface StepProps {
  data: OnboardingState['data']
  onUpdate: (data: Partial<OnboardingState['data']>) => void
  onNext: () => void
  onBack: () => void
}

function WorkspaceStep({ data, onUpdate, onNext, onBack }: StepProps) {
  const [name, setName] = useState(data.workspaceName || '')

  const handleNext = () => {
    onUpdate({ workspaceName: name })
    onNext()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">
        Name your workspace
      </h2>
      <p className="text-white/60 mb-8">
        This is usually your company or team name.
      </p>
      
      <div className="space-y-4 mb-8">
        <Label htmlFor="workspace-name" className="text-white">
          Workspace name
        </Label>
        <Input
          id="workspace-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Corp"
          className="bg-card/5 border-white/10 text-white placeholder:text-white/40"
          autoFocus
        />
      </div>
      
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="text-white/60 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!name.trim()}
          className="bg-gradient-to-r from-indigo-500 to-violet-500"
        >
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function IndustryStep({ data, onUpdate, onNext, onBack }: StepProps) {
  const [industry, setIndustry] = useState(data.industry || '')
  const [goal, setGoal] = useState(data.primaryGoal || '')

  const handleNext = () => {
    onUpdate({ industry, primaryGoal: goal })
    onNext()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">
        Tell us about your work
      </h2>
      <p className="text-white/60 mb-8">
        We&apos;ll customize your experience based on your industry and goals.
      </p>
      
      <div className="space-y-6 mb-8">
        <div>
          <Label className="text-white mb-3 block">Your industry</Label>
          <div className="grid grid-cols-2 gap-3">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind.id}
                onClick={() => setIndustry(ind.id)}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all',
                  industry === ind.id
                    ? 'border-indigo-500 bg-indigo-500/20 text-white'
                    : 'border-white/10 hover:border-white/20 text-white/60 hover:text-white'
                )}
              >
                <span className="text-xl mb-1 block">{ind.icon}</span>
                <span className="text-sm font-medium">{ind.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <Label className="text-white mb-3 block">Primary goal</Label>
          <div className="grid gap-3">
            {PRIMARY_GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all flex items-center gap-4',
                  goal === g.id
                    ? 'border-indigo-500 bg-indigo-500/20'
                    : 'border-white/10 hover:border-white/20'
                )}
              >
                <span className="text-2xl">{g.icon}</span>
                <div>
                  <div className="font-medium text-white">{g.label}</div>
                  <div className="text-sm text-white/50">{g.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="text-white/60 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!industry || !goal}
          className="bg-gradient-to-r from-indigo-500 to-violet-500"
        >
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function IntegrationStep({ data, onUpdate, onNext, onBack }: StepProps) {
  const [selected, setSelected] = useState<string[]>(data.connectedProviders || [])

  const toggleProvider = (id: string) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const handleNext = () => {
    onUpdate({ connectedProviders: selected })
    onNext()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">
        Connect your tools
      </h2>
      <p className="text-white/60 mb-8">
        Select the platforms you want to deploy campaigns to. You can add more later.
      </p>
      
      <div className="grid gap-3 mb-8">
        {RECOMMENDED_PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            onClick={() => toggleProvider(provider.id)}
            className={cn(
              'p-4 rounded-xl border text-left transition-all flex items-center justify-between',
              selected.includes(provider.id)
                ? 'border-indigo-500 bg-indigo-500/20'
                : 'border-white/10 hover:border-white/20'
            )}
          >
            <div>
              <div className="font-medium text-white flex items-center gap-2">
                {provider.name}
                {provider.popular && (
                  <span className="text-xs bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full">
                    Popular
                  </span>
                )}
              </div>
              <div className="text-sm text-white/50">{provider.category}</div>
            </div>
            <div
              className={cn(
                'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                selected.includes(provider.id)
                  ? 'border-indigo-500 bg-indigo-500'
                  : 'border-white/30'
              )}
            >
              {selected.includes(provider.id) && (
                <Check className="h-4 w-4 text-white" />
              )}
            </div>
          </button>
        ))}
      </div>
      
      <p className="text-white/40 text-sm mb-6 text-center">
        Don&apos;t see your tool? You can connect 20+ integrations from settings.
      </p>
      
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="text-white/60 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button
          onClick={handleNext}
          className="bg-gradient-to-r from-indigo-500 to-violet-500"
        >
          {selected.length > 0 ? 'Continue' : 'Skip for now'} 
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function ComplianceStep({ data, onUpdate, onNext, onBack }: StepProps) {
  const [template, setTemplate] = useState(data.policyTemplateId || 'default')

  const handleNext = () => {
    onUpdate({ policyTemplateId: template })
    onNext()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">
        Set up compliance
      </h2>
      <p className="text-white/60 mb-8">
        Choose a policy template to validate your marketing claims. 
        This helps ensure your content is accurate and trustworthy.
      </p>
      
      <div className="grid gap-3 mb-8">
        {POLICY_TEMPLATES.map((policy) => (
          <button
            key={policy.id}
            onClick={() => setTemplate(policy.id)}
            className={cn(
              'p-4 rounded-xl border text-left transition-all flex items-center justify-between',
              template === policy.id
                ? 'border-indigo-500 bg-indigo-500/20'
                : 'border-white/10 hover:border-white/20'
            )}
          >
            <div>
              <div className="font-medium text-white flex items-center gap-2">
                {policy.name}
                {policy.recommended && (
                  <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                )}
              </div>
              <div className="text-sm text-white/50">{policy.description}</div>
            </div>
            <div
              className={cn(
                'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                template === policy.id
                  ? 'border-indigo-500 bg-indigo-500'
                  : 'border-white/30'
              )}
            >
              {template === policy.id && (
                <Check className="h-4 w-4 text-white" />
              )}
            </div>
          </button>
        ))}
      </div>
      
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="text-white/60 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button
          onClick={handleNext}
          className="bg-gradient-to-r from-indigo-500 to-violet-500"
        >
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function CompleteStep({ 
  data, 
  onComplete, 
  isSubmitting 
}: { 
  data: OnboardingState['data']
  onComplete: () => void
  isSubmitting: boolean
}) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.8 }}
        className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center"
      >
        <PartyPopper className="h-10 w-10 text-white" />
      </motion.div>
      
      <h1 className="text-3xl font-bold text-white mb-4">
        You&apos;re all set! 🎉
      </h1>
      <p className="text-white/60 mb-8 max-w-md mx-auto">
        Your workspace <span className="text-white font-medium">{data.workspaceName}</span> is ready.
        Let&apos;s create your first campaign!
      </p>
      
      <div className="bg-card/5 rounded-xl p-6 mb-8 text-left max-w-sm mx-auto">
        <h3 className="text-white font-medium mb-4">Your setup:</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-white/50">Workspace</span>
            <span className="text-white">{data.workspaceName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Industry</span>
            <span className="text-white capitalize">{data.industry}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Integrations</span>
            <span className="text-white">{data.connectedProviders?.length || 0} selected</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Policy</span>
            <span className="text-white">
              {POLICY_TEMPLATES.find(p => p.id === data.policyTemplateId)?.name || 'General'}
            </span>
          </div>
        </div>
      </div>
      
      <Button
        onClick={onComplete}
        disabled={isSubmitting}
        size="lg"
        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Setting up...
          </>
        ) : (
          <>
            Launch Dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  )
}
