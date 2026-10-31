/**
 * Affiliate Program Manager
 * 
 * Comprehensive affiliate/referral system:
 * - 50% recurring commission (up to 12 months)
 * - 30-day cookie tracking
 * - Monthly payouts with 30-day clearing
 * - Performance tiers and bonuses
 */

import { createServiceClient } from '@/lib/supabase/service'
import crypto from 'crypto'

// ============================================================================
// Types
// ============================================================================

export interface Affiliate {
  id: string
  user_id: string
  code: string
  commission_rate: number
  commission_cap_months: number
  status: 'pending' | 'active' | 'suspended' | 'terminated'
  tier: 'standard' | 'premium' | 'vip'
  payout_method?: string
  payout_details?: Record<string, unknown>
  payout_minimum: number
  company_name?: string
  website?: string
  social_profiles?: Record<string, string>
  promotional_methods?: string[]
  total_referrals: number
  active_referrals: number
  total_earnings: number
  pending_earnings: number
  paid_earnings: number
  approved_by?: string
  approved_at?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface AffiliateReferral {
  id: string
  affiliate_id: string
  referred_user_id?: string
  referred_email?: string
  referral_code: string
  landing_page?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  cookie_id?: string
  cookie_expires_at?: string
  status: 'clicked' | 'signed_up' | 'subscribed' | 'churned'
  signed_up_at?: string
  subscribed_at?: string
  subscription_id?: string
  subscription_plan?: string
  subscription_amount?: number
  commission_rate?: number
  commission_months_remaining?: number
  total_commission_paid: number
  created_at: string
}

export interface AffiliatePayout {
  id: string
  affiliate_id: string
  period_start: string
  period_end: string
  gross_amount: number
  fees: number
  net_amount: number
  referral_count: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  payout_method?: string
  payout_reference?: string
  paid_at?: string
  failed_reason?: string
  created_at: string
}

export interface CreateAffiliateInput {
  userId: string
  companyName?: string
  website?: string
  socialProfiles?: Record<string, string>
  promotionalMethods?: string[]
}

// ============================================================================
// Affiliate Manager
// ============================================================================

export class AffiliateManager {
  /**
   * Apply to become an affiliate
   */
  static async apply(input: CreateAffiliateInput): Promise<Affiliate> {
    const supabase = createServiceClient()
    
    // Check if user already has an affiliate account
    const { data: existing } = await supabase
      .from('affiliates')
      .select('id, status')
      .eq('user_id', input.userId)
      .single()
    
    if (existing) {
      throw new Error(
        existing.status === 'terminated'
          ? 'Your affiliate account was terminated. Please contact support.'
          : 'You already have an affiliate account.'
      )
    }
    
    // Generate unique code
    let code: string
    let attempts = 0
    do {
      code = this.generateCode()
      const { data: codeExists } = await supabase
        .from('affiliates')
        .select('id')
        .eq('code', code)
        .single()
      
      if (!codeExists) break
      attempts++
    } while (attempts < 10)
    
    if (attempts >= 10) {
      throw new Error('Failed to generate unique affiliate code')
    }
    
    const { data, error } = await supabase
      .from('affiliates')
      .insert({
        user_id: input.userId,
        code,
        company_name: input.companyName,
        website: input.website,
        social_profiles: input.socialProfiles || {},
        promotional_methods: input.promotionalMethods || [],
        status: 'pending',
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to create affiliate: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Get affiliate by user ID
   */
  static async getByUserId(userId: string): Promise<Affiliate | null> {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('affiliates')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get affiliate: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Get affiliate by code
   */
  static async getByCode(code: string): Promise<Affiliate | null> {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('affiliates')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get affiliate: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Approve an affiliate application
   */
  static async approve(affiliateId: string, approvedBy: string): Promise<Affiliate> {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('affiliates')
      .update({
        status: 'active',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq('id', affiliateId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to approve affiliate: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Update payout method
   */
  static async updatePayoutMethod(
    affiliateId: string,
    method: string,
    details: Record<string, unknown>
  ): Promise<void> {
    const supabase = createServiceClient()
    
    const { error } = await supabase
      .from('affiliates')
      .update({
        payout_method: method,
        payout_details: details, // Should be encrypted
        updated_at: new Date().toISOString(),
      })
      .eq('id', affiliateId)
    
    if (error) {
      throw new Error(`Failed to update payout method: ${error.message}`)
    }
  }
  
  /**
   * Track a referral click
   */
  static async trackClick(
    affiliateCode: string,
    options: {
      landingPage?: string
      utmSource?: string
      utmMedium?: string
      utmCampaign?: string
      ipAddress?: string
      userAgent?: string
    }
  ): Promise<{ cookieId: string; expiresAt: Date }> {
    const affiliate = await this.getByCode(affiliateCode)
    
    if (!affiliate) {
      throw new Error('Invalid affiliate code')
    }
    
    const supabase = createServiceClient()
    
    // Generate cookie ID
    const cookieId = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30-day cookie
    
    const { error } = await supabase
      .from('affiliate_referrals')
      .insert({
        affiliate_id: affiliate.id,
        referral_code: affiliate.code,
        landing_page: options.landingPage,
        utm_source: options.utmSource,
        utm_medium: options.utmMedium,
        utm_campaign: options.utmCampaign,
        ip_address: options.ipAddress,
        user_agent: options.userAgent,
        cookie_id: cookieId,
        cookie_expires_at: expiresAt.toISOString(),
        commission_rate: affiliate.commission_rate,
        commission_months_remaining: affiliate.commission_cap_months,
        status: 'clicked',
      })
    
    if (error) {
      throw new Error(`Failed to track click: ${error.message}`)
    }
    
    return { cookieId, expiresAt }
  }
  
  /**
   * Convert a referral to signup
   */
  static async convertToSignup(
    cookieId: string,
    userId: string,
    email: string
  ): Promise<AffiliateReferral | null> {
    const supabase = createServiceClient()
    
    // Find the referral by cookie ID
    const { data: referral, error: findError } = await supabase
      .from('affiliate_referrals')
      .select('*')
      .eq('cookie_id', cookieId)
      .gt('cookie_expires_at', new Date().toISOString())
      .eq('status', 'clicked')
      .single()
    
    if (findError || !referral) {
      return null // No valid referral found
    }
    
    // Update referral with user info
    const { data, error } = await supabase
      .from('affiliate_referrals')
      .update({
        referred_user_id: userId,
        referred_email: email,
        status: 'signed_up',
        signed_up_at: new Date().toISOString(),
      })
      .eq('id', referral.id)
      .select()
      .single()
    
    if (error) {
      console.error('Failed to convert referral:', error)
      return null
    }
    
    return data
  }
  
  /**
   * Convert a referral to subscription
   */
  static async convertToSubscription(
    userId: string,
    subscriptionId: string,
    plan: string,
    amount: number,
    interval: string
  ): Promise<AffiliateReferral | null> {
    const supabase = createServiceClient()
    
    // Find the user's referral
    const { data: referral, error: findError } = await supabase
      .from('affiliate_referrals')
      .select('*')
      .eq('referred_user_id', userId)
      .eq('status', 'signed_up')
      .single()
    
    if (findError || !referral) {
      return null // No referral found
    }
    
    // Update referral with subscription info
    const { data, error } = await supabase
      .from('affiliate_referrals')
      .update({
        status: 'subscribed',
        subscribed_at: new Date().toISOString(),
        subscription_id: subscriptionId,
        subscription_plan: plan,
        subscription_amount: amount,
        subscription_interval: interval,
      })
      .eq('id', referral.id)
      .select()
      .single()
    
    if (error) {
      console.error('Failed to convert to subscription:', error)
      return null
    }
    
    // Create first commission record
    await this.createCommission(referral.id, referral.affiliate_id, amount, referral.commission_rate)
    
    return data
  }
  
  /**
   * Create a commission record
   */
  static async createCommission(
    referralId: string,
    affiliateId: string,
    subscriptionAmount: number,
    commissionRate: number
  ): Promise<void> {
    const supabase = createServiceClient()
    
    const commissionAmount = subscriptionAmount * commissionRate
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    const { error } = await supabase
      .from('affiliate_commissions')
      .insert({
        affiliate_id: affiliateId,
        referral_id: referralId,
        billing_period_start: periodStart.toISOString().split('T')[0],
        billing_period_end: periodEnd.toISOString().split('T')[0],
        subscription_amount: subscriptionAmount,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        status: 'pending',
      })
    
    if (error) {
      console.error('Failed to create commission:', error)
    }
  }
  
  /**
   * Get referrals for an affiliate
   */
  static async getReferrals(
    affiliateId: string,
    options?: {
      status?: string
      limit?: number
      offset?: number
    }
  ): Promise<{ referrals: AffiliateReferral[]; total: number }> {
    const supabase = createServiceClient()
    
    let query = supabase
      .from('affiliate_referrals')
      .select('*', { count: 'exact' })
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false })
    
    if (options?.status) {
      query = query.eq('status', options.status)
    }
    
    if (options?.limit) {
      query = query.limit(options.limit)
    }
    
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
    }
    
    const { data, error, count } = await query
    
    if (error) {
      throw new Error(`Failed to get referrals: ${error.message}`)
    }
    
    return { referrals: data || [], total: count || 0 }
  }
  
  /**
   * Get payouts for an affiliate
   */
  static async getPayouts(affiliateId: string): Promise<AffiliatePayout[]> {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('affiliate_payouts')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('period_end', { ascending: false })
    
    if (error) {
      throw new Error(`Failed to get payouts: ${error.message}`)
    }
    
    return data || []
  }
  
  /**
   * Get affiliate dashboard stats
   */
  static async getDashboardStats(affiliateId: string): Promise<{
    totalEarnings: number
    pendingEarnings: number
    paidEarnings: number
    totalReferrals: number
    activeReferrals: number
    conversionRate: number
    thisMonthEarnings: number
    lastMonthEarnings: number
  }> {
    const supabase = createServiceClient()
    
    // Get affiliate
    const { data: affiliate, error } = await supabase
      .from('affiliates')
      .select('*')
      .eq('id', affiliateId)
      .single()
    
    if (error || !affiliate) {
      throw new Error('Affiliate not found')
    }
    
    // Calculate conversion rate
    const { count: clickCount } = await supabase
      .from('affiliate_referrals')
      .select('*', { count: 'exact', head: true })
      .eq('affiliate_id', affiliateId)
    
    const conversionRate = clickCount && clickCount > 0
      ? (affiliate.active_referrals / clickCount) * 100
      : 0
    
    // Get this month's commissions
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    
    const { data: thisMonthCommissions } = await supabase
      .from('affiliate_commissions')
      .select('commission_amount')
      .eq('affiliate_id', affiliateId)
      .gte('created_at', thisMonthStart.toISOString())
    
    const { data: lastMonthCommissions } = await supabase
      .from('affiliate_commissions')
      .select('commission_amount')
      .eq('affiliate_id', affiliateId)
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString())
    
    const thisMonthEarnings = (thisMonthCommissions || [])
      .reduce((sum, c) => sum + (c.commission_amount || 0), 0)
    
    const lastMonthEarnings = (lastMonthCommissions || [])
      .reduce((sum, c) => sum + (c.commission_amount || 0), 0)
    
    return {
      totalEarnings: affiliate.total_earnings,
      pendingEarnings: affiliate.pending_earnings,
      paidEarnings: affiliate.paid_earnings,
      totalReferrals: affiliate.total_referrals,
      activeReferrals: affiliate.active_referrals,
      conversionRate,
      thisMonthEarnings,
      lastMonthEarnings,
    }
  }
  
  /**
   * Generate affiliate code
   */
  private static generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }
}

// ============================================================================
// Affiliate Link Helpers
// ============================================================================

/**
 * Generate affiliate link
 */
export function generateAffiliateLink(code: string, baseUrl: string = 'https://sako.ai'): string {
  return `${baseUrl}?ref=${code}`
}

/**
 * Parse affiliate code from URL
 */
export function parseAffiliateCode(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get('ref')
  } catch {
    return null
  }
}

/**
 * Get affiliate cookie name
 */
export function getAffiliateCookieName(): string {
  return 'sako_affiliate'
}
