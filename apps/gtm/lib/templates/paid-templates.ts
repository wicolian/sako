/**
 * Paid Templates
 * 
 * Handle template purchases via Stripe and creator payouts.
 */

import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/service'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
} as unknown as Stripe.StripeConfig)

export interface PurchaseDetails {
  templateId: string
  templateName: string
  priceCents: number
  creatorPayoutPercent: number
  creatorId: string
  buyerId: string
  workspaceId: string
}

export interface CheckoutResult {
  checkoutUrl: string
  sessionId: string
}

export interface PurchaseRecord {
  id: string
  template_id: string
  user_id: string
  workspace_id: string
  stripe_payment_id: string | null
  stripe_checkout_session_id: string | null
  amount_cents: number
  creator_payout_cents: number
  platform_fee_cents: number
  status: 'pending' | 'completed' | 'refunded'
  purchased_at: string
}

/**
 * Create a Stripe checkout session for template purchase
 */
export async function createCheckoutSession(
  details: PurchaseDetails,
  successUrl: string,
  cancelUrl: string
): Promise<CheckoutResult> {
  const platformFee = Math.round(details.priceCents * (1 - details.creatorPayoutPercent / 100))
  const creatorPayout = details.priceCents - platformFee

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: details.templateName,
            description: 'Design template for Sako Composer',
            metadata: {
              templateId: details.templateId,
              creatorId: details.creatorId,
            },
          },
          unit_amount: details.priceCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      templateId: details.templateId,
      buyerId: details.buyerId,
      workspaceId: details.workspaceId,
      creatorId: details.creatorId,
      creatorPayout: String(creatorPayout),
      platformFee: String(platformFee),
    },
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
  })

  // Create pending purchase record
  const supabase = createServiceClient()
  await supabase.from('template_purchases').insert({
    template_id: details.templateId,
    user_id: details.buyerId,
    workspace_id: details.workspaceId,
    stripe_checkout_session_id: session.id,
    amount_cents: details.priceCents,
    creator_payout_cents: creatorPayout,
    platform_fee_cents: platformFee,
    status: 'pending',
  })

  return {
    checkoutUrl: session.url!,
    sessionId: session.id,
  }
}

/**
 * Complete a purchase after successful Stripe payment
 */
export async function completePurchase(sessionId: string): Promise<PurchaseRecord | null> {
  const supabase = createServiceClient()

  // Get the session from Stripe
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent'],
  })

  if (session.payment_status !== 'paid') {
    return null
  }

  const paymentIntent = session.payment_intent as Stripe.PaymentIntent

  // Update purchase record
  const { data: purchase, error } = await supabase
    .from('template_purchases')
    .update({
      status: 'completed',
      stripe_payment_id: paymentIntent?.id,
    })
    .eq('stripe_checkout_session_id', sessionId)
    .select()
    .single()

  if (error || !purchase) {
    console.error('Failed to update purchase:', error)
    return null
  }

  // Create creator earning record
  await supabase.from('creator_earnings').insert({
    creator_id: session.metadata?.creatorId,
    template_id: session.metadata?.templateId,
    purchase_id: purchase.id,
    amount_cents: parseInt(session.metadata?.creatorPayout || '0'),
    status: 'pending',
  })

  return purchase as PurchaseRecord
}

/**
 * Process a refund for a template purchase
 */
export async function refundPurchase(purchaseId: string): Promise<boolean> {
  const supabase = createServiceClient()

  // Get the purchase record
  const { data: purchase, error: fetchError } = await supabase
    .from('template_purchases')
    .select('*')
    .eq('id', purchaseId)
    .single()

  if (fetchError || !purchase || !purchase.stripe_payment_id) {
    return false
  }

  // Process Stripe refund
  try {
    await stripe.refunds.create({
      payment_intent: purchase.stripe_payment_id,
    })
  } catch (error) {
    console.error('Stripe refund failed:', error)
    return false
  }

  // Update purchase status
  await supabase
    .from('template_purchases')
    .update({ status: 'refunded' })
    .eq('id', purchaseId)

  // Update creator earning
  await supabase
    .from('creator_earnings')
    .update({ status: 'cancelled' })
    .eq('purchase_id', purchaseId)

  return true
}

/**
 * Get template price info
 */
export async function getTemplatePrice(templateId: string): Promise<{
  priceCents: number | null
  creatorPayoutPercent: number
  isFree: boolean
} | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('design_templates')
    .select('price_cents, creator_payout_percent')
    .eq('id', templateId)
    .single()

  if (error || !data) return null

  return {
    priceCents: data.price_cents,
    creatorPayoutPercent: data.creator_payout_percent,
    isFree: data.price_cents === null || data.price_cents === 0,
  }
}

/**
 * Set template price (for template creators)
 */
export async function setTemplatePrice(
  templateId: string,
  priceCents: number | null,
  creatorId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  // Verify creator owns the template
  const { data: template } = await supabase
    .from('design_templates')
    .select('creator_id')
    .eq('id', templateId)
    .single()

  if (!template || template.creator_id !== creatorId) {
    return false
  }

  const { error } = await supabase
    .from('design_templates')
    .update({ price_cents: priceCents })
    .eq('id', templateId)

  return !error
}

/**
 * Get creator earnings summary
 */
export async function getCreatorEarnings(creatorId: string): Promise<{
  totalEarned: number
  pendingPayout: number
  totalPaidOut: number
  recentEarnings: Array<{
    id: string
    amount_cents: number
    template_name: string
    created_at: string
  }>
}> {
  const supabase = createServiceClient()

  // Get earnings
  const { data: earnings } = await supabase
    .from('creator_earnings')
    .select(`
      id,
      amount_cents,
      status,
      created_at,
      templates:design_templates(name)
    `)
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })

  if (!earnings || earnings.length === 0) {
    return {
      totalEarned: 0,
      pendingPayout: 0,
      totalPaidOut: 0,
      recentEarnings: [],
    }
  }

  const totalEarned = earnings.reduce((sum, e) => sum + e.amount_cents, 0)
  const pendingPayout = earnings
    .filter((e) => e.status === 'pending')
    .reduce((sum, e) => sum + e.amount_cents, 0)
  const totalPaidOut = earnings
    .filter((e) => e.status === 'paid')
    .reduce((sum, e) => sum + e.amount_cents, 0)

  const recentEarnings = earnings.slice(0, 10).map((e) => ({
    id: e.id,
    amount_cents: e.amount_cents,
    template_name: ((e.templates as unknown as { name: string }[]))?.[0]?.name || 'Unknown',
    created_at: e.created_at,
  }))

  return {
    totalEarned,
    pendingPayout,
    totalPaidOut,
    recentEarnings,
  }
}

/**
 * Format price for display
 */
export function formatPrice(priceCents: number | null): string {
  if (priceCents === null || priceCents === 0) {
    return 'Free'
  }
  return `$${(priceCents / 100).toFixed(2)}`
}

/**
 * Validate price input
 */
export function validatePrice(priceCents: number | null): {
  valid: boolean
  error?: string
} {
  if (priceCents === null) {
    return { valid: true }
  }

  if (priceCents < 0) {
    return { valid: false, error: 'Price cannot be negative' }
  }

  if (priceCents > 0 && priceCents < 100) {
    return { valid: false, error: 'Minimum price is $1.00' }
  }

  if (priceCents > 99900) {
    return { valid: false, error: 'Maximum price is $999.00' }
  }

  return { valid: true }
}
