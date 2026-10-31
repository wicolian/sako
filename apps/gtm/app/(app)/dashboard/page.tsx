import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getWorkspaceFromHeaders } from '@/lib/workspace'
import DashboardClient from './dashboard-client'

export const metadata = {
  title: 'Dashboard - Sako Composer',
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Redirect or handle unauth
    return null
  }

  const workspaceContext = await getWorkspaceFromHeaders()
  const workspaceId = workspaceContext?.workspaceId

  if (!workspaceId) {
    return null // or handle no workspace
  }

  // Fetch all stats in parallel (server-side)
  const [
    workspaceResult,
    campaignsResult,
    claimsResult,
    recentCampaignsResult,
  ] = await Promise.all([
    supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single(),

    supabase
      .from('campaigns')
      .select('id, status', { count: 'exact' })
      .eq('workspace_id', workspaceId),
    
    supabase
      .from('claims')
      .select('id, status', { count: 'exact' })
      .eq('workspace_id', workspaceId),
    
    supabase
      .from('campaigns')
      .select('id, name, status, updated_at')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(5),
  ])

  const campaigns = campaignsResult.data || []
  const campaignStats = {
    total: campaignsResult.count || 0,
    draft: campaigns.filter(c => c.status === 'draft').length,
    ready: campaigns.filter(c => c.status === 'ready').length,
    published: campaigns.filter(c => c.status === 'published').length,
    running: campaigns.filter(c => c.status === 'running').length,
    archived: campaigns.filter(c => c.status === 'archived').length,
  }

  const claims = claimsResult.data || []
  const healthStats = {
    pendingReview: claims.filter(c => c.status === 'needs_proof').length,
    blocked: claims.filter(c => c.status === 'blocked').length,
  }

  const recentCampaigns = recentCampaignsResult.data || []
  const workspaceName = workspaceResult.data?.name || "My Workspace"

  return (
    <DashboardClient 
      user={{ email: user.email }}
      workspace={{ name: workspaceName }}
      campaignStats={campaignStats}
      healthStats={healthStats}
      recentCampaigns={recentCampaigns}
    />
  )
}
