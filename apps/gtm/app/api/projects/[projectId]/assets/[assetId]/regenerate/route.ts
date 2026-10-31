/**
 * POST /api/projects/[projectId]/assets/[assetId]/regenerate
 *
 * Regenerate the AI content of a canvas asset using the project's brand,
 * audience, and campaign goals as context. Supports text, heading, email,
 * and social post asset types. Other types return a clear 422 rather than
 * a fake response.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { quickGenerate } from '@/lib/ai/ai-sdk-client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; assetId: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { projectId, assetId } = await params

  try {
    // Fetch asset + project in parallel
    const [{ data: asset, error: assetError }, { data: project, error: projectError }] =
      await Promise.all([
        supabase
          .from('project_assets')
          .select('id, name, type, content, html, status')
          .eq('id', assetId)
          .eq('project_id', projectId)
          .single(),
        supabase
          .from('projects')
          .select(
            'id, name, description, campaign_goals, tone_override, keywords_include, keywords_avoid, custom_instructions, brand_id, audience_id'
          )
          .eq('id', projectId)
          .single(),
      ])

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }
    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Only text-based asset types can be AI-regenerated
    const regenerableTypes = ['text', 'heading', 'body', 'email', 'social', 'cta', 'tagline']
    if (!regenerableTypes.includes(asset.type as string)) {
      return NextResponse.json(
        {
          error: `Asset type '${asset.type}' does not support AI regeneration. Supported: ${regenerableTypes.join(', ')}`,
        },
        { status: 422 }
      )
    }

    // Fetch brand name if available
    let brandName: string | null = null
    if (project.brand_id) {
      const { data: brand } = await supabase
        .from('brands')
        .select('name')
        .eq('id', project.brand_id)
        .single()
      brandName = brand?.name ?? null
    }

    const tone = project.tone_override || 'professional'
    const goals = project.campaign_goals || 'drive engagement and conversions'
    const keywords = ((project.keywords_include as string[]) ?? []).join(', ')
    const avoid = ((project.keywords_avoid as string[]) ?? []).join(', ')
    const existingContent =
      typeof asset.content === 'object' && asset.content !== null
        ? JSON.stringify(asset.content).slice(0, 500)
        : String(asset.content ?? '')

    const systemPrompt = `You are a ${tone} marketing copywriter${brandName ? ` for ${brandName}` : ''}.
Campaign goals: ${goals}.
${keywords ? `Include these keywords: ${keywords}.` : ''}
${avoid ? `Avoid: ${avoid}.` : ''}
${project.custom_instructions ? `Additional instructions: ${project.custom_instructions}` : ''}`

    const userPrompt = `Regenerate this ${asset.type} asset named "${asset.name}".
Current content: ${existingContent || '(empty)'}
Return only the new content as a JSON object with a "text" field (and optionally "headline", "subheadline", "cta" for heading/email types).`

    const generated = await quickGenerate(userPrompt, {
      system: systemPrompt,
      maxTokens: 600,
    })

    // Parse the generated JSON or fall back to plain text
    let newContent: Record<string, unknown>
    try {
      const cleaned = generated.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '')
      newContent = JSON.parse(cleaned) as Record<string, unknown>
    } catch {
      newContent = { text: generated.trim() }
    }

    // Update asset with regenerated content and mark as draft (needs review)
    const { data: updated, error: updateError } = await supabase
      .from('project_assets')
      .update({ content: newContent, status: 'draft' })
      .eq('id', assetId)
      .eq('project_id', projectId)
      .select()
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 })
    }

    return NextResponse.json({ asset: updated, regenerated: true })
  } catch (error) {
    console.error('[assets/regenerate] Error:', error)
    return NextResponse.json({ error: 'Regeneration failed' }, { status: 500 })
  }
}
