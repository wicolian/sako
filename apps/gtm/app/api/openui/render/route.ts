import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  source: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source } = RequestSchema.parse(body)
    // Load lazily: this module uses React client APIs that break page-data collection.
    const { renderOpenUiToHtml } = await import('@/lib/openui/html')
    const rendered = renderOpenUiToHtml(source)

    return NextResponse.json({
      html: rendered.html,
      parseResult: rendered.parseResult,
    })
  } catch (error) {
    console.error('OpenUI HTML render failed:', error)
    return NextResponse.json({ error: 'Failed to render OpenUI HTML' }, { status: 500 })
  }
}
