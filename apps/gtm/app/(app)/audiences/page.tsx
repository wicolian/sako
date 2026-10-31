import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AudienceManager } from '@/components/audiences/audience-manager'
import { Target } from 'lucide-react'

export const metadata = {
  title: 'Audiences | Sako Composer',
  description: 'Manage customer segment profiles for targeted campaigns',
}

export default async function AudiencesPage() {
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
          <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
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
      <div className="max-w-6xl mx-auto py-8 px-6">
        <Suspense fallback={
          <div className="flex items-center justify-center h-96">
            <div className="animate-pulse text-muted-foreground">
              Loading audiences...
            </div>
          </div>
        }>
          <AudienceManager workspaceId={workspace.id} />
        </Suspense>
      </div>
    </div>
  )
}
