import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { ingestTemplatesFromDirectory, getTemplateStats, generateMissingEmbeddingsBatch } from '@/lib/templates/ingestion'

/**
 * POST /api/templates/ingest
 * Trigger template ingestion from the template directory
 * Admin only - requires special permissions
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceContext(request)
    
    // TODO: Add admin check here
    // For now, just require a workspace
    if (!workspaceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { directory, action = 'ingest' } = body

    if (action === 'stats') {
      const stats = await getTemplateStats()
      return NextResponse.json(stats)
    }

    if (action === 'embeddings') {
      const count = await generateMissingEmbeddingsBatch()
      return NextResponse.json({ updated: count, message: `Generated embeddings for ${count} sections` })
    }

    if (!directory) {
      return NextResponse.json(
        { error: 'Directory path required for ingestion' },
        { status: 400 }
      )
    }

    // Run ingestion
    const result = await ingestTemplatesFromDirectory(directory)

    return NextResponse.json({
      success: true,
      ...result,
      message: `Processed ${result.templatesProcessed} templates, created ${result.sectionsCreated} sections in ${(result.duration / 1000).toFixed(1)}s`,
    })
  } catch (error) {
    console.error('Template ingestion error:', error)
    return NextResponse.json(
      { error: 'Failed to ingest templates', details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const stats = await getTemplateStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Failed to get template stats:', error)
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    )
  }
}
