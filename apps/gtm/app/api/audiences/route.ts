/**
 * Audiences API
 * 
 * Endpoints for managing structured audience profiles.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  createAudienceProfile,
  getWorkspaceAudiences,
  getAudienceById,
  updateAudienceProfile,
  deleteAudienceProfile,
  generateAudienceProfile,
  setDefaultAudience,
  suggestAudiences,
} from '@/lib/audiences/audience-manager'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get workspace
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  }

  const searchParams = request.nextUrl.searchParams
  const audienceId = searchParams.get('id')

  if (audienceId) {
    const audience = await getAudienceById(audienceId)
    return NextResponse.json({ audience })
  }

  const audiences = await getWorkspaceAudiences(member.workspace_id)
  return NextResponse.json({ audiences })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get workspace
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  }

  const body = await request.json()
  const { action } = body

  switch (action) {
    case 'generate': {
      const { description, industry, product } = body
      if (!description) {
        return NextResponse.json({ error: 'description required' }, { status: 400 })
      }
      const profile = await generateAudienceProfile(description, { industry, product })
      return NextResponse.json({ profile })
    }

    case 'suggest': {
      const { productDescription, count } = body
      if (!productDescription) {
        return NextResponse.json({ error: 'productDescription required' }, { status: 400 })
      }
      const suggestions = await suggestAudiences(productDescription, count || 3)
      return NextResponse.json({ suggestions })
    }

    case 'create': {
      const { profile } = body
      if (!profile) {
        return NextResponse.json({ error: 'profile required' }, { status: 400 })
      }
      const audience = await createAudienceProfile(member.workspace_id, profile)
      return NextResponse.json({ audience })
    }

    case 'setDefault': {
      const { audienceId } = body
      if (!audienceId) {
        return NextResponse.json({ error: 'audienceId required' }, { status: 400 })
      }
      const success = await setDefaultAudience(member.workspace_id, audienceId)
      return NextResponse.json({ success })
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { audienceId, updates } = body

  if (!audienceId || !updates) {
    return NextResponse.json({ error: 'audienceId and updates required' }, { status: 400 })
  }

  const audience = await updateAudienceProfile(audienceId, updates)
  return NextResponse.json({ audience })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const audienceId = searchParams.get('id')

  if (!audienceId) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const success = await deleteAudienceProfile(audienceId)
  return NextResponse.json({ success })
}
