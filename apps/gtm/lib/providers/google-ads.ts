/**
 * Google Ads Deployment Provider
 * 
 * Creates and manages Google Ads campaigns, ad groups, and responsive ads.
 * Supports Performance Max, Search, and Display campaigns.
 */

import { encrypt, decrypt } from '@/lib/encryption'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  DeploymentProvider,
  ProviderCapabilities,
  ProviderConnection,
  DeployResult,
  PerformanceMetrics,
} from './types'

interface GoogleAdsAdContent {
  headlines: string[] // Max 15, each up to 30 chars
  descriptions: string[] // Max 4, each up to 90 chars
  finalUrl: string
  businessName: string
  callToAction?: string
  images?: { url: string; type: 'landscape' | 'square' | 'portrait' }[]
  workspaceId: string
  campaignName: string
}

export class GoogleAdsProvider implements DeploymentProvider {
  id = 'google-ads' as const
  name = 'Google Ads'
  icon = 'google'
  description = 'Create and manage Google Ads campaigns with AI-generated copy'

  capabilities: ProviderCapabilities = {
    deployPage: false,
    deployForm: false,
    deployEmail: false,
    deploySequence: false,
    deployAd: true,
    getPerformance: true,
    biDirectionalSync: true,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return !!connection?.accessToken && !!connection?.metadata?.customerId
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
    const scopes = [
      'https://www.googleapis.com/auth/adwords',
    ].join(' ')

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${state}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri!,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange Google Ads OAuth code')
    }

    const tokens = await tokenResponse.json()

    // Get accessible customer accounts
    const customers = await this.getAccessibleCustomers(tokens.access_token)
    const defaultCustomer = customers[0] // Use first accessible account

    // Store connection
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'google-ads',
        access_token: encrypt(JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + (tokens.expires_in * 1000),
        })),
        external_id: defaultCustomer?.id || '',
        external_name: defaultCustomer?.name || 'Google Ads Account',
        metadata: {
          customerId: defaultCustomer?.id,
          customerName: defaultCustomer?.name,
          accessibleCustomers: customers,
        },
        expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .maybeSingle()

    if (error) throw error

    return {
      id: data.id,
      workspaceId,
      provider: 'google-ads',
      isConnected: true,
      externalId: defaultCustomer?.id || '',
      externalName: defaultCustomer?.name || 'Google Ads Account',
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'google-ads')
  }

  // Google Ads doesn't deploy pages/forms/emails
  async deployPage(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Google Ads does not support page deployment' }
  }

  async deployForm(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Google Ads does not support form deployment' }
  }

  async deployEmail(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Google Ads does not support email deployment' }
  }

  /**
   * Create a Responsive Search Ad
   */
  async createResponsiveSearchAd(content: GoogleAdsAdContent): Promise<DeployResult> {
    const client = await this.getClient(content.workspaceId)
    if (!client) {
      return { success: false, externalId: '', error: 'Google Ads not connected' }
    }

    try {
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
      const customerId = client.customerId.replace(/-/g, '')

      // Create campaign first
      const campaignOperation = {
        create: {
          name: content.campaignName,
          advertisingChannelType: 'SEARCH',
          status: 'PAUSED', // Start paused for review
          manualCpc: {},
          campaignBudget: '', // Will be set after budget creation
        },
      }

      // Create budget
      const budgetResponse = await fetch(
        `https://googleads.googleapis.com/v15/customers/${customerId}/campaignBudgets:mutate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'developer-token': developerToken!,
            'login-customer-id': customerId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operations: [{
              create: {
                name: `Budget for ${content.campaignName}`,
                amountMicros: '10000000', // $10/day default
                deliveryMethod: 'STANDARD',
              },
            }],
          }),
        }
      )

      if (!budgetResponse.ok) {
        const errorText = await budgetResponse.text()
        throw new Error(`Failed to create budget: ${errorText}`)
      }

      const budgetResult = await budgetResponse.json()
      const budgetResourceName = budgetResult.results[0].resourceName

      // Create campaign with budget
      campaignOperation.create.campaignBudget = budgetResourceName

      const campaignResponse = await fetch(
        `https://googleads.googleapis.com/v15/customers/${customerId}/campaigns:mutate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'developer-token': developerToken!,
            'login-customer-id': customerId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ operations: [campaignOperation] }),
        }
      )

      if (!campaignResponse.ok) {
        const errorText = await campaignResponse.text()
        throw new Error(`Failed to create campaign: ${errorText}`)
      }

      const campaignResult = await campaignResponse.json()
      const campaignResourceName = campaignResult.results[0].resourceName

      // Create ad group
      const adGroupResponse = await fetch(
        `https://googleads.googleapis.com/v15/customers/${customerId}/adGroups:mutate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'developer-token': developerToken!,
            'login-customer-id': customerId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operations: [{
              create: {
                campaign: campaignResourceName,
                name: `Ad Group for ${content.campaignName}`,
                status: 'ENABLED',
                type: 'SEARCH_STANDARD',
                cpcBidMicros: '1000000', // $1 default bid
              },
            }],
          }),
        }
      )

      if (!adGroupResponse.ok) {
        throw new Error('Failed to create ad group')
      }

      const adGroupResult = await adGroupResponse.json()
      const adGroupResourceName = adGroupResult.results[0].resourceName

      // Create responsive search ad
      const adHeadlines = content.headlines.slice(0, 15).map((text, index) => ({
        text: text.slice(0, 30),
        pinnedField: index < 3 ? `HEADLINE_${index + 1}` : undefined,
      }))

      const adDescriptions = content.descriptions.slice(0, 4).map((text) => ({
        text: text.slice(0, 90),
      }))

      const adResponse = await fetch(
        `https://googleads.googleapis.com/v15/customers/${customerId}/adGroupAds:mutate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'developer-token': developerToken!,
            'login-customer-id': customerId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operations: [{
              create: {
                adGroup: adGroupResourceName,
                status: 'ENABLED',
                ad: {
                  responsiveSearchAd: {
                    headlines: adHeadlines,
                    descriptions: adDescriptions,
                    path1: content.businessName.slice(0, 15),
                  },
                  finalUrls: [content.finalUrl],
                },
              },
            }],
          }),
        }
      )

      if (!adResponse.ok) {
        const errorText = await adResponse.text()
        throw new Error(`Failed to create ad: ${errorText}`)
      }

      const adResult = await adResponse.json()
      const adResourceName = adResult.results[0].resourceName

      return {
        success: true,
        externalId: adResourceName,
        url: `https://ads.google.com/aw/overview?campaignId=${campaignResourceName.split('/').pop()}`,
        metadata: {
          campaignResourceName,
          adGroupResourceName,
          adResourceName,
          customerId,
        },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create Google Ad'
      return { success: false, externalId: '', error: message }
    }
  }

  async getPerformance(campaignId: string): Promise<PerformanceMetrics | null> {
    const supabase = createServiceClient()
    
    const { data: deployment } = await supabase
      .from('deployments')
      .select('workspace_id, metadata')
      .eq('campaign_id', campaignId)
      .eq('provider', 'google-ads')
      .maybeSingle()

    if (!deployment?.metadata?.campaignResourceName) return null

    const client = await this.getClient(deployment.workspace_id)
    if (!client) return null

    try {
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
      const customerId = client.customerId.replace(/-/g, '')

      // Query campaign metrics
      const query = `
        SELECT
          campaign.id,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        FROM campaign
        WHERE campaign.resource_name = '${deployment.metadata.campaignResourceName}'
      `

      const response = await fetch(
        `https://googleads.googleapis.com/v15/customers/${customerId}/googleAds:searchStream`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'developer-token': developerToken!,
            'login-customer-id': customerId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        }
      )

      if (!response.ok) return null

      const results = await response.json()
      const metrics = results[0]?.results?.[0]?.metrics

      if (!metrics) return null

      return {
        impressions: parseInt(metrics.impressions) || 0,
        clicks: parseInt(metrics.clicks) || 0,
        spend: (parseInt(metrics.costMicros) || 0) / 1000000,
        conversions: parseFloat(metrics.conversions) || 0,
        ctr: parseFloat(metrics.ctr) || 0,
        cpc: (parseInt(metrics.averageCpc) || 0) / 1000000,
      }
    } catch {
      return null
    }
  }

  // Helper methods
  private async getConnection(workspaceId: string): Promise<ProviderConnection | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'google-ads')
      .maybeSingle()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'google-ads',
      isConnected: true,
      accessToken: data.access_token,
      externalId: data.external_id,
      metadata: data.metadata,
    }
  }

  private async getClient(workspaceId: string): Promise<{
    accessToken: string
    customerId: string
  } | null> {
    const connection = await this.getConnection(workspaceId)
    if (!connection?.accessToken || !connection?.metadata?.customerId) return null

    try {
      const tokens = JSON.parse(decrypt(connection.accessToken))
      
      // Check if token needs refresh
      if (tokens.expiresAt && tokens.expiresAt < Date.now()) {
        const refreshed = await this.refreshTokens(workspaceId, tokens.refreshToken)
        if (refreshed) {
          return { accessToken: refreshed, customerId: connection.metadata.customerId as string }
        }
        return null
      }

      return {
        accessToken: tokens.accessToken,
        customerId: connection.metadata.customerId as string,
      }
    } catch {
      return null
    }
  }

  private async refreshTokens(workspaceId: string, refreshToken: string): Promise<string | null> {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: clientId!,
          client_secret: clientSecret!,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) return null

      const tokens = await response.json()

      // Update stored tokens
      const supabase = createServiceClient()
      await supabase
        .from('provider_connections')
        .update({
          access_token: encrypt(JSON.stringify({
            accessToken: tokens.access_token,
            refreshToken,
            expiresAt: Date.now() + (tokens.expires_in * 1000),
          })),
          expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
        })
        .eq('workspace_id', workspaceId)
        .eq('provider', 'google-ads')

      return tokens.access_token
    } catch {
      return null
    }
  }

  private async getAccessibleCustomers(accessToken: string): Promise<{ id: string; name: string }[]> {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN

    try {
      const response = await fetch(
        'https://googleads.googleapis.com/v15/customers:listAccessibleCustomers',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'developer-token': developerToken!,
          },
        }
      )

      if (!response.ok) return []

      const result = await response.json()
      
      // Get customer details for each accessible customer
      const customers: { id: string; name: string }[] = []
      for (const resourceName of result.resourceNames || []) {
        const customerId = resourceName.split('/')[1]
        customers.push({
          id: customerId,
          name: `Customer ${customerId}`, // Would need another API call for actual name
        })
      }

      return customers
    } catch {
      return []
    }
  }
}
