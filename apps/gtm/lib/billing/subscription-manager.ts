/**
 * Subscription Manager
 * 
 * Self-service subscription management:
 * - Cancel anytime
 * - 14-day money-back guarantee
 * - Plan upgrades/downgrades
 */

import { createServiceClient } from '@/lib/supabase/service'
import Stripe from 'stripe'

// ============================================================================
// Types
// ============================================================================

export interface Subscription {
  id: string
  workspace_id: string
  stripe_subscription_id: string
  stripe_customer_id: string
  plan_id: string
  status: SubscriptionStatus
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  canceled_at?: string
  cancellation_reason?: string
  trial_end?: string
  created_at: string
  updated_at: string
}

export type SubscriptionStatus = 
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'trialing'
  | 'unpaid'

export interface CancellationOptions {
  reason: CancellationReason
  feedback?: string
  immediate?: boolean
}

export type CancellationReason =
  | 'too_expensive'
  | 'missing_features'
  | 'switched_competitor'
  | 'not_using'
  | 'temporary_pause'
  | 'other'

export interface RefundEligibility {
  eligible: boolean
  amount?: number
  reason?: string
  daysRemaining?: number
}

// ============================================================================
// Stripe Client
// ============================================================================

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

// ============================================================================
// Subscription Manager
// ============================================================================

export class SubscriptionManager {
  /**
   * Get subscription for a workspace
   */
  static async getSubscription(workspaceId: string): Promise<Subscription | null> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get subscription: ${error.message}`)
    }

    return data
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(
    workspaceId: string,
    options: CancellationOptions
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(workspaceId)
    
    if (!subscription) {
      throw new Error('No active subscription found')
    }

    if (subscription.status === 'canceled') {
      throw new Error('Subscription is already canceled')
    }

    // Cancel in Stripe
    if (options.immediate) {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
    } else {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      })
    }

    // Update in database
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: !options.immediate,
        status: options.immediate ? 'canceled' : subscription.status,
        canceled_at: new Date().toISOString(),
        cancellation_reason: options.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to cancel subscription: ${error.message}`)
    }

    // Record cancellation feedback
    await this.recordCancellationFeedback(workspaceId, options)

    return data
  }

  /**
   * Reactivate a canceled subscription
   */
  static async reactivateSubscription(workspaceId: string): Promise<Subscription> {
    const subscription = await this.getSubscription(workspaceId)
    
    if (!subscription) {
      throw new Error('No subscription found')
    }

    if (!subscription.cancel_at_period_end) {
      throw new Error('Subscription is not scheduled for cancellation')
    }

    // Reactivate in Stripe
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    })

    // Update in database
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: false,
        canceled_at: null,
        cancellation_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to reactivate subscription: ${error.message}`)
    }

    return data
  }

  /**
   * Check refund eligibility (14-day guarantee)
   */
  static async checkRefundEligibility(workspaceId: string): Promise<RefundEligibility> {
    const subscription = await this.getSubscription(workspaceId)
    
    if (!subscription) {
      return { eligible: false, reason: 'No subscription found' }
    }

    const subscriptionStart = new Date(subscription.created_at)
    const now = new Date()
    const daysSinceStart = Math.floor(
      (now.getTime() - subscriptionStart.getTime()) / (1000 * 60 * 60 * 24)
    )

    const guaranteePeriod = 14 // days

    if (daysSinceStart > guaranteePeriod) {
      return {
        eligible: false,
        reason: `Guarantee period has expired (${daysSinceStart} days since subscription)`,
      }
    }

    // Get the latest invoice
    const invoices = await stripe.invoices.list({
      subscription: subscription.stripe_subscription_id,
      limit: 1,
    })

    if (!invoices.data.length) {
      return { eligible: false, reason: 'No invoices found' }
    }

    const latestInvoice = invoices.data[0]
    const refundAmount = latestInvoice.amount_paid

    return {
      eligible: true,
      amount: refundAmount / 100, // Convert from cents
      daysRemaining: guaranteePeriod - daysSinceStart,
    }
  }

  /**
   * Request a refund
   */
  static async requestRefund(
    workspaceId: string,
    reason: string
  ): Promise<{ success: boolean; refundId?: string; message: string }> {
    const eligibility = await this.checkRefundEligibility(workspaceId)

    if (!eligibility.eligible) {
      return {
        success: false,
        message: eligibility.reason || 'Not eligible for refund',
      }
    }

    const subscription = await this.getSubscription(workspaceId)
    if (!subscription) {
      return { success: false, message: 'Subscription not found' }
    }

    try {
      // Get the latest payment intent
      const invoices = await stripe.invoices.list({
        subscription: subscription.stripe_subscription_id,
        limit: 1,
      })

      if (!invoices.data.length || !invoices.data[0].payment_intent) {
        return { success: false, message: 'No payment found to refund' }
      }

      // Create refund
      const refund = await stripe.refunds.create({
        payment_intent: invoices.data[0].payment_intent as string,
        reason: 'requested_by_customer',
        metadata: {
          workspace_id: workspaceId,
          reason,
        },
      })

      // Cancel the subscription
      await this.cancelSubscription(workspaceId, {
        reason: 'other',
        feedback: `Refund requested: ${reason}`,
        immediate: true,
      })

      return {
        success: true,
        refundId: refund.id,
        message: `Refund of $${(refund.amount / 100).toFixed(2)} processed successfully`,
      }
    } catch (error) {
      console.error('Refund failed:', error)
      return { success: false, message: 'Failed to process refund' }
    }
  }

  /**
   * Get subscription billing history
   */
  static async getBillingHistory(workspaceId: string): Promise<BillingHistoryItem[]> {
    const subscription = await this.getSubscription(workspaceId)
    
    if (!subscription) {
      return []
    }

    const invoices = await stripe.invoices.list({
      customer: subscription.stripe_customer_id,
      limit: 24, // Last 2 years
    })

    return invoices.data.map(invoice => ({
      id: invoice.id,
      date: new Date(invoice.created * 1000).toISOString(),
      amount: invoice.amount_paid / 100,
      status: invoice.status || 'unknown',
      description: invoice.lines.data[0]?.description || 'Subscription',
      invoiceUrl: invoice.hosted_invoice_url || undefined,
      pdfUrl: invoice.invoice_pdf || undefined,
    }))
  }

  /**
   * Update payment method
   */
  static async updatePaymentMethod(
    workspaceId: string,
    paymentMethodId: string
  ): Promise<void> {
    const subscription = await this.getSubscription(workspaceId)
    
    if (!subscription) {
      throw new Error('No subscription found')
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: subscription.stripe_customer_id,
    })

    // Set as default payment method
    await stripe.customers.update(subscription.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    // Update subscription to use new payment method
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      default_payment_method: paymentMethodId,
    })
  }

  /**
   * Record cancellation feedback
   */
  private static async recordCancellationFeedback(
    workspaceId: string,
    options: CancellationOptions
  ): Promise<void> {
    const supabase = createServiceClient()

    await supabase
      .from('cancellation_feedback')
      .insert({
        workspace_id: workspaceId,
        reason: options.reason,
        feedback: options.feedback,
        created_at: new Date().toISOString(),
      })
  }
}

// ============================================================================
// Helper Types
// ============================================================================

export interface BillingHistoryItem {
  id: string
  date: string
  amount: number
  status: string
  description: string
  invoiceUrl?: string
  pdfUrl?: string
}

// ============================================================================
// Cancellation Reason Labels
// ============================================================================

export const CANCELLATION_REASONS: { value: CancellationReason; label: string }[] = [
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'missing_features', label: 'Missing features I need' },
  { value: 'switched_competitor', label: 'Switched to a competitor' },
  { value: 'not_using', label: 'Not using it enough' },
  { value: 'temporary_pause', label: 'Taking a temporary break' },
  { value: 'other', label: 'Other reason' },
]

// ============================================================================
// Plan Comparison Helper
// ============================================================================

export function canDowngrade(currentPlan: string, targetPlan: string): boolean {
  const planOrder = ['starter', 'pro', 'max', 'enterprise']
  return planOrder.indexOf(targetPlan) < planOrder.indexOf(currentPlan)
}

export function canUpgrade(currentPlan: string, targetPlan: string): boolean {
  const planOrder = ['starter', 'pro', 'max', 'enterprise']
  return planOrder.indexOf(targetPlan) > planOrder.indexOf(currentPlan)
}
