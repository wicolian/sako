/**
 * Content Review Queue
 *
 * Route: /automation/queue
 * Pending content with approve/edit/reject actions.
 */

import { createClient } from '@/lib/supabase/server'
import { getWorkspaceFromHeaders } from '@/lib/workspace'
import { redirect } from 'next/navigation'
import { ContentQueueClient } from './queue-client'

export default async function ContentQueuePage() {
  const supabase = await createClient()
  const workspace = await getWorkspaceFromHeaders()

  if (!workspace?.workspaceId) {
    redirect('/login')
  }

  // Fetch scheduled content with asset documents
  const { data: items } = await supabase
    .from('scheduled_content')
    .select(`
      *,
      asset_documents (id, title, asset_type, channel, html, compliance_status, dimensions, rendered_image_url)
    `)
    .eq('workspace_id', workspace.workspaceId)
    .in('status', ['pending_review', 'approved'])
    .order('scheduled_for', { ascending: true })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Content Queue</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Review, edit, or approve generated content before publishing.
            </p>
          </div>
          <a
            href="/automation"
            className="text-sm text-muted-foreground hover:text-foreground/90"
          >
            ← Back to Automations
          </a>
        </div>

        <ContentQueueClient items={items ?? []} />
      </div>
    </div>
  )
}
