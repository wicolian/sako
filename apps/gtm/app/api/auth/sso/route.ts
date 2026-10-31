/**
 * SSO Configuration API
 * 
 * GET /api/auth/sso - Get SSO config
 * POST /api/auth/sso - Update SSO config
 * DELETE /api/auth/sso - Delete SSO config
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  getSSOConfig,
  upsertSSOConfig,
  deleteSSOConfig,
  SSO_PROVIDERS,
  type SSOProvider,
} from '@/lib/auth/saml-sso'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspace and check admin permission
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can view SSO configuration' },
        { status: 403 }
      )
    }

    const config = await getSSOConfig(membership.workspace_id)
    
    return NextResponse.json({
      success: true,
      config: config ? {
        ...config,
        clientSecret: config.clientSecret ? '********' : undefined, // Mask secret
      } : null,
      providers: SSO_PROVIDERS,
    })
  } catch (error) {
    console.error('Error fetching SSO config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch SSO configuration' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspace and check owner permission
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    if (membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only workspace owners can configure SSO' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      provider,
      enabled,
      domain,
      clientId,
      clientSecret,
      entityId,
      ssoUrl,
      sloUrl,
      certificate,
      enforceSSO,
      autoProvision,
      defaultRole,
      allowedDomains,
    } = body

    // Validate provider
    if (provider && !SSO_PROVIDERS.some(p => p.provider === provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      )
    }

    // Validate required fields based on provider
    if (enabled) {
      if (!provider) {
        return NextResponse.json(
          { error: 'Provider is required to enable SSO' },
          { status: 400 }
        )
      }

      if (provider === 'custom_saml' && (!ssoUrl || !certificate)) {
        return NextResponse.json(
          { error: 'SSO URL and Certificate are required for custom SAML' },
          { status: 400 }
        )
      }

      if (['okta', 'auth0'].includes(provider) && !clientId) {
        return NextResponse.json(
          { error: 'Client ID is required for this provider' },
          { status: 400 }
        )
      }
    }

    const config = await upsertSSOConfig(membership.workspace_id, {
      provider: provider as SSOProvider,
      enabled,
      domain,
      clientId,
      clientSecret,
      entityId,
      ssoUrl,
      sloUrl,
      certificate,
      enforceSSO,
      autoProvision,
      defaultRole,
      allowedDomains,
    })

    if (!config) {
      return NextResponse.json(
        { error: 'Failed to save SSO configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      config: {
        ...config,
        clientSecret: config.clientSecret ? '********' : undefined,
      },
    })
  } catch (error) {
    console.error('Error updating SSO config:', error)
    return NextResponse.json(
      { error: 'Failed to update SSO configuration' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspace and check owner permission
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    if (membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only workspace owners can delete SSO configuration' },
        { status: 403 }
      )
    }

    const success = await deleteSSOConfig(membership.workspace_id)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete SSO configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting SSO config:', error)
    return NextResponse.json(
      { error: 'Failed to delete SSO configuration' },
      { status: 500 }
    )
  }
}
