import { createHash, randomBytes } from 'crypto'
import { decrypt, encrypt } from '@/lib/encryption'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  DeploymentProvider,
  ProviderCapabilities,
  ProviderConnection,
  DeployResult,
  PerformanceMetrics,
} from './types'

interface TwitterAuthState {
  workspaceId: string
  codeVerifier: string
}

interface TwitterConnectionToken {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

export function parseTwitterAuthState(state: string): TwitterAuthState {
  const decoded = decrypt(state)
  return JSON.parse(decoded) as TwitterAuthState
}

export class TwitterProvider implements DeploymentProvider {
  id = 'twitter' as const
  name = 'Twitter/X'
  icon = 'twitter'
  description = 'Publish Twitter/X posts directly from approved campaign assets'

  capabilities: ProviderCapabilities = {
    deployPage: false,
    deployForm: false,
    deployEmail: false,
    deploySequence: false,
    getPerformance: false,
    biDirectionalSync: false,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const client = await this.getClient(workspaceId)
    return client !== null
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const clientId = process.env.TWITTER_CLIENT_ID
    if (!clientId) {
      throw new Error('TWITTER_CLIENT_ID is required for Twitter/X integration')
    }

    const codeVerifier = toBase64Url(randomBytes(32))
    const codeChallenge = toBase64Url(createHash('sha256').update(codeVerifier).digest())
    const state = encrypt(JSON.stringify({ workspaceId, codeVerifier }))
    const scopes = ['tweet.read', 'tweet.write', 'users.read', 'offline.access']

    return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${encodeURIComponent(scopes.join(' '))}&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`
  }

  async handleOAuthCallback(
    code: string,
    workspaceId: string,
    codeVerifier?: string
  ): Promise<ProviderConnection> {
    const clientId = process.env.TWITTER_CLIENT_ID
    const clientSecret = process.env.TWITTER_CLIENT_SECRET
    const redirectUri = process.env.TWITTER_REDIRECT_URI

    if (!clientId || !redirectUri) {
      throw new Error('Twitter/X integration requires TWITTER_CLIENT_ID and TWITTER_REDIRECT_URI')
    }

    if (!codeVerifier) {
      throw new Error('Missing PKCE verifier for Twitter/X OAuth')
    }

    const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(clientSecret
          ? {
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            }
          : {}),
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      throw new Error(`Failed to exchange Twitter/X OAuth code: ${errorText}`)
    }

    const tokens = await tokenResponse.json() as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    const profileResponse = await fetch('https://api.x.com/2/users/me?user.fields=username,name', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text()
      throw new Error(`Failed to fetch Twitter/X user profile: ${errorText}`)
    }

    const profile = await profileResponse.json() as {
      data?: {
        id: string
        name?: string
        username?: string
      }
    }

    const user = profile.data
    if (!user?.id || !user.username) {
      throw new Error('Twitter/X user profile response was incomplete')
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'twitter',
        access_token: encrypt(
          JSON.stringify({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: expiresAt?.getTime(),
          })
        ),
        refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        external_id: user.id,
        external_name: user.username,
        metadata: {
          userId: user.id,
          userName: user.name || user.username,
          username: user.username,
        },
        expires_at: expiresAt?.toISOString() || null,
        is_active: true,
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .single()

    if (error) {
      throw error
    }

    return {
      id: data.id,
      workspaceId,
      provider: 'twitter',
      isConnected: true,
      externalId: user.id,
      externalName: user.username,
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'twitter')
  }

  async publishSocial(
    content: string,
    workspaceId: string
  ): Promise<{ tweetId: string; url: string }> {
    const client = await this.getClient(workspaceId)
    if (!client) {
      throw new Error('Twitter/X is not connected')
    }

    const response = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${client.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: content.trim().slice(0, 280),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Twitter/X publish failed: ${errorText}`)
    }

    const result = await response.json() as {
      data?: {
        id: string
      }
    }

    if (!result.data?.id) {
      throw new Error('Twitter/X publish response did not include a tweet id')
    }

    const username = client.username || 'i'

    return {
      tweetId: result.data.id,
      url: `https://x.com/${username}/status/${result.data.id}`,
    }
  }

  async getPerformance(): Promise<PerformanceMetrics | null> {
    return null
  }

  async deployPage(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Twitter/X does not support page deployment' }
  }

  async deployForm(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Twitter/X does not support form deployment' }
  }

  async deployEmail(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Twitter/X does not support email deployment' }
  }

  private async getConnection(workspaceId: string): Promise<ProviderConnection | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'twitter')
      .single()

    if (!data) {
      return null
    }

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'twitter',
      isConnected: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || undefined,
      externalId: data.external_id,
      externalName: data.external_name,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      metadata: data.metadata,
    }
  }

  private async getClient(workspaceId: string): Promise<{
    accessToken: string
    username?: string
  } | null> {
    const connection = await this.getConnection(workspaceId)
    if (!connection?.accessToken) {
      return null
    }

    const token = JSON.parse(decrypt(connection.accessToken)) as TwitterConnectionToken
    if (token.expiresAt && Date.now() >= token.expiresAt && token.refreshToken) {
      const refreshed = await this.refreshToken(workspaceId, token.refreshToken)
      if (!refreshed) {
        return null
      }

      return {
        accessToken: refreshed.accessToken,
        username: connection.metadata?.username as string | undefined,
      }
    }

    return {
      accessToken: token.accessToken,
      username: connection.metadata?.username as string | undefined,
    }
  }

  private async refreshToken(
    workspaceId: string,
    refreshToken: string
  ): Promise<{ accessToken: string } | null> {
    const clientId = process.env.TWITTER_CLIENT_ID
    const clientSecret = process.env.TWITTER_CLIENT_SECRET

    if (!clientId) {
      return null
    }

    const response = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(clientSecret
          ? {
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            }
          : {}),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    })

    if (!response.ok) {
      return null
    }

    const tokens = await response.json() as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    const nextRefreshToken = tokens.refresh_token || refreshToken
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null

    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .update({
        access_token: encrypt(
          JSON.stringify({
            accessToken: tokens.access_token,
            refreshToken: nextRefreshToken,
            expiresAt: expiresAt?.getTime(),
          })
        ),
        refresh_token: encrypt(nextRefreshToken),
        expires_at: expiresAt?.toISOString() || null,
      })
      .eq('workspace_id', workspaceId)
      .eq('provider', 'twitter')

    return {
      accessToken: tokens.access_token,
    }
  }
}

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}
