import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback, handleWorkspaceError } from '@/lib/workspace'
import { z } from 'zod'

const CreateCampaignSchema = z.object({
  name: z.string().trim().min(1, 'Campaign name is required'),
  audience: z.string().trim().optional().nullable(),
  goal: z.string().trim().optional().nullable(),
  offer: z.string().trim().optional().nullable(),
  cta: z.string().trim().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  constraints: z.record(z.string(), z.unknown()).optional().nullable(),
})

export async function GET(request: NextRequest) {
  let workspaceId: string
  try {
    workspaceId = getWorkspaceIdWithFallback(request)
  } catch (err) {
    return handleWorkspaceError(err)
  }
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  let workspaceId: string
  try {
    workspaceId = getWorkspaceIdWithFallback(request)
  } catch (err) {
    return handleWorkspaceError(err)
  }
  const supabase = createServiceClient()
  const body = await request.json()
  const parsed = CreateCampaignSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid campaign payload' }, { status: 400 })
  }

  const constraints = parsed.data.constraints ?? null
  
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      workspace_id: workspaceId,
      name: parsed.data.name,
      audience: parsed.data.audience ?? null,
      goal: parsed.data.goal ?? null,
      offer: parsed.data.offer ?? null,
      cta: parsed.data.cta ?? null,
      brand_id: parsed.data.brandId ?? null,
      constraints,
      status: 'draft',
    } as Record<string, unknown>)
    .select()
    .maybeSingle()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}
