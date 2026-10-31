import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/workspace'

// GET /api/policies/[version] - Get a specific policy version
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ version: string }> }
) {
  try {
    const { version } = await params
    const supabase = createServiceClient()
    const workspaceId = getWorkspaceId(request)
    
    // Handle 'history' to get all versions
    if (version === 'history') {
      const { data, error } = await supabase
        .from('policies')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('version', { ascending: false })
      
      if (error) {
        console.error('Error fetching policy history:', error)
        return NextResponse.json({ error: 'Failed to fetch policy history' }, { status: 500 })
      }
      
      return NextResponse.json(data)
    }
    
    const versionNum = parseInt(version, 10)
    if (isNaN(versionNum)) {
      return NextResponse.json({ error: 'Invalid version number' }, { status: 400 })
    }
    
    const { data, error } = await supabase
      .from('policies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('version', versionNum)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Policy version not found' }, { status: 404 })
      }
      console.error('Error fetching policy version:', error)
      return NextResponse.json({ error: 'Failed to fetch policy' }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in policy version GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
