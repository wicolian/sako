'use client'

import { Suspense } from 'react'



import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { signUpWithEmail } from '@/lib/supabase/auth'
import { motion } from 'framer-motion'

export function SignUpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Track source for analytics and redirect
  const source = searchParams.get('source')
  const action = searchParams.get('action')
  const isFromGate = source === 'gate' || source === 'gate_ratelimit'
  
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      const { data, error: authError } = await signUpWithEmail(email, password, {
        full_name: fullName,
      })
      
      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        setSuccess(true)
      } else {
        // Determine redirect based on source
        let redirectUrl = '/onboarding'
        
        if (isFromGate && action === 'generate') {
          // User came from gate wanting to generate a page
          // Redirect to gate-specific onboarding flow
          redirectUrl = '/onboarding?source=gate&action=generate'
        } else if (isFromGate) {
          redirectUrl = '/onboarding?source=gate'
        }
        
        // Track signup source
        if (typeof window !== 'undefined' && (window as any).posthog) {
          (window as any).posthog.capture('user_signed_up', {
            source: source || 'direct',
            action: action || null,
          })
        }
        
        router.push(redirectUrl)
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground relative overflow-hidden p-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md relative z-10"
        >
          <Card className="border-emerald-500/20 bg-card/40 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/50 to-emerald-500" />
            <CardContent className="pt-12 pb-10 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 mb-6 shadow-inner border border-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight mb-3">Check your email</h2>
              <p className="text-muted-foreground mb-8 text-base">
                We've sent a confirmation link to <br/>
                <strong className="text-foreground">{email}</strong>. 
              </p>
              <Button asChild variant="outline" className="w-full h-12 text-base rounded-xl bg-background/50 backdrop-blur">
                <Link href="/login">Return to login</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground relative overflow-hidden p-6">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-[400px] relative z-10 space-y-8">
        {/* Logo */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Link href="/" className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-primary/10 mb-5 border border-primary/20 shadow-[0_0_40px_-10px_rgba(132,204,22,0.5)]">
            <Sparkles className="w-8 h-8 text-primary" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Sako Composer</h1>
          <p className="text-muted-foreground mt-2 font-medium">Ship high-converting campaigns instantly</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/50 to-primary" />
            <CardHeader className="space-y-2 pb-4 pt-8 text-center">
              <CardTitle className="text-2xl font-bold">Create workspace</CardTitle>
              <CardDescription className="text-sm">
                {isFromGate && action === 'generate'
                  ? 'Sign up to export your landing page'
                  : 'Start your 14-day free trial'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-medium">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-2.5">
                  <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Jane Smith"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-11 h-12 bg-muted/30 border-border/50 focus-visible:ring-primary/50 text-base"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="email" className="text-sm font-medium">Work Email</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-11 h-12 bg-muted/30 border-border/50 focus-visible:ring-primary/50 text-base"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 h-12 bg-muted/30 border-border/50 focus-visible:ring-primary/50 text-base"
                      minLength={6}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 text-base font-semibold shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all mt-2" disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-8 text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <Link href="/login" className="text-primary hover:underline font-semibold">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <p className="text-center text-xs text-muted-foreground">
          By signing up, you agree to our{' '}
          <Link href="/terms" className="hover:text-primary underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="hover:text-primary underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

export default function SuspenseWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignUpPage />
    </Suspense>
  )
}
