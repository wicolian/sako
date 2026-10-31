/**
 * POST /api/render/pdf
 *
 * Render HTML to PDF via Playwright (complex layouts, multi-slide decks).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { renderHtmlToPdf, renderDeckToPdf } from '@/lib/render/pdf-renderer'
import { getWorkspaceId } from '@/lib/workspace'

const RenderPdfSchema = z.object({
  html: z.string().min(1).optional(),
  slides: z.array(z.string()).optional(),
  format: z.enum(['A4', 'Letter', 'custom']).default('A4'),
  width: z.number().optional(),
  height: z.number().optional(),
  landscape: z.boolean().default(false),
  brandCSS: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const input = RenderPdfSchema.parse(body)

    let result

    if (input.slides?.length) {
      // Multi-slide deck PDF
      result = await renderDeckToPdf(input.slides, {
        width: input.width,
        height: input.height,
        brandCSS: input.brandCSS,
      })
    } else if (input.html) {
      // Single page PDF
      result = await renderHtmlToPdf(input.html, {
        format: input.format,
        width: input.width,
        height: input.height,
        landscape: input.landscape,
        printBackground: true,
      })
    } else {
      return NextResponse.json(
        { error: 'Either html or slides must be provided' },
        { status: 400 }
      )
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(result.fileSize),
        'Content-Disposition': 'attachment; filename="export.pdf"',
        'X-Page-Count': String(result.pageCount),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[render/pdf] Error:', error)
    return NextResponse.json(
      { error: 'Render failed' },
      { status: 500 }
    )
  }
}
