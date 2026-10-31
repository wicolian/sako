import { createServiceClient } from '@/lib/supabase/service'
import type { DeploymentProvider, ProviderCapabilities, ProviderConnection, DeployResult, PerformanceMetrics } from './types'
import { Database } from '@/lib/supabase/types'

type ProviderConnectionRow = Database['public']['Tables']['provider_connections']['Row']

export class NotionProvider implements DeploymentProvider {
  id = 'notion' as const
  name = 'Notion'
  icon = 'file-text'
  description = 'Sync campaign content to Notion databases'
  capabilities: ProviderCapabilities = { deployPage: false, deployForm: false, deployEmail: false, deploySequence: false, getPerformance: false, biDirectionalSync: true }

  async isConnected(workspaceId: string): Promise<boolean> {
    const supabase = createServiceClient()
    const { data } = await supabase.from('provider_connections').select('id').eq('workspace_id', workspaceId).eq('provider', 'notion').maybeSingle()
    return !!data
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const clientId = process.env.NOTION_CLIENT_ID
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
    return `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUrl)}&state=${state}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const supabase = createServiceClient()
    const { data, error } = await supabase.from('provider_connections').upsert({ workspace_id: workspaceId, provider: 'notion', access_token: code }).select().maybeSingle()
    if (error) throw error
    return { id: data.id, workspaceId, provider: 'notion', isConnected: true }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase.from('provider_connections').delete().eq('workspace_id', workspaceId).eq('provider', 'notion')
  }
}
