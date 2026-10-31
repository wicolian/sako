import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { POST as sendToSakoEscalate } from '@/app/api/sako/escalate/route'
import { getWorkspaceContext } from '@/lib/workspace'

const SendToSakoSchema = z.object({
  versionId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(5000).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent', 'rush']).optional(),
  idempotencyKey: z.string().trim().min(8).max(255),
})

/**
 * POST /api/composer/documents/:id/send-to-sako
 * Alias endpoint for Send to Sako using composer document id.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Ensures only authenticated workspace members can send.
    getWorkspaceContext(request)

    const { id: composerDocumentId } = await params
    const payload = SendToSakoSchema.parse(await request.json())

    const forwarded = new Request(new URL('/api/sako/escalate', request.url), {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        composerDocumentId,
        versionId: payload.versionId,
        title: payload.title,
        notes: payload.notes,
        priority: payload.priority,
        idempotencyKey: payload.idempotencyKey,
      }),
    })

    return sendToSakoEscalate(forwarded as NextRequest)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0]?.message || 'Invalid request payload' },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.name === 'WorkspaceError') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { success: false, message: 'Failed to send composer document to Sako' },
      { status: 500 }
    )
  }
}
