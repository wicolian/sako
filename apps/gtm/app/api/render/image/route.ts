/**
 * POST /api/render/image
 *
 * Render HTML to image (PNG/JPG/SVG) via Satori + resvg-js.
 * For social posts, ads, slides, and simple visual assets.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { renderHtmlToImage } from '@/lib/render/html-renderer'
import { getWorkspaceId } from '@/lib/workspace'

const RenderImageSchema = z.object({
  html: z.string().min(1),
  width: z.number().int().min(100).max(4096),
  height: z.number().int().min(100).max(4096),
  format: z.enum(['png', 'jpg', 'svg']).default('png'),
  scale: z.number().min(0.5).max(3).default(1),
  backgroundColor: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const input = RenderImageSchema.parse(body)

    const result = await renderHtmlToImage(input.html, {
      width: input.width,
      height: input.height,
      format: input.format,
      scale: input.scale,
      backgroundColor: input.backgroundColor,
    })

    const contentType =
      result.format === 'svg'
        ? 'image/svg+xml'
        : result.format === 'jpg'
          ? 'image/jpeg'
          : 'image/png'

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(result.fileSize),
        'X-Render-Width': String(result.width),
        'X-Render-Height': String(result.height),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[render/image] Error:', error)
    return NextResponse.json(
      { error: 'Render failed' },
      { status: 500 }
    )
  }
}
