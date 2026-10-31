import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'
import { PLANS, normalizePlanId } from '@/lib/billing/plans'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, userId } = getWorkspaceContext(request)
    const { planId } = await request.json()
    const supabase = createServiceClient()

    const normalizedPlanId = normalizePlanId(planId)
    const plan = PLANS[normalizedPlanId]
    if (!plan || !plan.stripePriceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // Get or create Stripe customer
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('workspace_id', workspaceId)
      .single()

    let customerId = subscription?.stripe_customer_id

    if (!customerId) {
      // Get user email for Stripe customer
      const { data: user } = await supabase.auth.admin.getUserById(userId)
      
      const customer = await stripe.customers.create({
        email: user.user?.email,
        metadata: { workspaceId, userId },
      })
      customerId = customer.id

      await supabase
        .from('subscriptions')
        .upsert({
          workspace_id: workspaceId,
          stripe_customer_id: customerId,
          plan_id: 'free',
          status: 'active',
        })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?billing=canceled`,
      metadata: { workspaceId, planId: normalizedPlanId },
      subscription_data: {
        metadata: { workspaceId, planId: normalizedPlanId },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return handleWorkspaceError(error)
  }
}
