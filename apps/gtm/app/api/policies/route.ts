import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import { db } from '@/lib/db'

// GET /api/policies - Get current policy (latest version)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = getWorkspaceIdWithFallback(request)

    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace' }, { status: 400 })
    }

    const { data, error } = await db
      .from('policies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
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

    // Sanitize JSON fields for serialization
    const sanitizedData = {
      ...data,
      forbidden_terms: Array.isArray(data.forbidden_terms)
        ? data.forbidden_terms
        : JSON.parse(data.forbidden_terms || '[]'),
      regulated_categories: data.regulated_categories
        ? (typeof data.regulated_categories === 'string'
          ? JSON.parse(data.regulated_categories)
          : data.regulated_categories)
        : { security: true, health: true, finance: true, legal: true },
      superlative_rules: data.superlative_rules
        ? (typeof data.superlative_rules === 'string'
          ? JSON.parse(data.superlative_rules)
          : data.superlative_rules)
        : { block_without_proof: ['best', '#1', 'only'], require_evidence_tier: 'A' },
      evidence_requirements: data.evidence_requirements
        ? (typeof data.evidence_requirements === 'string'
          ? JSON.parse(data.evidence_requirements)
          : data.evidence_requirements)
        : { performance: 'B', security: 'A', pricing: 'C', compliance: 'A', generic: 'C' },
      created_at: data.created_at?.toISOString?.() || data.created_at,
      updated_at: data.updated_at?.toISOString?.() || data.updated_at,
    }

    return NextResponse.json(sanitizedData)
  } catch (error) {
    console.error('Error in policies GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/policies - Create a new policy version
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const workspaceId = getWorkspaceIdWithFallback(request)

    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace' }, { status: 400 })
    }

    // Get current version number
    const { data: currentPolicy } = await db
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

    const { data, error } = await db
      .from('policies')
      .insert({
        workspace_id: workspaceId,
        version: newVersion,
        mode,
        forbidden_terms: JSON.stringify(forbidden_terms),
        regulated_categories: JSON.stringify(regulated_categories),
        superlative_rules: JSON.stringify(superlative_rules),
        evidence_requirements: JSON.stringify(evidence_requirements),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating policy:', error)
      return NextResponse.json({ error: 'Failed to create policy' }, { status: 500 })
    }

    // Sanitize response
    const sanitizedData = {
      ...data,
      forbidden_terms: JSON.parse(data.forbidden_terms || '[]'),
      regulated_categories: JSON.parse(data.regulated_categories || '{}'),
      superlative_rules: JSON.parse(data.superlative_rules || '{}'),
      evidence_requirements: JSON.parse(data.evidence_requirements || '{}'),
      created_at: data.created_at?.toISOString?.() || data.created_at,
      updated_at: data.updated_at?.toISOString?.() || data.updated_at,
    }

    return NextResponse.json(sanitizedData)
  } catch (error) {
    console.error('Error in policies POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/policies - Update current policy (creates new version)
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const workspaceId = getWorkspaceIdWithFallback(request)

    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace' }, { status: 400 })
    }

    // Get current policy
    const { data: currentPolicy } = await db
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

    // Parse current policy JSON fields
    const currentForbiddenTerms = Array.isArray(currentPolicy.forbidden_terms)
      ? currentPolicy.forbidden_terms
      : JSON.parse(currentPolicy.forbidden_terms || '[]')
    const currentRegulatedCategories = typeof currentPolicy.regulated_categories === 'string'
      ? JSON.parse(currentPolicy.regulated_categories)
      : currentPolicy.regulated_categories
    const currentSuperlativeRules = typeof currentPolicy.superlative_rules === 'string'
      ? JSON.parse(currentPolicy.superlative_rules)
      : currentPolicy.superlative_rules
    const currentEvidenceRequirements = typeof currentPolicy.evidence_requirements === 'string'
      ? JSON.parse(currentPolicy.evidence_requirements)
      : currentPolicy.evidence_requirements

    // Merge updates with current policy
    const updates = {
      workspace_id: workspaceId,
      version: newVersion,
      mode: body.mode ?? currentPolicy.mode,
      forbidden_terms: JSON.stringify(body.forbidden_terms ?? currentForbiddenTerms),
      regulated_categories: JSON.stringify(body.regulated_categories ?? currentRegulatedCategories),
      superlative_rules: JSON.stringify(body.superlative_rules ?? currentSuperlativeRules),
      evidence_requirements: JSON.stringify(body.evidence_requirements ?? currentEvidenceRequirements),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await db
      .from('policies')
      .insert(updates)
      .select()
      .single()

    if (error) {
      console.error('Error updating policy:', error)
      return NextResponse.json({ error: 'Failed to update policy' }, { status: 500 })
    }

    // Sanitize response
    const sanitizedData = {
      ...data,
      forbidden_terms: JSON.parse(data.forbidden_terms || '[]'),
      regulated_categories: JSON.parse(data.regulated_categories || '{}'),
      superlative_rules: JSON.parse(data.superlative_rules || '{}'),
      evidence_requirements: JSON.parse(data.evidence_requirements || '{}'),
      created_at: data.created_at?.toISOString?.() || data.created_at,
      updated_at: data.updated_at?.toISOString?.() || data.updated_at,
    }

    return NextResponse.json(sanitizedData)
  } catch (error) {
    console.error('Error in policies PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
