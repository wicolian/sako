'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EditorShell } from '@/components/editor/editor-shell'
import { Loader2 } from 'lucide-react'
import type { WebsiteDesign } from '@/lib/website/ai-designer'

export default function EditorPage() {
  const params = useParams()
  const designId = params.designId as string
  const [design, setDesign] = useState<WebsiteDesign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDesign() {
      // Handle "new" design case
      if (designId === 'new') {
        setDesign({
          id: 'new',
          workspace_id: '',
          name: 'Untitled Design',
          sections: [],
          globalStyles: {
            colorScheme: 'light',
            primaryColor: '#6366f1',
            secondaryColor: '#8b5cf6',
            accentColor: '#f59e0b',
            fontHeading: 'Inter',
            fontBody: 'Inter',
            borderRadius: 'medium',
            buttonStyle: 'solid',
          },
          seoMeta: {
            title: '',
            description: '',
          },
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()
        const { data, error: fetchError } = await supabase
          .from('website_designs')
          .select('*')
          .eq('id', designId)
          .single() as { data: Record<string, unknown> | null; error: Error | null }

        if (fetchError) throw fetchError
        if (!data) throw new Error('Design not found')

        setDesign({
          id: data.id as string,
          workspace_id: data.workspace_id as string,
          name: data.name as string,
          description: data.description as string | undefined,
          brand_id: data.brand_id as string | undefined,
          sections: (data.sections as WebsiteDesign['sections']) || [],
          globalStyles: (data.global_styles as WebsiteDesign['globalStyles']) || {
            colorScheme: 'light',
            primaryColor: '#6366f1',
            fontHeading: 'Inter',
            fontBody: 'Inter',
            borderRadius: 'medium',
            buttonStyle: 'solid',
          },
          seoMeta: (data.seo_meta as WebsiteDesign['seoMeta']) || { title: '', description: '' },
          status: data.status as WebsiteDesign['status'],
          published_url: data.published_url as string | undefined,
          created_at: data.created_at as string,
          updated_at: data.updated_at as string,
        })
      } catch (err) {
        console.error('Failed to load design:', err)
        setError('Failed to load design')
      } finally {
        setLoading(false)
      }
    }

    loadDesign()
  }, [designId])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !design) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Design not found</h2>
          <p className="text-muted-foreground">{error || 'Unable to load design'}</p>
        </div>
      </div>
    )
  }

  return <EditorShell initialDesign={design} />
}
