'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import {
  DollarSign,
  Users,
  MousePointerClick,
  TrendingUp,
  Copy,
  Check,
  ExternalLink,
  Wallet,
  ArrowUpRight,
  Gift,
  Award,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { ReferralStats } from '@/components/affiliate/referral-stats'
import { ReferralLink } from '@/components/affiliate/referral-link'
import { PayoutHistory } from '@/components/affiliate/payout-history'

interface AffiliateData {
  id: string
  referral_code: string
  total_earnings: number
  pending_earnings: number
  paid_earnings: number
  total_clicks: number
  total_signups: number
  total_conversions: number
  conversion_rate: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  commission_rate: number
}

interface Referral {
  id: string
  email: string
  status: 'signed_up' | 'converted' | 'churned'
  plan?: string
  earned: number
  created_at: string
}

interface Payout {
  id: string
  amount: number
  status: 'pending' | 'processing' | 'paid' | 'failed'
  method: string
  created_at: string
  paid_at?: string
}

const TIER_INFO = {
  bronze: { label: 'Bronze', color: 'bg-amber-700', minEarnings: 0, commission: 20 },
  silver: { label: 'Silver', color: 'bg-muted', minEarnings: 500, commission: 25 },
  gold: { label: 'Gold', color: 'bg-yellow-500', minEarnings: 2000, commission: 30 },
  platinum: { label: 'Platinum', color: 'bg-purple-500', minEarnings: 10000, commission: 35 },
}

export default function AffiliatePage() {
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAffiliateData()
  }, [])

  const loadAffiliateData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    // Get affiliate account
    const { data: affiliateData } = await supabase
      .from('affiliates')
      .select('*')
      .eq('user_id', user.id)
      .single() as { data: Record<string, unknown> | null }

    if (affiliateData) {
      setAffiliate({
        id: affiliateData.id as string,
        referral_code: affiliateData.referral_code as string,
        total_earnings: (affiliateData.total_earnings as number) || 0,
        pending_earnings: (affiliateData.pending_earnings as number) || 0,
        paid_earnings: (affiliateData.paid_earnings as number) || 0,
        total_clicks: (affiliateData.total_clicks as number) || 0,
        total_signups: (affiliateData.total_signups as number) || 0,
        total_conversions: (affiliateData.total_conversions as number) || 0,
        conversion_rate: (affiliateData.total_clicks as number) > 0 
          ? ((affiliateData.total_conversions as number) / (affiliateData.total_clicks as number)) * 100 
          : 0,
        tier: (affiliateData.tier as AffiliateData['tier']) || 'bronze',
        commission_rate: TIER_INFO[(affiliateData.tier as keyof typeof TIER_INFO) || 'bronze']?.commission || 20,
      })

      // Get referrals
      const { data: referralsData } = await supabase
        .from('referrals')
        .select('*')
        .eq('affiliate_id', affiliateData.id as string)
        .order('created_at', { ascending: false })
        .limit(10) as { data: Referral[] | null }

      if (referralsData) {
        setReferrals(referralsData)
      }

      // Get payouts
      const { data: payoutsData } = await supabase
        .from('affiliate_payouts')
        .select('*')
        .eq('affiliate_id', affiliateData.id as string)
        .order('created_at', { ascending: false })
        .limit(10) as { data: Payout[] | null }

      if (payoutsData) {
        setPayouts(payoutsData)
      }
    }

    setLoading(false)
  }

  const requestPayout = async () => {
    if (!affiliate || affiliate.pending_earnings < 50) {
      toast.error('Minimum payout is $50')
      return
    }

    const response = await fetch('/api/affiliate/payout', {
      method: 'POST',
    })

    if (response.ok) {
      toast.success('Payout requested!')
      loadAffiliateData()
    } else {
      toast.error('Failed to request payout')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!affiliate) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
            <Gift className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Join Our Affiliate Program</h2>
          <p className="text-muted-foreground mb-6">
            Earn 20-35% commission on every referral. Share your link and start earning today.
          </p>
          <Button size="lg">
            <Award className="h-5 w-5 mr-2" />
            Become an Affiliate
          </Button>
        </motion.div>
      </div>
    )
  }

  const tierInfo = TIER_INFO[affiliate.tier]
  const nextTier = affiliate.tier === 'bronze' ? 'silver' 
    : affiliate.tier === 'silver' ? 'gold' 
    : affiliate.tier === 'gold' ? 'platinum' 
    : null
  const nextTierInfo = nextTier ? TIER_INFO[nextTier] : null
  const progressToNextTier = nextTierInfo 
    ? (affiliate.total_earnings / nextTierInfo.minEarnings) * 100 
    : 100

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Gift className="h-6 w-6 text-primary" />
                Affiliate Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Track your referrals and earnings
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`${tierInfo.color} text-white`}>
                <Award className="h-3 w-3 mr-1" />
                {tierInfo.label}
              </Badge>
              <Badge variant="outline">
                {affiliate.commission_rate}% Commission
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <ReferralStats
          totalEarnings={affiliate.total_earnings}
          pendingEarnings={affiliate.pending_earnings}
          totalClicks={affiliate.total_clicks}
          totalSignups={affiliate.total_signups}
          totalConversions={affiliate.total_conversions}
          conversionRate={affiliate.conversion_rate}
        />

        {/* Referral Link and Tier Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ReferralLink referralCode={affiliate.referral_code} />

          {/* Tier Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Tier Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${tierInfo.color}`} />
                  <span className="font-medium">{tierInfo.label}</span>
                </div>
                {nextTierInfo && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-sm">Next:</span>
                    <div className={`w-3 h-3 rounded-full ${nextTierInfo.color}`} />
                    <span className="font-medium">{nextTierInfo.label}</span>
                  </div>
                )}
              </div>

              <Progress value={Math.min(progressToNextTier, 100)} />

              {nextTierInfo && (
                <p className="text-sm text-muted-foreground">
                  ${affiliate.total_earnings.toFixed(2)} / ${nextTierInfo.minEarnings} 
                  <span className="ml-2">
                    (${(nextTierInfo.minEarnings - affiliate.total_earnings).toFixed(2)} to go)
                  </span>
                </p>
              )}

              <div className="grid grid-cols-4 gap-2 pt-4 border-t">
                {(Object.keys(TIER_INFO) as Array<keyof typeof TIER_INFO>).map(tier => (
                  <div 
                    key={tier}
                    className={`text-center p-2 rounded-lg ${affiliate.tier === tier ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted/50'}`}
                  >
                    <div className={`w-4 h-4 rounded-full ${TIER_INFO[tier].color} mx-auto mb-1`} />
                    <p className="text-xs font-medium">{TIER_INFO[tier].label}</p>
                    <p className="text-[10px] text-muted-foreground">{TIER_INFO[tier].commission}%</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payout Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  Earnings & Payouts
                </CardTitle>
                <CardDescription>
                  Request payouts when you reach $50 minimum
                </CardDescription>
              </div>
              <Button 
                onClick={requestPayout}
                disabled={affiliate.pending_earnings < 50}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Request Payout
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-green-50  rounded-lg">
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-2xl font-bold text-emerald-500">${affiliate.pending_earnings.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-blue-50  rounded-lg">
                <p className="text-sm text-muted-foreground">Lifetime Earnings</p>
                <p className="text-2xl font-bold text-blue-500">${affiliate.total_earnings.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Paid Out</p>
                <p className="text-2xl font-bold">${affiliate.paid_earnings.toFixed(2)}</p>
              </div>
            </div>

            <PayoutHistory payouts={payouts} />
          </CardContent>
        </Card>

        {/* Recent Referrals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Recent Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No referrals yet</p>
                <p className="text-sm">Share your link to start earning!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map(referral => (
                  <div 
                    key={referral.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {referral.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{referral.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(referral.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={
                        referral.status === 'converted' ? 'default' :
                        referral.status === 'signed_up' ? 'secondary' : 'destructive'
                      }>
                        {referral.status.replace('_', ' ')}
                      </Badge>
                      {referral.earned > 0 && (
                        <p className="text-sm font-medium text-emerald-500 mt-1">
                          +${referral.earned.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
