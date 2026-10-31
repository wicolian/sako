import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { exportToFigma } from '@/lib/figma/figma-exporter'
import type { WebsiteDesign } from '@/lib/website/ai-designer'

const RequestSchema = z.object({
  designId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { designId } = RequestSchema.parse(body)

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

    // Generate Figma export
    const result = exportToFigma(design)

    return NextResponse.json({
      script: result.script,
      instructions: result.instructions,
      designName: design.name,
    })
  } catch (error) {
    console.error('Figma export failed:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to export to Figma' },
      { status: 500 }
    )
  }
}
