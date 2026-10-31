/**
 * Meta Ads (Facebook/Instagram) Deployment Provider
 * 
 * Creates and manages Meta ad campaigns across Facebook and Instagram.
 * Supports various ad formats including image, video, carousel, and collection ads.
 */

import { encrypt, decrypt }

from '@/lib/encryption'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  DeploymentProvider,
  ProviderCapabilities,
  ProviderConnection,
  DeployResult,
  PerformanceMetrics,
} from './types'

interface MetaAdContent {
  workspaceId: string
  campaignName: string
  objective: 'OUTCOME_AWARENESS' | 'OUTCOME_TRAFFIC' | 'OUTCOME_ENGAGEMENT' | 'OUTCOME_LEADS' | 'OUTCOME_SALES'
  primaryText: string
  headline: string
  description?: string
  callToAction: 'LEARN_MORE' | 'SHOP_NOW' | 'SIGN_UP' | 'BOOK_NOW' | 'CONTACT_US' | 'GET_OFFER' | 'SUBSCRIBE'
  linkUrl: string
  imageUrl?: string
  videoUrl?: string
  dailyBudget?: number // In cents
  targeting?: {
    ageMin?: number
    ageMax?: number
    genders?: number[]
    geoLocations?: { countries?: string[]; cities?: string[] }
    interests?: string[]
  }
}

export class MetaAdsProvider implements DeploymentProvider {
  id = 'meta-ads' as const
  name = 'Meta Ads'
  icon = 'facebook'
  description = 'Create Facebook and Instagram ad campaigns'

  capabilities: ProviderCapabilities = {
    deployPage: false,
    deployForm: false,
    deployEmail: false,
    deploySequence: false,
    deployAd: true,
    getPerformance: true,
    biDirectionalSync: true,
  }

  private apiVersion = 'v18.0'

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return !!connection?.accessToken && !!connection?.metadata?.adAccountId
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const appId = process.env.META_APP_ID
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
    const scopes = [
      'ads_management',
      'ads_read',
      'business_management',
      'pages_read_engagement',
    ].join(',')

    return `https://www.facebook.com/${this.apiVersion}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${scopes}&state=${state}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    const redirectUri = process.env.META_REDIRECT_URI

    // Exchange code for access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/${this.apiVersion}/oauth/access_token?` +
        new URLSearchParams({
          client_id: appId!,
          client_secret: appSecret!,
          redirect_uri: redirectUri!,
          code,
        })
    )

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange Meta OAuth code')
    }

    const tokens = await tokenResponse.json()

    // Exchange for long-lived token
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/${this.apiVersion}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: appId!,
          client_secret: appSecret!,
          fb_exchange_token: tokens.access_token,
        })
    )

    const longLivedTokens = await longLivedResponse.json()

    // Get ad accounts
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/${this.apiVersion}/me/adaccounts?fields=id,name,account_status&access_token=${longLivedTokens.access_token}`
    )
    const adAccounts = await adAccountsResponse.json()
    const defaultAccount = adAccounts.data?.[0]

    // Get user info
    const userResponse = await fetch(
      `https://graph.facebook.com/${this.apiVersion}/me?fields=id,name&access_token=${longLivedTokens.access_token}`
    )
    const user = await userResponse.json()

    // Store connection
    const supabase = createServiceClient()
    const expiresAt = new Date(Date.now() + (longLivedTokens.expires_in || 5184000) * 1000)

    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'meta-ads',
        access_token: encrypt(longLivedTokens.access_token),
        external_id: userId,
        external_name: user.name,
        metadata: {
          userId: userId,
          userName: user.name,
          adAccountId: defaultAccount?.id,
          adAccountName: defaultAccount?.name,
          availableAdAccounts: adAccounts.data || [],
        },
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .maybeSingle()

    if (error) throw error

    return {
      id: data.id,
      workspaceId,
      provider: 'meta-ads',
      isConnected: true,
      externalId: userId,
      externalName: user.name,
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'meta-ads')
  }

  async deployPage(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Meta Ads does not support page deployment' }
  }

  async deployForm(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Meta Ads does not support form deployment' }
  }

  async deployEmail(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Meta Ads does not support email deployment' }
  }

  /**
   * Create a Meta ad campaign with ad set and ad
   */
  async createAdCampaign(content: MetaAdContent): Promise<DeployResult> {
    const client = await this.getClient(content.workspaceId)
    if (!client) {
      return { success: false, externalId: '', error: 'Meta Ads not connected' }
    }

    try {
      // 1. Create Campaign
      const campaignResponse = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${client.adAccountId}/campaigns`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: content.campaignName,
            objective: content.objective,
            status: 'PAUSED', // Start paused for review
            special_ad_categories: [],
            access_token: client.accessToken,
          }),
        }
      )

      if (!campaignResponse.ok) {
        const errorData = await campaignResponse.json()
        throw new Error(errorData.error?.message || 'Failed to create campaign')
      }

      const campaign = await campaignResponse.json()

      // 2. Create Ad Set
      const targetingSpec: any = {
        age_min: content.targeting?.ageMin || 18,
        age_max: content.targeting?.ageMax || 65,
        geo_locations: content.targeting?.geoLocations || { countries: ['US'] },
      }

      if (content.targeting?.genders) {
        targetingSpec.genders = content.targeting.genders
      }

      if (content.targeting?.interests) {
        targetingSpec.flexible_spec = [
          {
            interests: content.targeting.interests.map((interest) => ({
              name: interest,
            })),
          },
        ]
      }

      const adSetResponse = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${client.adAccountId}/adsets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${content.campaignName} - Ad Set`,
            campaign_id: campaign.id,
            daily_budget: content.dailyBudget || 1000, // $10 default
            billing_event: 'IMPRESSIONS',
            optimization_goal: this.getOptimizationGoal(content.objective),
            targeting: targetingSpec,
            status: 'PAUSED',
            access_token: client.accessToken,
          }),
        }
      )

      if (!adSetResponse.ok) {
        const errorData = await adSetResponse.json()
        throw new Error(errorData.error?.message || 'Failed to create ad set')
      }

      const adSet = await adSetResponse.json()

      // 3. Create Ad Creative
      const creativeData: any = {
        name: `${content.campaignName} - Creative`,
        object_story_spec: {
          page_id: client.pageId, // Need a connected page
          link_data: {
            link: content.linkUrl,
            message: content.primaryText,
            name: content.headline,
            description: content.description || '',
            call_to_action: {
              type: content.callToAction,
            },
          },
        },
        access_token: client.accessToken,
      }

      if (content.imageUrl) {
        creativeData.object_story_spec.link_data.image_url = content.imageUrl
      }

      const creativeResponse = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${client.adAccountId}/adcreatives`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(creativeData),
        }
      )

      if (!creativeResponse.ok) {
        const errorData = await creativeResponse.json()
        throw new Error(errorData.error?.message || 'Failed to create ad creative')
      }

      const creative = await creativeResponse.json()

      // 4. Create Ad
      const adResponse = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${client.adAccountId}/ads`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${content.campaignName} - Ad`,
            adset_id: adSet.id,
            creative: { creative_id: creative.id },
            status: 'PAUSED',
            access_token: client.accessToken,
          }),
        }
      )

      if (!adResponse.ok) {
        const errorData = await adResponse.json()
        throw new Error(errorData.error?.message || 'Failed to create ad')
      }

      const ad = await adResponse.json()

      return {
        success: true,
        externalId: campaign.id,
        url: `https://business.facebook.com/adsmanager/manage/campaigns?act=${client.adAccountId.replace('act_', '')}&campaign_ids=${campaign.id}`,
        metadata: {
          campaignId: campaign.id,
          adSetId: adSet.id,
          adId: ad.id,
          creativeId: creative.id,
        },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create Meta ad'
      return { success: false, externalId: '', error: message }
    }
  }

  async getPerformance(campaignId: string): Promise<PerformanceMetrics | null> {
    const supabase = createServiceClient()
    
    const { data: deployment } = await supabase
      .from('deployments')
      .select('workspace_id, metadata')
      .eq('campaign_id', campaignId)
      .eq('provider', 'meta-ads')
      .maybeSingle()

    if (!deployment?.metadata?.metaCampaignId) return null

    const client = await this.getClient(deployment.workspace_id)
    if (!client) return null

    try {
      const response = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${deployment.metadata.metaCampaignId}/insights?` +
          new URLSearchParams({
            fields: 'impressions,clicks,spend,conversions,ctr,cpc,reach,frequency',
            access_token: client.accessToken,
          })
      )

      if (!response.ok) return null

      const result = await response.json()
      const metrics = result.data?.[0]

      if (!metrics) return null

      return {
        impressions: parseInt(metrics.impressions) || 0,
        clicks: parseInt(metrics.clicks) || 0,
        spend: parseFloat(metrics.spend) || 0,
        conversions: parseInt(metrics.conversions) || 0,
        ctr: parseFloat(metrics.ctr) || 0,
        cpc: parseFloat(metrics.cpc) || 0,
        reach: parseInt(metrics.reach) || 0,
        frequency: parseFloat(metrics.frequency) || 0,
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
      .eq('provider', 'meta-ads')
      .maybeSingle()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'meta-ads',
      isConnected: true,
      accessToken: data.access_token,
      externalId: data.external_id,
      metadata: data.metadata,
    }
  }

  private async getClient(workspaceId: string): Promise<{
    accessToken: string
    adAccountId: string
    pageId?: string
  } | null> {
    const connection = await this.getConnection(workspaceId)
    if (!connection?.accessToken || !connection?.metadata?.adAccountId) return null

    return {
      accessToken: decrypt(connection.accessToken),
      adAccountId: connection.metadata.adAccountId as string,
      pageId: connection.metadata.pageId as string,
    }
  }

  private getOptimizationGoal(objective: MetaAdContent['objective']): string {
    const mapping: Record<MetaAdContent['objective'], string> = {
      OUTCOME_AWARENESS: 'REACH',
      OUTCOME_TRAFFIC: 'LINK_CLICKS',
      OUTCOME_ENGAGEMENT: 'POST_ENGAGEMENT',
      OUTCOME_LEADS: 'LEAD_GENERATION',
      OUTCOME_SALES: 'CONVERSIONS',
    }
    return mapping[objective] || 'LINK_CLICKS'
  }
}
