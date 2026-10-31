import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { VisualWorkflowBuilder } from '@/components/workflows/visual-workflow-builder'
import { GitBranch } from 'lucide-react'

export const metadata = {
  title: 'Workflows | Sako Composer',
  description: 'Build visual automation workflows for your campaigns',
}

export default async function WorkflowsPage() {
  const supabase = await createServerSupabaseClient()

  // Get current workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .single()

  if (!workspace) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium mb-2">No workspace found</h2>
          <p className="text-muted-foreground">
            Please complete onboarding first.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-full mx-auto py-6 px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-primary" />
            Workflow Builder
          </h1>
          <p className="text-muted-foreground mt-1">
            Create visual automation flows for your campaign processes
          </p>
        </div>

        <Suspense fallback={
          <div className="flex items-center justify-center h-96">
            <div className="animate-pulse text-muted-foreground">
              Loading workflow builder...
            </div>
          </div>
        }>
          <VisualWorkflowBuilder workspaceId={workspace.id} />
        </Suspense>
      </div>
    </div>
  )
}
