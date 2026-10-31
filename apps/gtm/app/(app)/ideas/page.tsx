import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { IdeasExperience } from '@/components/ideas/ideas-experience'
import { Lightbulb } from 'lucide-react'

export const metadata = {
  title: 'Content Ideas | Sako Composer',
  description: 'Discover AI-generated content ideas for your campaigns',
}

export default async function IdeasPage() {
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
          <Lightbulb className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium mb-2">No workspace found</h2>
          <p className="text-muted-foreground">
            Please complete onboarding first.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[300px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="max-w-2xl mx-auto py-12 px-6 relative z-10">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 mb-6 shadow-[0_0_40px_-10px_rgba(132,204,22,0.5)] border border-primary/20">
            <Lightbulb className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Content Ideas
          </h1>
          <p className="text-lg text-muted-foreground mt-3">
            Swipe through AI-generated ideas for your next campaign.
          </p>
        </div>

        <Suspense fallback={
          <div className="flex items-center justify-center h-[500px] bg-card/40 backdrop-blur-sm border border-border/50 rounded-3xl">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-primary/50 border-t-primary animate-spin" />
              <div className="text-muted-foreground font-medium">Synthesizing ideas...</div>
            </div>
          </div>
        }>
          <IdeasExperience workspaceId={workspace.id} />
        </Suspense>
      </div>
    </div>
  )
}
