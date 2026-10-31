/**
 * POST /api/brand-memory/rebuild
 *
 * Reverse-import: accept user-provided HTML/assets → extract tokens
 * → update brand memory. Enables learning from user's existing materials.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceId } from '@/lib/workspace'
import { createServiceClient } from '@/lib/supabase/service'

const RebuildSchema = z.object({
  brandId: z.string().uuid(),
  html: z.string().optional(),
  assetUrl: z.string().url().optional(),
  source: z.enum(['user_upload', 'reverse_import', 'asset_edit']).default('user_upload'),
  colors: z.array(
    z.object({
      value: z.string(),
      role: z.string(),
      format: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
      source: z.string().optional(),
    })
  ).optional(),
  fonts: z.array(
    z.object({
      family: z.string(),
      role: z.string(),
      weight: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
      source: z.string().optional(),
    })
  ).optional(),
  tone: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  keyMessages: z.array(z.string()).optional(),
  preferredTerms: z.array(z.string()).optional(),
  bannedTerms: z.array(z.string()).optional(),
})

export async function POST(request: NextRequest) {
  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const input = RebuildSchema.parse(body)
    const supabase = createServiceClient()

    // Extract tokens from direct payload or the provided HTML
    const extractedTokens = input.colors || input.fonts
      ? {
          colors: (input.colors ?? []).map((c) => ({
            value: c.value,
            role: c.role,
            confidence: c.confidence ?? 0.8,
            source: c.source ?? input.source,
            format: c.format,
          })),
          fonts: (input.fonts ?? []).map((f) => ({
            family: f.family,
            role: f.role,
            confidence: f.confidence ?? 0.8,
            source: f.source ?? input.source,
            weight: f.weight,
          })),
        }
      : extractTokensFromHtml(input.html ?? '')

    // Fetch existing brand memory
    const { data: existing } = await supabase
      .from('brand_memory')
      .select('*')
      .eq('brand_id', input.brandId)
      .eq('workspace_id', workspaceId)
      .single()

    if (existing) {
      // Merge extracted tokens with existing memory
      const mergedColors = mergeTokens(
        existing.colors as Array<Record<string, unknown>>,
        extractedTokens.colors,
        'value'
      )
      const mergedFonts = mergeTokens(
        existing.fonts as Array<Record<string, unknown>>,
        extractedTokens.fonts,
        'family'
      )

      const sources = [
        ...((existing.sources as Array<Record<string, unknown>>) ?? []),
        {
          type: input.source,
          date: new Date().toISOString(),
          confidence: 0.7,
        },
      ]

      const { error } = await supabase
        .from('brand_memory')
        .update({
          colors: mergedColors,
          fonts: mergedFonts,
          tone: input.tone ?? (existing.tone as Record<string, unknown> | null) ?? {},
          key_messages: input.keyMessages ?? (existing.key_messages as string[] | null) ?? [],
          preferred_terms: input.preferredTerms ?? (existing.preferred_terms as string[] | null) ?? [],
          banned_terms: input.bannedTerms ?? (existing.banned_terms as string[] | null) ?? [],
          sources,
          version: (existing.version as number ?? 0) + 1,
        })
        .eq('id', existing.id)

      if (error) throw error
    } else {
      // Create new brand memory from extracted tokens
      const { error } = await supabase.from('brand_memory').insert({
        brand_id: input.brandId,
        workspace_id: workspaceId,
          colors: extractedTokens.colors,
          fonts: extractedTokens.fonts,
          tone: input.tone ?? {},
          key_messages: input.keyMessages ?? [],
          preferred_terms: input.preferredTerms ?? [],
          banned_terms: input.bannedTerms ?? [],
          sources: [
            {
              type: input.source,
            date: new Date().toISOString(),
            confidence: 0.7,
          },
        ],
      })

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('[brand-memory/rebuild] Error:', error)
    return NextResponse.json({ error: 'Failed to rebuild brand memory' }, { status: 500 })
  }
}

// ============================================================================
// Token extraction from HTML
// ============================================================================

function extractTokensFromHtml(html: string): {
  colors: Array<{ value: string; role: string; confidence: number; source: string }>
  fonts: Array<{ family: string; role: string; confidence: number; source: string }>
} {
  const colors: Array<{ value: string; role: string; confidence: number; source: string }> = []
  const fonts: Array<{ family: string; role: string; confidence: number; source: string }> = []

  // Extract hex colors
  const hexMatches = html.match(/#[0-9a-fA-F]{3,8}/g) ?? []
  const colorFreq = new Map<string, number>()
  for (const color of hexMatches) {
    const normalized = color.toLowerCase()
    colorFreq.set(normalized, (colorFreq.get(normalized) ?? 0) + 1)
  }

  // Sort by frequency and assign roles
  const sortedColors = [...colorFreq.entries()].sort((a, b) => b[1] - a[1])
  const roles = ['primary', 'secondary', 'accent', 'background', 'text']
  for (let i = 0; i < Math.min(sortedColors.length, 5); i++) {
    colors.push({
      value: sortedColors[i][0],
      role: roles[i],
      confidence: 0.6,
      source: 'reverse_import',
    })
  }

  // Extract font families
  const fontMatches = html.match(/font-family:\s*['"]?([^'",;]+)/gi) ?? []
  const fontFreq = new Map<string, number>()
  for (const match of fontMatches) {
    const family = match.replace(/font-family:\s*['"]?/i, '').trim()
    if (family && family !== 'system-ui' && family !== 'sans-serif' && family !== 'inherit') {
      fontFreq.set(family, (fontFreq.get(family) ?? 0) + 1)
    }
  }

  const sortedFonts = [...fontFreq.entries()].sort((a, b) => b[1] - a[1])
  if (sortedFonts.length > 0) {
    fonts.push({ family: sortedFonts[0][0], role: 'heading', confidence: 0.6, source: 'reverse_import' })
  }
  if (sortedFonts.length > 1) {
    fonts.push({ family: sortedFonts[1][0], role: 'body', confidence: 0.6, source: 'reverse_import' })
  } else if (sortedFonts.length > 0) {
    fonts.push({ family: sortedFonts[0][0], role: 'body', confidence: 0.5, source: 'reverse_import' })
  }

  return { colors, fonts }
}

function mergeTokens(
  existing: Array<Record<string, unknown>>,
  incoming: Array<Record<string, unknown>>,
  keyField: string
): Array<Record<string, unknown>> {
  const merged = [...(existing ?? [])]
  for (const item of incoming) {
    const existingIdx = merged.findIndex((e) => e[keyField] === item[keyField])
    if (existingIdx >= 0) {
      // Increase confidence if seen again
      const existingConf = (merged[existingIdx].confidence as number) ?? 0.5
      merged[existingIdx] = { ...merged[existingIdx], ...item, confidence: Math.min(existingConf + 0.1, 1.0) }
    } else {
      merged.push(item)
    }
  }
  return merged
}
