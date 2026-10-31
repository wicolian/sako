import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import { db } from '@/lib/db'

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
      .from('workspace_settings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Ensure JSON serializability by parsing JSON fields
    const sanitizedData = {
      ...data,
      forbidden_phrases: Array.isArray(data.forbidden_phrases)
        ? data.forbidden_phrases
        : JSON.parse(data.forbidden_phrases || '[]'),
      brand_colors: data.brand_colors ? JSON.parse(data.brand_colors) : null,
      brand_typography: data.brand_typography ? JSON.parse(data.brand_typography) : null,
      created_at: data.created_at?.toISOString?.() || data.created_at,
      updated_at: data.updated_at?.toISOString?.() || data.updated_at,
    }

    return NextResponse.json(sanitizedData)
  } catch (error) {
    console.error('Settings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = getWorkspaceIdWithFallback(request)

    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace' }, { status: 400 })
    }

    const body = await request.json()

    // Sanitize the body for JSON fields
    const sanitizedBody = {
      ...body,
      forbidden_phrases: body.forbidden_phrases ? JSON.stringify(body.forbidden_phrases) : undefined,
      brand_colors: body.brand_colors ? JSON.stringify(body.brand_colors) : undefined,
      brand_typography: body.brand_typography ? JSON.stringify(body.brand_typography) : undefined,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await db
      .from('workspace_settings')
      .update(sanitizedBody)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Sanitize response
    const sanitizedData = {
      ...data,
      forbidden_phrases: Array.isArray(data.forbidden_phrases)
        ? data.forbidden_phrases
        : JSON.parse(data.forbidden_phrases || '[]'),
      brand_colors: data.brand_colors ? JSON.parse(data.brand_colors) : null,
      brand_typography: data.brand_typography ? JSON.parse(data.brand_typography) : null,
      created_at: data.created_at?.toISOString?.() || data.created_at,
      updated_at: data.updated_at?.toISOString?.() || data.updated_at,
    }

    return NextResponse.json(sanitizedData)
  } catch (error) {
    console.error('Settings PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
