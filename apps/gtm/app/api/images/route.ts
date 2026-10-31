/**
 * AI Image Generation API
 * 
 * Endpoints for generating and managing AI-generated images.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  generateImage,
  getWorkspaceImages,
  deleteImage,
  getSuggestedDimensions,
  getImageStyles,
} from '@/lib/assets/image-generator'

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
  const action = searchParams.get('action')
  const campaignId = searchParams.get('campaignId')
  const style = searchParams.get('style')
  const contentType = searchParams.get('contentType')

  if (action === 'dimensions') {
    const dimensions = getSuggestedDimensions(contentType || 'ad')
    return NextResponse.json({ dimensions })
  }

  if (action === 'styles') {
    const styles = getImageStyles()
    return NextResponse.json({ styles })
  }

  // Get images
  const images = await getWorkspaceImages(member.workspace_id, {
    campaignId: campaignId || undefined,
    style: style || undefined,
  })

  return NextResponse.json({ images })
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
  const {
    prompt,
    brandId,
    campaignId,
    style,
    dimensions,
    customWidth,
    customHeight,
    negativePrompt,
    tags,
  } = body

  if (!prompt) {
    return NextResponse.json({ error: 'prompt required' }, { status: 400 })
  }

  try {
    const image = await generateImage({
      prompt,
      workspaceId: member.workspace_id,
      brandId,
      campaignId,
      style,
      dimensions,
      customWidth,
      customHeight,
      negativePrompt,
      tags,
    })

    return NextResponse.json({ image })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const imageId = searchParams.get('id')

  if (!imageId) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const success = await deleteImage(imageId)
  return NextResponse.json({ success })
}
