import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'
import { requireWorkspaceEntitlement } from '@/lib/billing/entitlements'
import crypto from 'crypto'
import { nanoid } from 'nanoid'
import { Database } from '@/lib/supabase/types'



// GET /api/api-keys - List all API keys for workspace
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = getWorkspaceContext(request)
    const gate = await requireWorkspaceEntitlement(workspaceId, 'apiAccess', {
      message: 'ClaimsOS API keys require an active paid plan.',
    })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message, planId: gate.entitlements.planId }, { status: 403 })
    }
    const supabase = createServiceClient()

    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, is_active, created_at, last_used_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching API keys:', error)
      return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
    }

    return NextResponse.json(keys)
  } catch (error) {
    return handleWorkspaceError(error)
  }
}

// POST /api/api-keys - Create a new API key
export async function POST(request: NextRequest) {
  try {
    const { workspaceId, userId } = getWorkspaceContext(request)
    const gate = await requireWorkspaceEntitlement(workspaceId, 'apiAccess', {
      message: 'ClaimsOS API keys require an active paid plan.',
    })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message, planId: gate.entitlements.planId }, { status: 403 })
    }
    const { name } = await request.json()
    const supabase = createServiceClient()

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate key: sk_live_ + 32 random chars
    const rawKey = `sk_live_${nanoid(32)}`
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const keyPrefix = rawKey.substring(0, 16) // "sk_live_xxxxxxxx"

    const { data: apiKey, error } = await supabase
      .from('api_keys')
      .insert({
        workspace_id: workspaceId,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        created_by: userId,
        is_active: true,
      })
      .select('id, name, key_prefix, is_active, created_at')
      .maybeSingle()

    if (error) {
      console.error('Error creating API key:', error)
      return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
    }

    // Return full key ONCE - never stored
    return NextResponse.json({
      ...apiKey,
      key: rawKey, // Only returned on creation
      message: 'Copy this key now. It will not be shown again.',
    })
  } catch (error) {
    return handleWorkspaceError(error)
  }
}

// DELETE /api/api-keys - Revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const { workspaceId } = getWorkspaceContext(request)
    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('id')
    const supabase = createServiceClient()

    if (!keyId) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('api_keys')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq('id', keyId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Error revoking API key:', error)
      return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleWorkspaceError(error)
  }
}
