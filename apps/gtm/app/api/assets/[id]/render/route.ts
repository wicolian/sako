/**
 * POST /api/assets/[id]/render
 *
 * Render an existing AssetDocument to chosen format.
 * Checks compliance status before allowing render.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceId } from '@/lib/workspace'
import { getAssetDocument } from '@/lib/assets/asset-document-adapter'
import { renderHtmlToImage } from '@/lib/render/html-renderer'
import { renderHtmlToPdf } from '@/lib/render/pdf-renderer'

const RenderSchema = z.object({
  format: z.enum(['png', 'jpg', 'pdf', 'html']),
  width: z.number().optional(),
  height: z.number().optional(),
  scale: z.number().min(0.5).max(3).default(1),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const input = RenderSchema.parse(body)

    // Fetch the asset document
    const doc = await getAssetDocument(id)
    if (!doc) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }
    if (doc.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Compliance gate: block render if blocked
    if (doc.complianceStatus === 'blocked') {
      return NextResponse.json(
        {
          error: 'Cannot render: Unresolved high-risk claims',
          complianceStatus: 'blocked',
          blockedClaims: doc.claims.filter(
            (c) => c.riskScore >= 70 && c.status !== 'verified' && c.status !== 'overridden'
          ),
        },
        { status: 403 }
      )
    }

    const width = input.width ?? doc.dimensions?.width ?? 1200
    const height = input.height ?? doc.dimensions?.height ?? 627

    if (input.format === 'html') {
      return new NextResponse(doc.html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    }

    if (input.format === 'pdf') {
      const result = await renderHtmlToPdf(doc.html, {
        format: 'custom',
        width,
        height,
        printBackground: true,
      })
      return new NextResponse(new Uint8Array(result.buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${doc.title ?? 'asset'}.pdf"`,
        },
      })
    }

    // PNG or JPG
    const result = await renderHtmlToImage(doc.html, {
      width,
      height,
      format: input.format,
      scale: input.scale,
    })

    const contentType = result.format === 'jpg' ? 'image/jpeg' : 'image/png'
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${doc.title ?? 'asset'}.${result.format}"`,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[assets/render] Error:', error)
    return NextResponse.json({ error: 'Render failed' }, { status: 500 })
  }
}
