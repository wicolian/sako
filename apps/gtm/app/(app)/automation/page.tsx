/**
 * Automation Dashboard
 *
 * Route: /automation
 * Rules management with on/off toggles and preset creation.
 */

import { createClient } from '@/lib/supabase/server'
import { getWorkspaceFromHeaders } from '@/lib/workspace'
import { redirect } from 'next/navigation'
import { AutomationDashboardClient } from './automation-client'
import { Clock } from 'lucide-react'

export default async function AutomationPage() {
  const supabase = await createClient()
  const workspace = await getWorkspaceFromHeaders()

  if (!workspace?.workspaceId) {
    redirect('/login')
  }

  // Fetch automation rules
  const { data: rules } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('workspace_id', workspace.workspaceId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  // Fetch pending content count
  const { count: pendingCount } = await supabase
    .from('scheduled_content')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspace.workspaceId)
    .eq('status', 'pending_review')

  // Fetch brands for the dropdown
  const { data: brands } = await supabase
    .from('brands')
    .select('id, name')
    .eq('workspace_id', workspace.workspaceId)
    .order('name')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-8 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Automation Playbooks</h1>
            <p className="text-muted-foreground mt-1">
              Schedule recurring content generation with approval gates.
            </p>
          </div>
          {(pendingCount ?? 0) > 0 && (
            <a
              href="/automation/queue"
              className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary font-medium text-sm rounded-xl border border-primary/20 hover:bg-primary/20 transition-colors shadow-sm"
            >
              <Clock className="w-4 h-4" />
              Review Queue
              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full ml-1">
                {pendingCount}
              </span>
            </a>
          )}
        </div>

        <AutomationDashboardClient
          initialRules={rules ?? []}
          brands={brands ?? []}
          workspaceId={workspace.workspaceId}
        />
      </div>
    </div>
  )
}
