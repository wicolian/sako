'use client'

/**
 * Rate Limit Modal - Shown when user exhausts free validations
 * 
 * Prompts user to sign up for unlimited access.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle, Sparkles, Zap } from 'lucide-react'

interface RateLimitModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RateLimitModal({ open, onOpenChange }: RateLimitModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 ">
            <AlertCircle className="h-6 w-6 text-amber-500" />
          </div>
          <DialogTitle className="text-center">
            You've reached your daily limit
          </DialogTitle>
          <DialogDescription className="text-center">
            You've used all 10 free validations for today.
            Sign up for unlimited access and more features.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/20">
                <Zap className="h-3 w-3 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Unlimited validations</p>
                <p className="text-xs text-muted-foreground">No daily limits, validate as much as you need</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/20">
                <Sparkles className="h-3 w-3 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Generate full launch kits</p>
                <p className="text-xs text-muted-foreground">Landing pages, ads, emails, social posts</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 ">
                <svg className="h-3 w-3 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Save and share reports</p>
                <p className="text-xs text-muted-foreground">Create shareable compliance reports</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <a href="/signup?source=gate_ratelimit">
              Get Started Free
            </a>
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
        </div>
        
        <p className="text-center text-xs text-muted-foreground">
          Your limit resets in 24 hours
        </p>
      </DialogContent>
    </Dialog>
  )
}
