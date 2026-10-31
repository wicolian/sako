import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { StudioClient } from './studio-client'
import { Plus, Settings2, AppWindow, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'AI Studio | Sako Composer',
  description: 'Build custom AI workflows and generation tools.',
}

export default async function StudioPage() {
  const supabase = await createServerSupabaseClient()

  // Get current workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .single()

  if (!workspace) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="text-center">
          <Settings2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium mb-2">No workspace found</h2>
          <p className="text-muted-foreground">
            Please complete onboarding first.
          </p>
        </div>
      </div>
    )
  }

  // Fetch apps for this workspace
  const { data: apps } = await supabase
    .from('studio_apps')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('updated_at', { ascending: false })

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-8 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/20">
                <AppWindow className="w-5 h-5" />
              </div>
              Studio
            </h1>
            <p className="text-muted-foreground mt-2">
              Build custom AI generation tools and share them with your workspace.
            </p>
          </div>
          <Button size="lg" className="shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Create App
          </Button>
        </div>

        <Suspense fallback={
          <div className="flex items-center justify-center h-64 border border-border/50 rounded-3xl bg-card/40 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }>
          <StudioClient initialApps={apps || []} workspaceId={workspace.id} />
        </Suspense>
      </div>
    </div>
  )
}
