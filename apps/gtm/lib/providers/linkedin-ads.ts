/**
 * LinkedIn Ads Deployment Provider
 * 
 * Creates and manages LinkedIn advertising campaigns.
 * Supports Sponsored Content, Message Ads, and Dynamic Ads.
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

interface LinkedInAdContent {
  workspaceId: string
  campaignName: string
  objective: 'BRAND_AWARENESS' | 'WEBSITE_VISITS' | 'ENGAGEMENT' | 'LEAD_GENERATION' | 'WEBSITE_CONVERSIONS'
  text: string
  headline?: string
  destinationUrl: string
  imageUrl?: string
  dailyBudget?: number // In cents
  targeting?: {
    locations?: string[] // Country codes
    industries?: string[]
    jobFunctions?: string[]
    seniorities?: string[]
    companySize?: string[]
    skills?: string[]
  }
}

export class LinkedInAdsProvider implements DeploymentProvider {
  id = 'linkedin-ads' as const
  name = 'LinkedIn Ads'
  icon = 'linkedin'
  description = 'Create LinkedIn advertising campaigns for B2B marketing'

  capabilities: ProviderCapabilities = {
    deployPage: false,
    deployForm: false,
    deployEmail: false,
    deploySequence: false,
    deployAd: true,
    getPerformance: true,
    biDirectionalSync: false,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return !!connection?.accessToken && !!connection?.metadata?.adAccountId
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
    const scopes = [
      'r_ads',
      'r_ads_reporting',
      'rw_ads',
      'r_organization_social',
      'w_organization_social',
      'r_basicprofile',
    ].join(' ')

    return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${encodeURIComponent(scopes)}&state=${state}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI

    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri!,
        client_id: clientId!,
        client_secret: clientSecret!,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange LinkedIn OAuth code')
    }

    const tokens = await tokenResponse.json()

    // Get user profile
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileResponse.json()

    // Get ad accounts
    const adAccountsResponse = await fetch(
      'https://api.linkedin.com/v2/adAccountsV2?q=search&search=(type:(values:List(BUSINESS,ENTERPRISE)))&projection=(elements*(id,name,status))',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    )
    const adAccounts = await adAccountsResponse.json()
    const defaultAccount = adAccounts.elements?.[0]

    // Store connection
    const supabase = createServiceClient()
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000))

    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'linkedin-ads',
        access_token: encrypt(JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: expiresAt.getTime(),
        })),
        external_id: profile.sub,
        external_name: profile.name,
        metadata: {
          userId: profile.sub,
          userName: profile.name,
          email: profile.email,
          adAccountId: defaultAccount?.id,
          adAccountName: defaultAccount?.name,
          availableAdAccounts: adAccounts.elements || [],
        },
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      workspaceId,
      provider: 'linkedin-ads',
      isConnected: true,
      externalId: profile.sub,
      externalName: profile.name,
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'linkedin-ads')
  }

  async deployPage(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'LinkedIn Ads does not support page deployment' }
  }

  async deployForm(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'LinkedIn Ads does not support form deployment' }
  }

  async deployEmail(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'LinkedIn Ads does not support email deployment' }
  }

  /**
   * Create a LinkedIn Sponsored Content campaign
   */
  async createSponsoredContent(content: LinkedInAdContent): Promise<DeployResult> {
    const client = await this.getClient(content.workspaceId)
    if (!client) {
      return { success: false, externalId: '', error: 'LinkedIn Ads not connected' }
    }

    try {
      // 1. Create Campaign Group (optional, but recommended)
      const campaignGroupResponse = await fetch(
        'https://api.linkedin.com/v2/adCampaignGroupsV2',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify({
            account: `urn:li:sponsoredAccount:${client.adAccountId}`,
            name: `${content.campaignName} Group`,
            status: 'ACTIVE',
          }),
        }
      )

      let campaignGroupId = null
      if (campaignGroupResponse.ok) {
        const locationHeader = campaignGroupResponse.headers.get('x-restli-id')
        campaignGroupId = locationHeader
      }

      // 2. Create Campaign
      const campaignPayload: any = {
        account: `urn:li:sponsoredAccount:${client.adAccountId}`,
        name: content.campaignName,
        status: 'PAUSED',
        type: 'SPONSORED_UPDATES',
        costType: 'CPM',
        dailyBudget: {
          currencyCode: 'USD',
          amount: (content.dailyBudget || 5000).toString(), // Default $50/day
        },
        unitCost: {
          currencyCode: 'USD',
          amount: '10', // $0.10 CPM
        },
        objectiveType: this.mapObjective(content.objective),
      }

      if (campaignGroupId) {
        campaignPayload.campaignGroup = `urn:li:sponsoredCampaignGroup:${campaignGroupId}`
      }

      // Build targeting
      const targetingCriteria: any = {
        include: {
          and: [],
        },
      }

      if (content.targeting?.locations?.length) {
        targetingCriteria.include.and.push({
          or: {
            'urn:li:adTargetingFacet:locations': content.targeting.locations.map(
              (loc) => `urn:li:geo:${loc}`
            ),
          },
        })
      }

      if (content.targeting?.industries?.length) {
        targetingCriteria.include.and.push({
          or: {
            'urn:li:adTargetingFacet:industries': content.targeting.industries.map(
              (ind) => `urn:li:industry:${ind}`
            ),
          },
        })
      }

      if (content.targeting?.seniorities?.length) {
        targetingCriteria.include.and.push({
          or: {
            'urn:li:adTargetingFacet:seniorities': content.targeting.seniorities.map(
              (sen) => `urn:li:seniority:${sen}`
            ),
          },
        })
      }

      if (targetingCriteria.include.and.length > 0) {
        campaignPayload.targetingCriteria = targetingCriteria
      }

      const campaignResponse = await fetch(
        'https://api.linkedin.com/v2/adCampaignsV2',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify(campaignPayload),
        }
      )

      if (!campaignResponse.ok) {
        const errorData = await campaignResponse.json()
        throw new Error(errorData.message || 'Failed to create campaign')
      }

      const campaignId = campaignResponse.headers.get('x-restli-id')

      // 3. Create Ad Creative (Share)
      const shareResponse = await fetch(
        'https://api.linkedin.com/v2/shares',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify({
            owner: `urn:li:organization:${client.organizationId}`,
            text: {
              text: content.text,
            },
            content: {
              contentEntities: [
                {
                  entityLocation: content.destinationUrl,
                  thumbnails: content.imageUrl
                    ? [{ resolvedUrl: content.imageUrl }]
                    : [],
                },
              ],
              title: content.headline || content.campaignName,
            },
            distribution: {
              linkedInDistributionTarget: {},
            },
          }),
        }
      )

      let shareId = null
      if (shareResponse.ok) {
        const shareData = await shareResponse.json()
        shareId = shareData.id
      }

      // 4. Create Ad Creative
      const creativeResponse = await fetch(
        'https://api.linkedin.com/v2/adCreativesV2',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify({
            campaign: `urn:li:sponsoredCampaign:${campaignId}`,
            reference: shareId || `urn:li:share:${Date.now()}`,
            status: 'ACTIVE',
            type: 'SPONSORED_STATUS_UPDATE',
            variables: {
              data: {
                'com.linkedin.ads.SponsoredUpdateCreativeVariables': {
                  activity: shareId,
                },
              },
            },
          }),
        }
      )

      let creativeId = null
      if (creativeResponse.ok) {
        creativeId = creativeResponse.headers.get('x-restli-id')
      }

      return {
        success: true,
        externalId: campaignId || '',
        url: `https://www.linkedin.com/campaignmanager/accounts/${client.adAccountId}/campaigns/${campaignId}`,
        metadata: {
          campaignId,
          campaignGroupId,
          creativeId,
          shareId,
        },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create LinkedIn ad'
      return { success: false, externalId: '', error: message }
    }
  }

  async getPerformance(campaignId: string): Promise<PerformanceMetrics | null> {
    const supabase = createServiceClient()
    
    const { data: deployment } = await supabase
      .from('deployments')
      .select('workspace_id, metadata')
      .eq('campaign_id', campaignId)
      .eq('provider', 'linkedin-ads')
      .single()

    if (!deployment?.metadata?.linkedinCampaignId) return null

    const client = await this.getClient(deployment.workspace_id)
    if (!client) return null

    try {
      const response = await fetch(
        `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          new URLSearchParams({
            dateRange: '(start:(month:1,day:1,year:2024),end:(month:12,day:31,year:2024))',
            timeGranularity: 'ALL',
            campaigns: `List(urn:li:sponsoredCampaign:${deployment.metadata.linkedinCampaignId})`,
            fields: 'impressions,clicks,costInUsd,conversions,externalWebsiteConversions,clickRate',
          }),
        {
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      )

      if (!response.ok) return null

      const result = await response.json()
      const metrics = result.elements?.[0]

      if (!metrics) return null

      return {
        impressions: metrics.impressions || 0,
        clicks: metrics.clicks || 0,
        spend: parseFloat(metrics.costInUsd) || 0,
        conversions: (metrics.conversions || 0) + (metrics.externalWebsiteConversions || 0),
        ctr: parseFloat(metrics.clickRate) || 0,
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
      .eq('provider', 'linkedin-ads')
      .single()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'linkedin-ads',
      isConnected: true,
      accessToken: data.access_token,
      externalId: data.external_id,
      metadata: data.metadata,
    }
  }

  private async getClient(workspaceId: string): Promise<{
    accessToken: string
    adAccountId: string
    organizationId?: string
  } | null> {
    const connection = await this.getConnection(workspaceId)
    if (!connection?.accessToken || !connection?.metadata?.adAccountId) return null

    try {
      const tokens = JSON.parse(decrypt(connection.accessToken))
      
      // Check if token needs refresh
      if (tokens.expiresAt && tokens.expiresAt < Date.now()) {
        const refreshed = await this.refreshTokens(workspaceId, tokens.refreshToken)
        if (refreshed) {
          return {
            accessToken: refreshed,
            adAccountId: connection.metadata.adAccountId as string,
            organizationId: connection.metadata.organizationId as string,
          }
        }
        return null
      }

      return {
        accessToken: tokens.accessToken,
        adAccountId: connection.metadata.adAccountId as string,
        organizationId: connection.metadata.organizationId as string,
      }
    } catch {
      return null
    }
  }

  private async refreshTokens(workspaceId: string, refreshToken: string): Promise<string | null> {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET

    try {
      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId!,
          client_secret: clientSecret!,
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
            refreshToken: tokens.refresh_token || refreshToken,
            expiresAt: Date.now() + (tokens.expires_in * 1000),
          })),
          expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
        })
        .eq('workspace_id', workspaceId)
        .eq('provider', 'linkedin-ads')

      return tokens.access_token
    } catch {
      return null
    }
  }

  private mapObjective(objective: LinkedInAdContent['objective']): string {
    const mapping: Record<LinkedInAdContent['objective'], string> = {
      BRAND_AWARENESS: 'BRAND_AWARENESS',
      WEBSITE_VISITS: 'WEBSITE_VISITS',
      ENGAGEMENT: 'ENGAGEMENT',
      LEAD_GENERATION: 'LEAD_GENERATION',
      WEBSITE_CONVERSIONS: 'WEBSITE_CONVERSIONS',
    }
    return mapping[objective] || 'WEBSITE_VISITS'
  }
}
