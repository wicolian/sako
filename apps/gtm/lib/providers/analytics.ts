/**
 * Analytics Providers
 * 
 * Integrations with analytics platforms for performance tracking.
 * - Google Analytics 4
 * - Amplitude
 * - Mixpanel
 * - Segment
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

// ============================================
// Google Analytics 4
// ============================================

export class GA4Provider implements DeploymentProvider {
  id = 'ga4' as const
  name = 'Google Analytics 4'
  icon = 'chart-bar'
  description = 'Track campaign performance with GA4'

  capabilities: ProviderCapabilities = {
    deployPage: false,
    deployForm: false,
    deployEmail: false,
    deploySequence: false,
    getPerformance: true,
    biDirectionalSync: false,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return !!connection?.metadata?.propertyId
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
    const scopes = [
      'https://www.googleapis.com/auth/analytics.readonly',
    ].join(' ')

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${state}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI

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
      throw new Error('Failed to exchange GA4 OAuth code')
    }

    const tokens = await tokenResponse.json()

    // Get account summaries to find properties
    const accountsResponse = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    )
    const accounts = await accountsResponse.json()
    const firstProperty = accounts.accountSummaries?.[0]?.propertySummaries?.[0]

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'ga4',
        access_token: encrypt(JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + (tokens.expires_in * 1000),
        })),
        external_id: firstProperty?.property || '',
        external_name: firstProperty?.displayName || 'GA4 Property',
        metadata: {
          propertyId: firstProperty?.property,
          propertyName: firstProperty?.displayName,
          accounts: accounts.accountSummaries,
        },
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .maybeSingle()

    if (error) throw error

    return {
      id: data.id,
      workspaceId,
      provider: 'ga4',
      isConnected: true,
      externalId: firstProperty?.property || '',
      externalName: firstProperty?.displayName || 'GA4 Property',
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'ga4')
  }

  async deployPage(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'GA4 is for analytics only' }
  }

  async deployForm(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'GA4 is for analytics only' }
  }

  async getPerformance(campaignId: string): Promise<PerformanceMetrics | null> {
    const supabase = createServiceClient()
    
    const { data: deployment } = await supabase
      .from('deployments')
      .select('workspace_id')
      .eq('campaign_id', campaignId)
      .maybeSingle()

    if (!deployment) return null

    const connection = await this.getConnection(deployment.workspace_id)
    if (!connection?.accessToken || !connection?.metadata?.propertyId) return null

    try {
      const tokens = JSON.parse(decrypt(connection.accessToken))
      
      // Query GA4 Data API
      const response = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/${connection.metadata.propertyId}:runReport`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
            dimensions: [{ name: 'pagePath' }],
            metrics: [
              { name: 'screenPageViews' },
              { name: 'activeUsers' },
              { name: 'bounceRate' },
              { name: 'averageSessionDuration' },
              { name: 'conversions' },
            ],
            dimensionFilter: {
              filter: {
                fieldName: 'pagePath',
                stringFilter: {
                  matchType: 'CONTAINS',
                  value: campaignId,
                },
              },
            },
          }),
        }
      )

      if (!response.ok) return null

      const data = await response.json()
      const row = data.rows?.[0]

      if (!row) return null

      return {
        pageViews: parseInt(row.metricValues?.[0]?.value) || 0,
        uniqueVisitors: parseInt(row.metricValues?.[1]?.value) || 0,
        bounceRate: parseFloat(row.metricValues?.[2]?.value) || 0,
        avgTimeOnPage: parseFloat(row.metricValues?.[3]?.value) || 0,
        conversions: parseInt(row.metricValues?.[4]?.value) || 0,
      }
    } catch {
      return null
    }
  }

  private async getConnection(workspaceId: string): Promise<ProviderConnection | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'ga4')
      .maybeSingle()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'ga4',
      isConnected: true,
      accessToken: data.access_token,
      externalId: data.external_id,
      metadata: data.metadata,
    }
  }
}

// ============================================
// Segment
// ============================================

export class SegmentProvider implements DeploymentProvider {
  id = 'segment' as const
  name = 'Segment'
  icon = 'git-merge'
  description = 'Send events to Segment CDP'

  capabilities: ProviderCapabilities = {
    deployPage: false,
    deployForm: false,
    deployEmail: false,
    deploySequence: false,
    getPerformance: true,
    biDirectionalSync: true, // Segment can receive AND send data
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return !!connection?.metadata?.writeKey
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
    return `/settings/connections/segment/setup?state=${state}&redirect=${encodeURIComponent(redirectUrl)}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    // Code contains the API key from setup
    const config = JSON.parse(Buffer.from(code, 'base64').toString())
    const { writeKey, sourceId, sourceName } = config

    // Validate by making a test identify call
    const testResponse = await fetch('https://api.segment.io/v1/identify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(writeKey + ':').toString('base64')}`,
      },
      body: JSON.stringify({
        userId: 'test-validation',
        traits: { test: true },
      }),
    })

    if (!testResponse.ok) {
      throw new Error('Invalid Segment write key')
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'segment',
        access_token: encrypt(writeKey),
        external_id: sourceId || 'segment-source',
        external_name: sourceName || 'Segment Source',
        metadata: {
          writeKey: writeKey.substring(0, 8) + '...', // Store prefix for display
          sourceId,
          sourceName,
        },
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .maybeSingle()

    if (error) throw error

    return {
      id: data.id,
      workspaceId,
      provider: 'segment',
      isConnected: true,
      externalId: sourceId || 'segment-source',
      externalName: sourceName || 'Segment Source',
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'segment')
  }

  async deployPage(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Segment is for event tracking' }
  }

  async deployForm(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Segment is for event tracking' }
  }

  async getPerformance(): Promise<PerformanceMetrics | null> {
    // Segment doesn't provide analytics directly - it sends to destinations
    return null
  }

  /**
   * Track an event to Segment
   */
  async track(
    workspaceId: string,
    event: {
      userId?: string
      anonymousId?: string
      event: string
      properties?: Record<string, any>
    }
  ): Promise<boolean> {
    const writeKey = await this.getWriteKey(workspaceId)
    if (!writeKey) return false

    try {
      const response = await fetch('https://api.segment.io/v1/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(writeKey + ':').toString('base64')}`,
        },
        body: JSON.stringify({
          userId: event.userId,
          anonymousId: event.anonymousId,
          event: event.event,
          properties: event.properties,
          timestamp: new Date().toISOString(),
        }),
      })

      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Identify a user in Segment
   */
  async identify(
    workspaceId: string,
    data: {
      userId: string
      traits?: Record<string, any>
    }
  ): Promise<boolean> {
    const writeKey = await this.getWriteKey(workspaceId)
    if (!writeKey) return false

    try {
      const response = await fetch('https://api.segment.io/v1/identify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(writeKey + ':').toString('base64')}`,
        },
        body: JSON.stringify({
          userId: data.userId,
          traits: data.traits,
          timestamp: new Date().toISOString(),
        }),
      })

      return response.ok
    } catch {
      return false
    }
  }

  private async getConnection(workspaceId: string): Promise<ProviderConnection | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'segment')
      .maybeSingle()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'segment',
      isConnected: true,
      accessToken: data.access_token,
      externalId: data.external_id,
      metadata: data.metadata,
    }
  }

  private async getWriteKey(workspaceId: string): Promise<string | null> {
    const connection = await this.getConnection(workspaceId)
    if (!connection?.accessToken) return null
    return decrypt(connection.accessToken)
  }
}

// ============================================
// Amplitude
// ============================================

export class AmplitudeProvider implements DeploymentProvider {
  id = 'amplitude' as const
  name = 'Amplitude'
  icon = 'activity'
  description = 'Product analytics with Amplitude'

  capabilities: ProviderCapabilities = {
    deployPage: false,
    deployForm: false,
    deployEmail: false,
    deploySequence: false,
    getPerformance: true,
    biDirectionalSync: false,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return !!connection?.metadata?.apiKey
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
    return `/settings/connections/amplitude/setup?state=${state}&redirect=${encodeURIComponent(redirectUrl)}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const config = JSON.parse(Buffer.from(code, 'base64').toString())
    const { apiKey, secretKey, projectName } = config

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'amplitude',
        access_token: encrypt(JSON.stringify({ apiKey, secretKey })),
        external_id: apiKey.substring(0, 8),
        external_name: projectName || 'Amplitude Project',
        metadata: {
          apiKey: apiKey.substring(0, 8) + '...',
          projectName,
        },
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .maybeSingle()

    if (error) throw error

    return {
      id: data.id,
      workspaceId,
      provider: 'amplitude',
      isConnected: true,
      externalId: apiKey.substring(0, 8),
      externalName: projectName || 'Amplitude Project',
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'amplitude')
  }

  async deployPage(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Amplitude is for analytics' }
  }

  async deployForm(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Amplitude is for analytics' }
  }

  async getPerformance(): Promise<PerformanceMetrics | null> {
    return null
  }

  private async getConnection(workspaceId: string): Promise<ProviderConnection | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'amplitude')
      .maybeSingle()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'amplitude',
      isConnected: true,
      accessToken: data.access_token,
      externalId: data.external_id,
      metadata: data.metadata,
    }
  }
}

// ============================================
// Mixpanel
// ============================================

export class MixpanelProvider implements DeploymentProvider {
  id = 'mixpanel' as const
  name = 'Mixpanel'
  icon = 'bar-chart-2'
  description = 'User analytics with Mixpanel'

  capabilities: ProviderCapabilities = {
    deployPage: false,
    deployForm: false,
    deployEmail: false,
    deploySequence: false,
    getPerformance: true,
    biDirectionalSync: false,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return !!connection?.metadata?.token
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
    return `/settings/connections/mixpanel/setup?state=${state}&redirect=${encodeURIComponent(redirectUrl)}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const config = JSON.parse(Buffer.from(code, 'base64').toString())
    const { token, projectId, projectName } = config

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'mixpanel',
        access_token: encrypt(token),
        external_id: projectId || token.substring(0, 8),
        external_name: projectName || 'Mixpanel Project',
        metadata: {
          token: token.substring(0, 8) + '...',
          projectId,
          projectName,
        },
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .maybeSingle()

    if (error) throw error

    return {
      id: data.id,
      workspaceId,
      provider: 'mixpanel',
      isConnected: true,
      externalId: projectId || token.substring(0, 8),
      externalName: projectName || 'Mixpanel Project',
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'mixpanel')
  }

  async deployPage(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Mixpanel is for analytics' }
  }

  async deployForm(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Mixpanel is for analytics' }
  }

  async getPerformance(): Promise<PerformanceMetrics | null> {
    return null
  }

  private async getConnection(workspaceId: string): Promise<ProviderConnection | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'mixpanel')
      .maybeSingle()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'mixpanel',
      isConnected: true,
      accessToken: data.access_token,
      externalId: data.external_id,
      metadata: data.metadata,
    }
  }
}
