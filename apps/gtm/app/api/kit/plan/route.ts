import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceIdWithFallback, handleWorkspaceError } from '@/lib/workspace'
import { buildGenerationPlan } from '@/lib/planning/generation-plan'
import { type DesignDirection } from '@/lib/design/archetype-selector'

const KitPlanSchema = z.object({
  brief: z.object({
    launchType: z.enum(['product', 'feature', 'campaign', 'event', 'webinar']).optional(),
    audience: z.string().optional().nullable(),
    offer: z.string().optional().nullable(),
    cta: z.string().optional().nullable(),
    brandId: z.string().uuid().optional().nullable(),
    constraints: z
      .object({
        mustInclude: z.array(z.string()).optional(),
        mustAvoid: z.array(z.string()).optional(),
      })
      .optional()
      .nullable(),
  }),
  options: z
    .object({
      designDirection: z
        .enum(['auto', 'trust', 'product', 'editorial', 'technical', 'conversion'])
        .optional(),
    })
    .optional(),
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

  const parsed = KitPlanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid planning payload' },
      { status: 400 },
    )
  }

  const { brief, options } = parsed.data
  const plan = await buildGenerationPlan({
    workspaceId,
    brandId: brief.brandId ?? undefined,
    designDirection: options?.designDirection as DesignDirection | undefined,
    assetTypes: ['landing-page', 'email', 'social', 'deck'],
    brief: {
      name: brief.offer,
      audience: brief.audience,
      goal: brief.launchType ? `${brief.launchType} launch` : undefined,
      offer: brief.offer,
      cta: brief.cta,
      constraints: brief.constraints ?? undefined,
    },
  })

  return NextResponse.json({ plan })
}
