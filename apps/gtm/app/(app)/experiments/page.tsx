import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ABTestPanel } from '@/components/experiments/ab-test-panel'
import { FlaskConical } from 'lucide-react'

export const metadata = {
  title: 'A/B Experiments | Sako Composer',
  description: 'Run experiments to optimize your campaigns',
}

export default async function ExperimentsPage() {
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
          <FlaskConical className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
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
      <div className="max-w-5xl mx-auto py-8 px-6">
        <Suspense fallback={
          <div className="flex items-center justify-center h-96">
            <div className="animate-pulse text-muted-foreground">
              Loading experiments...
            </div>
          </div>
        }>
          <ABTestPanel workspaceId={workspace.id} />
        </Suspense>
      </div>
    </div>
  )
}
