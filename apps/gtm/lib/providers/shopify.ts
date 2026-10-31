import { createServiceClient } from '@/lib/supabase/service'
import type { DeploymentProvider, ProviderCapabilities, ProviderConnection, PageMetadata, DeployResult, PerformanceMetrics } from './types'

export class ShopifyProvider implements DeploymentProvider {
  id = 'shopify' as const
  name = 'Shopify'
  icon = 'shopping-bag'
  description = 'Deploy pages and products to Shopify stores'
  capabilities: ProviderCapabilities = { deployPage: true, deployForm: false, deployEmail: false, deploySequence: false, getPerformance: true, biDirectionalSync: false }

  async isConnected(workspaceId: string): Promise<boolean> {
    const supabase = createServiceClient()
    const { data } = await supabase.from('provider_connections').select('id').eq('workspace_id', workspaceId).eq('provider', 'shopify').single()
    return !!data
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    return `${process.env.NEXT_PUBLIC_APP_URL}/settings?connect=shopify&workspace=${workspaceId}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const supabase = createServiceClient()
    const { data, error } = await supabase.from('provider_connections').upsert({ workspace_id: workspaceId, provider: 'shopify', access_token: code }).select().single()
    if (error) throw error
    return { id: data.id, workspaceId, provider: 'shopify', isConnected: true }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase.from('provider_connections').delete().eq('workspace_id', workspaceId).eq('provider', 'shopify')
  }

  async deployPage(html: string, metadata: PageMetadata): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Shopify page deployment not yet implemented' }
  }

  async getPerformance(campaignId: string): Promise<PerformanceMetrics | null> { return null }
}
