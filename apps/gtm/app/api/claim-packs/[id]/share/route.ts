import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { nanoid } from 'nanoid'

// POST /api/claim-packs/[id]/share - Generate or regenerate share link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()
    const body = await request.json()
    
    const { expiresInDays = 7 } = body
    
    // Generate new share token
    const shareToken = nanoid(16)
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    
    const { data, error } = await supabase
      .from('claim_packs')
      .update({
        share_token: shareToken,
        expires_at: expiresAt,
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Claim pack not found' }, { status: 404 })
      }
      console.error('Error generating share link:', error)
      return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 })
    }
    
    return NextResponse.json({
      shareToken,
      shareUrl: `/share/${shareToken}`,
      expiresAt,
      pack: data,
    })
  } catch (error) {
    console.error('Error in share POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/claim-packs/[id]/share - Revoke share link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()
    
    const { error } = await supabase
      .from('claim_packs')
      .update({
        share_token: null,
        expires_at: null,
      })
      .eq('id', id)
    
    if (error) {
      console.error('Error revoking share link:', error)
      return NextResponse.json({ error: 'Failed to revoke share link' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in share DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
