"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, Layout, Share2, Mail, Megaphone, CheckCircle2, ShieldAlert, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export interface StreamingAssetRevealProps {
  campaignId: string
  assets: {
    type: 'landing-page' | 'social' | 'email' | 'ad'
    status: 'pending' | 'generating' | 'completed'
    data?: any
  }[]
  compliance?: {
    grade: string
    claimsUsed: number
    newClaims: number
    slopViolations: number
  }
  isComplete: boolean
}

const ASSET_CONFIG = {
  'landing-page': { icon: Layout, label: 'Landing Page' },
  'social': { icon: Share2, label: 'Social Posts' },
  'email': { icon: Mail, label: 'Email Sequence' },
  'ad': { icon: Megaphone, label: 'Ad Copy' },
}

export function StreamingAssetReveal({
  campaignId,
  assets,
  compliance,
  isComplete
}: StreamingAssetRevealProps) {
  const router = useRouter()
  const [showRedirect, setShowRedirect] = React.useState(false)

  React.useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => {
        setShowRedirect(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isComplete])

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="max-w-3xl w-full mx-auto space-y-12 py-12">
        
        {/* Header / Pipeline Progress */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            {!isComplete ? (
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            )}
            <h2 className="text-2xl font-bold">
              {isComplete ? "Campaign Generated" : "Crafting your campaign..."}
            </h2>
          </div>
          <div className="h-1 w-48 bg-muted rounded-full mx-auto overflow-hidden">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: isComplete ? "100%" : "60%" }}
              transition={{ duration: 2, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Asset Reveal Stack */}
        <div className="space-y-4">
          <AnimatePresence>
            {assets.map((asset, index) => {
              if (asset.status === 'pending') return null;
              
              const config = ASSET_CONFIG[asset.type]
              const Icon = config.icon

              return (
                <motion.div
                  key={asset.type}
                  initial={{ opacity: 0, y: 40, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: index * 0.2 }}
                  className="bg-card border border-border/50 rounded-xl p-6 flex items-center justify-between shadow-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl flex items-center justify-center ${asset.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{config.label}</h3>
                      <p className="text-sm text-muted-foreground">
                        {asset.status === 'completed' ? 'Generation complete' : 'Synthesizing content...'}
                      </p>
                    </div>
                  </div>
                  
                  {asset.status === 'completed' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Compliance Overlay (appears last) */}
        <AnimatePresence>
          {isComplete && compliance && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={`p-6 rounded-xl border ${['A','B'].includes(compliance.grade) ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'} flex flex-col sm:flex-row items-center justify-between gap-6`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold ${['A','B'].includes(compliance.grade) ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>
                  {compliance.grade}
                </div>
                <div>
                  <h4 className="font-semibold">Compliance Review</h4>
                  <p className="text-sm text-muted-foreground">
                    {compliance.claimsUsed} claims verified. {compliance.newClaims > 0 ? `${compliance.newClaims} new claims require review.` : 'No new fabricated claims.'}
                  </p>
                </div>
              </div>
              
              {compliance.slopViolations > 0 && (
                <div className="flex items-center gap-2 text-sm text-orange-500 bg-orange-500/10 px-3 py-1.5 rounded-lg">
                  <ShieldAlert className="w-4 h-4" />
                  {compliance.slopViolations} slop flags
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Redirect Action */}
        <AnimatePresence>
          {showRedirect && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center pt-8"
            >
              <Button 
                size="lg" 
                className="h-14 px-8 text-lg shadow-xl shadow-primary/20"
                onClick={() => router.push(`/campaigns/${campaignId}`)}
              >
                View full campaign <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
