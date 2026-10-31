'use client'

/**
 * Compliance Gate - Public validation page
 * 
 * Paste any marketing copy, select industry, get compliance analysis.
 * No signup required. This is the acquisition wedge.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ValidatorInput } from '@/components/gate/validator-input'
import { ResultsDisplay, type ValidationResults } from '@/components/gate/results-display'
import { RateLimitModal } from '@/components/gate/rate-limit-modal'
import { storeGateCopy } from '@/lib/gate/copy-transfer'
import { toast } from 'sonner'
import { Shield, Zap, Sparkles } from 'lucide-react'

export default function GatePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<ValidationResults | null>(null)
  const [originalText, setOriginalText] = useState('')
  const [industry, setIndustry] = useState('')
  const [remainingValidations, setRemainingValidations] = useState<number | undefined>(undefined)
  const [showRateLimitModal, setShowRateLimitModal] = useState(false)
  
  const handleValidate = async (text: string, selectedIndustry: string) => {
    setIsLoading(true)
    setOriginalText(text)
    setIndustry(selectedIndustry)
    
    try {
      const response = await fetch('/api/gate/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          industry: selectedIndustry,
        }),
      })
      
      const data = await response.json()
      
      if (!data.success) {
        if (data.error?.code === 'RATE_LIMIT_EXCEEDED') {
          setShowRateLimitModal(true)
        } else {
          toast.error(data.error?.message || 'Validation failed')
        }
        return
      }
      
      // Update remaining validations from response
      if (data.rateLimit) {
        setRemainingValidations(data.rateLimit.remaining)
      }
      
      setResults(data)
      
      // Track event
      if (typeof window !== 'undefined' && (window as any).posthog) {
        (window as any).posthog.capture('validation_completed', {
          industry: selectedIndustry,
          claims_count: data.summary.total,
          score: 100 - data.summary.averageRiskScore,
          duration_ms: data.meta.processingTimeMs,
        })
      }
      
    } catch (error) {
      console.error('Validation error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleGeneratePage = () => {
    // Store results for the kit wizard using the transfer utility
    storeGateCopy(originalText, industry, results)
    
    // Redirect to signup with source tracking
    router.push('/signup?source=gate&action=generate')
  }
  
  const handleShare = async () => {
    // For now, copy a shareable link (will implement proper sharing later)
    const shareUrl = `${window.location.origin}/gate`
    await navigator.clipboard.writeText(shareUrl)
    toast.success('Link copied! Shareable reports coming soon.')
  }
  
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="container max-w-4xl py-12 md:py-20 px-4 relative z-10">
        {/* Rate Limit Modal */}
        <RateLimitModal 
          open={showRateLimitModal} 
          onOpenChange={setShowRateLimitModal}
        />
        
        {/* Hero */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12 md:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Shield className="w-4 h-4" />
            Compliance Gate
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Validate marketing claims
            <br />
            <span className="text-muted-foreground font-normal">before they go live.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Paste any copy. Spot regulatory risks instantly. Get AI-powered rewrites.
            <br className="hidden md:block" /> No signup required.
          </p>
        </motion.div>
        
        {/* Main Content */}
        <div className="space-y-12">
          {/* Input Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card/40 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl p-6 md:p-8"
          >
            <ValidatorInput
              onValidate={handleValidate}
              isLoading={isLoading}
              remainingValidations={remainingValidations}
            />
          </motion.div>
          
          {/* Results Section */}
          <AnimatePresence mode="wait">
            {results && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <ResultsDisplay
                  results={results}
                  originalText={originalText}
                  industry={industry}
                  onGeneratePage={handleGeneratePage}
                  onShare={handleShare}
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Features */}
          {!results && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid md:grid-cols-3 gap-8 mt-20"
            >
              <div className="text-center p-6 rounded-2xl border border-border/30 bg-card/20 hover:bg-card/40 transition-colors">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6 shadow-inner border border-emerald-500/20">
                  <Shield className="w-7 h-7 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold mb-3">Industry Rules</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Pre-configured compliance parameters for SaaS, Healthcare, Finance, and Legal.
                </p>
              </div>
              
              <div className="text-center p-6 rounded-2xl border border-border/30 bg-card/20 hover:bg-card/40 transition-colors">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-6 shadow-inner border border-violet-500/20">
                  <Zap className="w-7 h-7 text-violet-500" />
                </div>
                <h3 className="text-lg font-semibold mb-3">Instant Analysis</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Get results in seconds with sophisticated AI claim extraction and validation.
                </p>
              </div>
              
              <div className="text-center p-6 rounded-2xl border border-border/30 bg-card/20 hover:bg-card/40 transition-colors">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 shadow-inner border border-primary/20">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-3">Compliant Rewrites</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Get AI-suggested rewrites that maintain your conversion power while staying safe.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
