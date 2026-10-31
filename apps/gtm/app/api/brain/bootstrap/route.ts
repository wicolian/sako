import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'
import { bootstrapBrain } from '@/lib/brain/service'

const BootstrapSchema = z.object({
  workspaceName: z.string().min(1),
  industry: z.string().optional(),
  brandName: z.string().optional(),
  brandId: z.string().uuid().optional(),
  targetChannels: z.array(z.string()).default([]),
  approvalRules: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
  autoApproveLowRisk: z.boolean().optional(),
  sources: z.array(
    z.object({
      sourceType: z.enum(['url', 'webflow', 'framer', 'notion', 'github', 'file_upload', 'manual']),
      displayName: z.string().min(1),
      connectionRef: z.string().optional(),
      externalId: z.string().optional(),
      config: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
    }),
  ).min(1),
})

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, userId } = getWorkspaceContext(request)
    const body = BootstrapSchema.parse(await request.json())
    const result = await bootstrapBrain(workspaceId, userId, body)

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid bootstrap payload', details: error.errors }, { status: 400 })
    }
    try {
      return handleWorkspaceError(error)
    } catch {
      console.error('[brain/bootstrap]', error)
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to bootstrap brain' }, { status: 500 })
    }
  }
}
