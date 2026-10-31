import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/workspace'

// GET /api/policies - Get current policy (latest version)
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const workspaceId = getWorkspaceId(request)
    
    const { data, error } = await supabase
      .from('policies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('version', { ascending: false })
      .limit(1)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No policy exists, return default
        return NextResponse.json({
          id: null,
          version: 0,
          mode: 'standard',
          forbidden_terms: [],
          regulated_categories: { security: true, health: true, finance: true, legal: true },
          superlative_rules: { block_without_proof: ['best', '#1', 'only'], require_evidence_tier: 'A' },
          evidence_requirements: { performance: 'B', security: 'A', pricing: 'C', compliance: 'A', generic: 'C' },
        })
      }
      console.error('Error fetching policy:', error)
      return NextResponse.json({ error: 'Failed to fetch policy' }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in policies GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/policies - Create a new policy version
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()
    const workspaceId = getWorkspaceId(request)
    
    // Get current version number
    const { data: currentPolicy } = await supabase
      .from('policies')
      .select('version')
      .eq('workspace_id', workspaceId)
      .order('version', { ascending: false })
      .limit(1)
      .single()
    
    const newVersion = (currentPolicy?.version || 0) + 1
    
    const {
      mode = 'standard',
      forbidden_terms = [],
      regulated_categories = { security: true, health: true, finance: true, legal: true },
      superlative_rules = { block_without_proof: ['best', '#1', 'only'], require_evidence_tier: 'A' },
      evidence_requirements = { performance: 'B', security: 'A', pricing: 'C', compliance: 'A', generic: 'C' },
    } = body
    
    const { data, error } = await supabase
      .from('policies')
      .insert({
        workspace_id: workspaceId,
        version: newVersion,
        mode,
        forbidden_terms,
        regulated_categories,
        superlative_rules,
        evidence_requirements,
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error creating policy:', error)
      return NextResponse.json({ error: 'Failed to create policy' }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in policies POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/policies - Update current policy (creates new version)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()
    const workspaceId = getWorkspaceId(request)
    
    // Get current policy
    const { data: currentPolicy } = await supabase
      .from('policies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('version', { ascending: false })
      .limit(1)
      .single()
    
    if (!currentPolicy) {
      // Create new policy with defaults + updates
      return POST(request)
    }
    
    const newVersion = currentPolicy.version + 1
    
    // Merge updates with current policy
    const updates = {
      workspace_id: workspaceId,
      version: newVersion,
      mode: body.mode ?? currentPolicy.mode,
      forbidden_terms: body.forbidden_terms ?? currentPolicy.forbidden_terms,
      regulated_categories: body.regulated_categories ?? currentPolicy.regulated_categories,
      superlative_rules: body.superlative_rules ?? currentPolicy.superlative_rules,
      evidence_requirements: body.evidence_requirements ?? currentPolicy.evidence_requirements,
    }
    
    const { data, error } = await supabase
      .from('policies')
      .insert(updates)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating policy:', error)
      return NextResponse.json({ error: 'Failed to update policy' }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in policies PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
