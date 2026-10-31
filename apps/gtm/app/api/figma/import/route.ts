import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { createFigmaClient, parseFigmaUrl } from '@/lib/figma/figma-client'
import { parseFigmaPage } from '@/lib/figma/figma-parser'
import type { WebsiteDesign } from '@/lib/website/ai-designer'

const RequestSchema = z.object({
  figmaUrl: z.string().url(),
  accessToken: z.string().optional(),
  workspaceId: z.string(),
  name: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { figmaUrl, accessToken, workspaceId, name } = RequestSchema.parse(body)

    // Parse the Figma URL
    const parsed = parseFigmaUrl(figmaUrl)
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid Figma URL. Please use a URL like https://www.figma.com/file/ABC123/...' },
        { status: 400 }
      )
    }

    // Get Figma access token from request or database
    let token = accessToken
    if (!token) {
      const supabase = createServiceClient()
      const { data: connection } = await supabase
        .from('provider_connections')
        .select('credentials')
        .eq('workspace_id', workspaceId)
        .eq('provider', 'figma')
        .single()

      if (connection?.credentials) {
        const credentials = connection.credentials as { access_token?: string }
        token = credentials.access_token
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Figma access token required. Please connect your Figma account in settings or provide an access token.' },
        { status: 401 }
      )
    }

    // Create Figma client
    const figma = createFigmaClient(token)

    // Fetch the file or specific node
    let nodes
    if (parsed.nodeId) {
      const result = await figma.getNodes(parsed.fileKey, [parsed.nodeId])
      const nodeData = result.nodes[parsed.nodeId]
      if (!nodeData) {
        return NextResponse.json(
          { error: 'Node not found in Figma file' },
          { status: 404 }
        )
      }
      nodes = [nodeData.document]
    } else {
      const file = await figma.getFile(parsed.fileKey)
      // Get the first page's children (frames)
      const firstPage = file.document.children?.[0]
      if (!firstPage?.children) {
        return NextResponse.json(
          { error: 'No frames found in Figma file' },
          { status: 404 }
        )
      }
      nodes = firstPage.children
    }

    // Parse nodes into sections
    const parsedDesign = parseFigmaPage(nodes)

    // Create the WebsiteDesign
    const design: Omit<WebsiteDesign, 'id' | 'created_at' | 'updated_at'> = {
      workspace_id: workspaceId,
      name: name || parsedDesign.name || 'Imported from Figma',
      description: `Imported from Figma: ${figmaUrl}`,
      sections: parsedDesign.sections,
      globalStyles: parsedDesign.globalStyles,
      seoMeta: {
        title: name || parsedDesign.name || 'Imported Design',
        description: '',
      },
      status: 'draft',
    }

    // Save to database
    const supabase = createServiceClient()
    const { data: savedDesign, error: saveError } = await supabase
      .from('website_designs')
      .insert({
        workspace_id: design.workspace_id,
        name: design.name,
        description: design.description,
        sections: design.sections,
        global_styles: design.globalStyles,
        seo_meta: design.seoMeta,
        status: 'draft',
      })
      .select()
      .single()

    if (saveError) {
      throw saveError
    }

    return NextResponse.json({
      id: savedDesign.id,
      name: savedDesign.name,
      sections: parsedDesign.sections.length,
      extractedColors: parsedDesign.extractedColors,
      extractedFonts: parsedDesign.extractedFonts,
    })
  } catch (error) {
    console.error('Figma import failed:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import from Figma' },
      { status: 500 }
    )
  }
}
