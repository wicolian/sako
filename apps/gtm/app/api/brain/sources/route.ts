import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createBrainSource, listBrainSources, syncBrainSource } from '@/lib/brain/service'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'

const CreateBrainSourceSchema = z.object({
  brandId: z.string().uuid().optional(),
  sourceType: z.enum(['url', 'webflow', 'framer', 'notion', 'github', 'file_upload', 'manual']),
  connectionRef: z.string().optional(),
  externalId: z.string().optional(),
  displayName: z.string().min(1),
  config: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
  syncNow: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = getWorkspaceContext(request)
    const sources = await listBrainSources(workspaceId)
    return NextResponse.json({ sources })
  } catch (error) {
    try {
      return handleWorkspaceError(error)
    } catch {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load sources' }, { status: 500 })
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, userId } = getWorkspaceContext(request)
    const body = CreateBrainSourceSchema.parse(await request.json())
    const source = await createBrainSource({
      workspaceId,
      brandId: body.brandId,
      sourceType: body.sourceType,
      connectionRef: body.connectionRef,
      externalId: body.externalId,
      displayName: body.displayName,
      config: body.config,
    })

    let sync = null
    if (body.syncNow) {
      sync = await syncBrainSource(workspaceId, source.id, { createdBy: userId })
    }

    return NextResponse.json({ source, sync }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid source payload', details: error.errors }, { status: 400 })
    }
    try {
      return handleWorkspaceError(error)
    } catch {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create source' }, { status: 500 })
    }
  }
}
