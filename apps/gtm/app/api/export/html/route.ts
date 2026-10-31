import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { bundleWebsite, type BundleOptions } from '@/lib/export/asset-bundler'
import { exportToHtml } from '@/lib/export/html-exporter'
import type { WebsiteDesign } from '@/lib/website/ai-designer'

const RequestSchema = z.object({
  designId: z.string(),
  format: z.enum(['html', 'zip']).default('zip'),
  minify: z.boolean().default(false),
  includeAnalytics: z.boolean().default(false),
  analyticsId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { designId, format, minify, includeAnalytics, analyticsId } = RequestSchema.parse(body)

    const supabase = createServiceClient()

    // Fetch the design
    const { data: dbDesign, error } = await supabase
      .from('website_designs')
      .select('*')
      .eq('id', designId)
      .single()

    if (error || !dbDesign) {
      return NextResponse.json(
        { error: 'Design not found' },
        { status: 404 }
      )
    }

    // Convert to WebsiteDesign type
    const design: WebsiteDesign = {
      id: dbDesign.id,
      workspace_id: dbDesign.workspace_id,
      name: dbDesign.name,
      description: dbDesign.description,
      brand_id: dbDesign.brand_id,
      sections: dbDesign.sections || [],
      globalStyles: dbDesign.global_styles || {
        colorScheme: 'light',
        primaryColor: '#6366f1',
        fontHeading: 'Inter',
        fontBody: 'Inter',
        borderRadius: 'medium',
        buttonStyle: 'solid',
      },
      seoMeta: dbDesign.seo_meta || { title: '', description: '' },
      status: dbDesign.status,
      published_url: dbDesign.published_url,
      created_at: dbDesign.created_at,
      updated_at: dbDesign.updated_at,
    }

    const options: BundleOptions = {
      minify,
      includeAnalytics,
      analyticsId,
    }

    if (format === 'html') {
      // Return just the HTML file
      const html = exportToHtml(design, options)
      
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${slugify(design.name)}.html"`,
        },
      })
    }

    // Return ZIP bundle
    const bundle = await bundleWebsite(design, options)

    return new NextResponse(new Uint8Array(bundle.zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${bundle.filename}"`,
        'Content-Length': String(bundle.size),
      },
    })
  } catch (error) {
    console.error('Export failed:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    )
  }
}

// Also support GET for direct downloads
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const designId = searchParams.get('designId')
  const format = searchParams.get('format') as 'html' | 'zip' || 'zip'

  if (!designId) {
    return NextResponse.json(
      { error: 'Missing designId parameter' },
      { status: 400 }
    )
  }

  // Reuse POST logic
  const mockRequest = new Request(request.url, {
    method: 'POST',
    body: JSON.stringify({
      designId,
      format,
      minify: searchParams.get('minify') === 'true',
    }),
  })

  return POST(mockRequest as NextRequest)
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
