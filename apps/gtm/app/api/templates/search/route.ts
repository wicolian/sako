import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'
import { searchTemplates, getTemplatesByCategory, getTemplateCategories } from '@/lib/templates/retriever'

// GET /api/templates/search?q=...&category=...&theme=...
export async function GET(request: NextRequest) {
  try {
    getWorkspaceContext(request) // Ensure authenticated
    const { searchParams } = new URL(request.url)
    
    const query = searchParams.get('q')
    const category = searchParams.get('category')
    const theme = searchParams.get('theme') as 'light' | 'dark' | 'gradient' | 'glass' | null
    const layout = searchParams.get('layout') as 'centered' | 'split' | 'grid' | 'asymmetric' | 'stacked' | null
    const industry = searchParams.get('industry')?.split(',').filter(Boolean)
    const limit = parseInt(searchParams.get('limit') || '5')

    if (!query && !category) {
      // Return categories list
      const categories = await getTemplateCategories()
      return NextResponse.json({ categories })
    }

    if (category && !query) {
      // Return templates by category
      const templates = await getTemplatesByCategory(category, limit)
      return NextResponse.json({ templates })
    }

    // Semantic search
    const templates = await searchTemplates({
      prompt: query || '',
      category: category || undefined,
      style: theme || layout ? {
        theme: theme as any || undefined,
        layout: layout as any || undefined
      } : undefined,
      industry,
      topK: limit,
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Template search error:', error)
    return handleWorkspaceError(error)
  }
}

// POST /api/templates/search - Bulk search for page builder
export async function POST(request: NextRequest) {
  try {
    getWorkspaceContext(request)
    const { sections } = await request.json()

    // sections: Array<{ category: string; description?: string }>
    if (!Array.isArray(sections)) {
      return NextResponse.json({ error: 'sections array required' }, { status: 400 })
    }

    const results: Record<string, unknown[]> = {}

    for (const section of sections) {
      const templates = await searchTemplates({
        prompt: section.description || `${section.category} section for landing page`,
        category: section.category,
        topK: 3,
      })
      results[section.category] = templates
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Bulk template search error:', error)
    return handleWorkspaceError(error)
  }
}
