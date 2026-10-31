'use client'

import { useState, useEffect } from 'react'
import { CreditCard, Zap, Check, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { BudgetManager } from './budget-manager'

interface Subscription {
  plan_id: string
  status: string
  current_period_end: string | null
}

interface Usage {
  campaigns: { current: number; limit: number }
  apiCalls: { current: number; limit: number }
}

const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    features: ['1 seat', '1 brand', 'Claims review workspace', 'No direct deploys or premium exports'],
  },
  solo: {
    name: 'Solo',
    price: 99,
    features: ['1 seat', '1 brand', '30 publishes/month', 'Compliance checks', 'Asset editor + exports'],
  },
  team: {
    name: 'Team',
    price: 599,
    features: ['5 seats', '2 brands', '200 publishes/month', 'Approvals and audit trail'],
  },
  growth: {
    name: 'Growth',
    price: 1499,
    features: ['15 seats', '5 brands', '1,000 publishes/month', 'Priority support'],
  },
  enterprise: {
    name: 'Enterprise',
    price: 6000,
    features: ['Unlimited seats', 'Unlimited brands', 'Unlimited publishes', 'SSO/SAML'],
  },
}

export function BillingSection() {
  const { toast } = useToast()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    loadBillingData()
  }, [])

  const loadBillingData = async () => {
    try {
      const [subRes, usageRes] = await Promise.all([
        fetch('/api/billing/subscription'),
        fetch('/api/billing/usage'),
      ])

      if (subRes.ok) {
        const subData = await subRes.json()
        const resolvedSubscription = (
          subData && typeof subData === 'object' && 'subscription' in subData
            ? subData.subscription
            : subData
        ) as Subscription | null
        setSubscription(resolvedSubscription)
      }

      if (usageRes.ok) {
        const usageData = await usageRes.json()
        setUsage(usageData)
      }
    } catch (error) {
      console.error('Failed to load billing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const startSoloPlan = async () => {
    setUpgrading(true)
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'solo' }),
      })

      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      } else {
        toast({
          title: 'Error',
          description: 'Failed to create checkout session',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Failed to upgrade:', error)
      toast({
        title: 'Error',
        description: 'Failed to start upgrade process',
        variant: 'destructive',
      })
    } finally {
      setUpgrading(false)
    }
  }

  const openPortal = async () => {
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' })
      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      }
    } catch (error) {
      console.error('Failed to open portal:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const currentPlanId = subscription?.plan_id
  const hasManagedSubscription = Boolean(currentPlanId && currentPlanId !== 'free')
  const currentPlan = currentPlanId && currentPlanId in PLANS
    ? PLANS[currentPlanId as keyof typeof PLANS]
    : PLANS.free

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>{currentPlan.name}</CardTitle>
                <CardDescription>
                  {currentPlan.price > 0 ? `$${currentPlan.price}/month` : 'Upgrade to unlock paid exports, deploys, and API access'}
                </CardDescription>
              </div>
            </div>
            {hasManagedSubscription ? (
              <Button variant="outline" onClick={openPortal}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Manage Billing
              </Button>
            ) : (
              <Button onClick={startSoloPlan} disabled={upgrading}>
                {upgrading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Start Solo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {currentPlan.features.map((feature) => (
              <Badge key={feature} variant="secondary">
                <Check className="w-3 h-3 mr-1" />
                {feature}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usage */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage This Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Campaigns</span>
                <span className="text-muted-foreground">
                  {usage.campaigns.current} / {usage.campaigns.limit === -1 ? '∞' : usage.campaigns.limit}
                </span>
              </div>
              {usage.campaigns.limit !== -1 && (
                <Progress
                  value={(usage.campaigns.current / usage.campaigns.limit) * 100}
                  className="h-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>API Calls</span>
                <span className="text-muted-foreground">
                  {usage.apiCalls.current.toLocaleString()} / {usage.apiCalls.limit === -1 ? '∞' : usage.apiCalls.limit.toLocaleString()}
                </span>
              </div>
              {usage.apiCalls.limit !== -1 && (
                <Progress
                  value={(usage.apiCalls.current / usage.apiCalls.limit) * 100}
                  className="h-2"
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget Management */}
      <BudgetManager />
    </div>
  )
}
