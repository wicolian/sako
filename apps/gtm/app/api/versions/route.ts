/**
 * Campaign Versions API
 * 
 * Endpoints for version control functionality.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  createCampaignVersion,
  getCampaignVersions,
  getCampaignVersion,
  restoreCampaignVersion,
  compareCampaignVersions,
  tagCampaignVersion,
  getCampaignVersionByTag,
} from '@/lib/versioning/campaign-versions'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const campaignId = searchParams.get('campaignId')
  const versionNumber = searchParams.get('version')
  const tag = searchParams.get('tag')
  const action = searchParams.get('action')

  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
  }

  if (action === 'compare') {
    const versionA = parseInt(searchParams.get('versionA') || '0')
    const versionB = parseInt(searchParams.get('versionB') || '0')

    if (!versionA || !versionB) {
      return NextResponse.json({ error: 'versionA and versionB required' }, { status: 400 })
    }

    try {
      const comparison = await compareCampaignVersions(campaignId, versionA, versionB)
      return NextResponse.json({ comparison })
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 404 })
    }
  }

  if (tag) {
    const version = await getCampaignVersionByTag(campaignId, tag)
    return NextResponse.json({ version })
  }

  if (versionNumber) {
    const version = await getCampaignVersion(campaignId, parseInt(versionNumber))
    return NextResponse.json({ version })
  }

  // Get all versions
  const versions = await getCampaignVersions(campaignId)
  return NextResponse.json({ versions })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action, campaignId } = body

  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
  }

  switch (action) {
    case 'create': {
      const { description, changeType, versionTag } = body
      const version = await createCampaignVersion(campaignId, {
        description,
        changeType,
        versionTag,
      })
      return NextResponse.json({ version })
    }

    case 'restore': {
      const { versionNumber } = body
      if (!versionNumber) {
        return NextResponse.json({ error: 'versionNumber required' }, { status: 400 })
      }
      try {
        const version = await restoreCampaignVersion(campaignId, versionNumber, user.id)
        return NextResponse.json({ version })
      } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 404 })
      }
    }

    case 'tag': {
      const { versionNumber, tag } = body
      if (!versionNumber || !tag) {
        return NextResponse.json({ error: 'versionNumber and tag required' }, { status: 400 })
      }
      const success = await tagCampaignVersion(campaignId, versionNumber, tag)
      return NextResponse.json({ success })
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}
