import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/share/[token] - Public access to shared claim pack
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = createServiceClient()
    
    // Find claim pack by share token
    const { data: pack, error } = await supabase
      .from('claim_packs')
      .select('*')
      .eq('share_token', token)
      .single()
    
    if (error || !pack) {
      return NextResponse.json({ error: 'Shared link not found or expired' }, { status: 404 })
    }
    
    // Check expiration
    if (pack.expires_at && new Date(pack.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This shared link has expired' }, { status: 410 })
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
    
    // Get workspace info for branding
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', pack.workspace_id)
      .single()
    
    return NextResponse.json({
      pack: {
        id: pack.id,
        name: pack.name,
        description: pack.description,
        exportFormat: pack.export_format,
        createdAt: pack.created_at,
        expiresAt: pack.expires_at,
      },
      claims: claims || [],
      workspace: {
        name: workspace?.name || 'Unknown Workspace',
      },
    })
  } catch (error) {
    console.error('Error in share GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
