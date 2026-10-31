import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceIdWithFallback, handleWorkspaceError } from '@/lib/workspace'
import { buildGenerationPlan } from '@/lib/planning/generation-plan'
import { type DesignDirection } from '@/lib/design/archetype-selector'

const CampaignPlanSchema = z.object({
  name: z.string().optional().nullable(),
  audience: z.string().optional().nullable(),
  goal: z.string().optional().nullable(),
  offer: z.string().optional().nullable(),
  cta: z.string().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  assetTypes: z.array(z.string()).optional(),
  designDirection: z
    .enum(['auto', 'trust', 'product', 'editorial', 'technical', 'conversion'])
    .optional(),
  constraints: z
    .object({
      mustInclude: z.array(z.string()).optional(),
      mustAvoid: z.array(z.string()).optional(),
    })
    .optional()
    .nullable(),
})

export async function POST(request: NextRequest) {
  let workspaceId: string
  try {
    workspaceId = getWorkspaceIdWithFallback(request)
  } catch (err) {
    return handleWorkspaceError(err)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CampaignPlanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid planning payload' },
      { status: 400 },
    )
  }

  const data = parsed.data
  const plan = await buildGenerationPlan({
    workspaceId,
    brandId: data.brandId ?? undefined,
    designDirection: data.designDirection as DesignDirection | undefined,
    assetTypes: data.assetTypes,
    brief: {
      name: data.name,
      audience: data.audience,
      goal: data.goal,
      offer: data.offer,
      cta: data.cta,
      constraints: data.constraints ?? undefined,
    },
  })

  return NextResponse.json({ plan })
}
