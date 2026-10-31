import { createServiceClient } from '@/lib/supabase/service'
import type {
  DeploymentProvider,
  ProviderCapabilities,
  ProviderConnection,
  EmailContent,
  DeployResult,
  PerformanceMetrics,
} from './types'
import { Database } from '@/lib/supabase/types'

type ProviderConnectionRow = Database['public']['Tables']['provider_connections']['Row']

export class KlaviyoProvider implements DeploymentProvider {
  id = 'klaviyo' as const
  name = 'Klaviyo'
  icon = 'mail'
  description = 'Deploy email flows and campaigns to Klaviyo'

  capabilities: ProviderCapabilities = {
    deployPage: false,
    deployForm: false,
    deployEmail: true,
    deploySequence: true,
    getPerformance: true,
    biDirectionalSync: false,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('provider_connections')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'klaviyo')
      .maybeSingle()
    return !!data
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    return `${process.env.NEXT_PUBLIC_APP_URL}/settings?connect=klaviyo&workspace=${workspaceId}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'klaviyo',
        access_token: code,
      })
      .select()
      .maybeSingle()

    if (error) throw error
    return { id: data.id, workspaceId, provider: 'klaviyo', isConnected: true }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase.from('provider_connections').delete().eq('workspace_id', workspaceId).eq('provider', 'klaviyo')
  }

  async deployEmail(content: EmailContent): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Klaviyo email deployment not yet implemented' }
  }

  async getPerformance(campaignId: string): Promise<PerformanceMetrics | null> {
    return null
  }
}
