/**
 * Marketplace Purchase API
 * 
 * Handle template purchases via Stripe.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createCheckoutSession,
  completePurchase,
  getTemplatePrice,
  PurchaseDetails,
} from '@/lib/templates/paid-templates'
import { hasUserPurchased } from '@/lib/templates/remix-tracker'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { templateId } = body

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 }
      )
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: 'No workspace found' },
        { status: 404 }
      )
    }

    // Check if already purchased
    const alreadyPurchased = await hasUserPurchased(user.id, templateId)
    if (alreadyPurchased) {
      return NextResponse.json(
        { error: 'Template already purchased' },
        { status: 400 }
      )
    }

    // Get template details
    const { data: template, error: templateError } = await supabase
      .from('design_templates')
      .select('id, name, price_cents, creator_payout_percent, creator_id')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    if (!template.price_cents || template.price_cents <= 0) {
      return NextResponse.json(
        { error: 'This template is free' },
        { status: 400 }
      )
    }

    // Create checkout session
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL
    const successUrl = `${origin}/marketplace/purchase-success`
    const cancelUrl = `${origin}/marketplace/template/${templateId}`

    const purchaseDetails: PurchaseDetails = {
      templateId: template.id,
      templateName: template.name,
      priceCents: template.price_cents,
      creatorPayoutPercent: template.creator_payout_percent,
      creatorId: template.creator_id,
      buyerId: user.id,
      workspaceId: membership.workspace_id,
    }

    const { checkoutUrl, sessionId } = await createCheckoutSession(
      purchaseDetails,
      successUrl,
      cancelUrl
    )

    return NextResponse.json({ checkoutUrl, sessionId })
  } catch (error) {
    console.error('POST /api/marketplace/purchase error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

/**
 * Complete purchase after Stripe redirect
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      )
    }

    const purchase = await completePurchase(sessionId)

    if (!purchase) {
      return NextResponse.json(
        { error: 'Purchase not found or not completed' },
        { status: 404 }
      )
    }

    return NextResponse.json({ purchase })
  } catch (error) {
    console.error('GET /api/marketplace/purchase error:', error)
    return NextResponse.json(
      { error: 'Failed to verify purchase' },
      { status: 500 }
    )
  }
}
