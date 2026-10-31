import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/claim-packs/[id] - Get a claim pack with full claims
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()
    
    const { data: pack, error } = await supabase
      .from('claim_packs')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Claim pack not found' }, { status: 404 })
      }
      console.error('Error fetching claim pack:', error)
      return NextResponse.json({ error: 'Failed to fetch claim pack' }, { status: 500 })
    }
    
    // Fetch full claims data
    const claimIds = pack.claim_ids as string[]
    const { data: claims } = await supabase
      .from('claims')
      .select(`
        id,
        text,
        claim_type,
        category,
        status,
        risk_score,
        claim_evidence_links (
          evidence:evidence_id (
            id,
            title,
            type,
            tier,
            url
          )
        )
      `)
      .in('id', claimIds)
    
    return NextResponse.json({
      ...pack,
      claims: claims || [],
    })
  } catch (error) {
    console.error('Error in claim-pack GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/claim-packs/[id] - Delete a claim pack
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()
    
    const { error } = await supabase
      .from('claim_packs')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting claim pack:', error)
      return NextResponse.json({ error: 'Failed to delete claim pack' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in claim-pack DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
