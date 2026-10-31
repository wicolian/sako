/**
 * Social Publisher
 *
 * Publish rendered images to LinkedIn API via existing provider connections.
 * Wired into automation approval: "Approve and Publish" button.
 *
 * MVP: LinkedIn queue-only (approval → API publish).
 * Future: Meta, Twitter/X direct publish.
 */

import { createServiceClient } from '@/lib/supabase/service'
import type { AssetDocument } from '@/lib/assets/asset-document'
import { TwitterProvider } from '@/lib/providers/twitter'

// ============================================================================
// Types
// ============================================================================

export type PublishPlatform = 'linkedin' | 'twitter' | 'facebook' | 'instagram'
export type PublishStatus = 'queued' | 'publishing' | 'published' | 'failed'

export interface PublishResult {
  platform: PublishPlatform
  status: PublishStatus
  postId?: string
  postUrl?: string
  error?: string
}

export interface PublishRequest {
  assetDocumentId: string
  workspaceId: string
  platform: PublishPlatform
  content: string
  imageUrl?: string
  scheduledFor?: string
}

// ============================================================================
// Publisher
// ============================================================================

export async function publishToSocial(
  request: PublishRequest
): Promise<PublishResult> {
  const supabase = createServiceClient()

  // 1. Check compliance status
  const { data: asset } = await supabase
    .from('asset_documents')
    .select('compliance_status, claims_json')
    .eq('id', request.assetDocumentId)
    .single()

  if (asset?.compliance_status === 'blocked') {
    return {
      platform: request.platform,
      status: 'failed',
      error: 'Cannot publish: Unresolved high-risk claims',
    }
  }

  if (request.platform === 'twitter') {
    return publishToTwitter(request)
  }

  // 2. Get provider connection
  const { data: connection } = await supabase
    .from('provider_connections')
    .select('*')
    .eq('workspace_id', request.workspaceId)
    .eq('provider', request.platform)
    .eq('status', 'connected')
    .single()

  if (!connection) {
    return {
      platform: request.platform,
      status: 'failed',
      error: `No connected ${request.platform} account. Connect in Settings → Integrations.`,
    }
  }

  // 3. Publish based on platform
  try {
    switch (request.platform) {
      case 'linkedin':
        return await publishToLinkedIn(request, connection)
      default:
        return {
          platform: request.platform,
          status: 'failed',
          error: `Publishing to ${request.platform} is not yet supported. Export the asset instead.`,
        }
    }
  } catch (error) {
    return {
      platform: request.platform,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown publishing error',
    }
  }
}

// ============================================================================
// Platform-specific publishers
// ============================================================================

async function publishToLinkedIn(
  request: PublishRequest,
  connection: Record<string, unknown>
): Promise<PublishResult> {
  const accessToken = (connection.credentials as Record<string, unknown>)?.access_token as string
  const personUrn = (connection.credentials as Record<string, unknown>)?.person_urn as string

  if (!accessToken || !personUrn) {
    return {
      platform: 'linkedin',
      status: 'failed',
      error: 'LinkedIn credentials are incomplete. Please reconnect.',
    }
  }

  // Upload image if provided
  let imageAsset: string | undefined
  if (request.imageUrl) {
    imageAsset = await uploadLinkedInImage(accessToken, personUrn, request.imageUrl)
  }

  // Create post
  const postBody: Record<string, unknown> = {
    author: personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: request.content,
        },
        shareMediaCategory: imageAsset ? 'IMAGE' : 'NONE',
        ...(imageAsset
          ? {
              media: [
                {
                  status: 'READY',
                  media: imageAsset,
                },
              ],
            }
          : {}),
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  }

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(postBody),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    return {
      platform: 'linkedin',
      status: 'failed',
      error: `LinkedIn API error: ${response.status} - ${errorBody}`,
    }
  }

  const data = await response.json()
  return {
    platform: 'linkedin',
    status: 'published',
    postId: data.id,
  }
}

async function uploadLinkedInImage(
  accessToken: string,
  personUrn: string,
  imageUrl: string
): Promise<string | undefined> {
  // 1. Register upload
  const registerResponse = await fetch(
    'https://api.linkedin.com/v2/assets?action=registerUpload',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: personUrn,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      }),
    }
  )

  if (!registerResponse.ok) return undefined
  const registerData = await registerResponse.json()

  const uploadUrl =
    registerData.value?.uploadMechanism?.[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ]?.uploadUrl
  const asset = registerData.value?.asset

  if (!uploadUrl || !asset) return undefined

  // 2. Fetch the image
  const imageResponse = await fetch(imageUrl)
  const imageBuffer = await imageResponse.arrayBuffer()

  // 3. Upload
  await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'image/png',
    },
    body: imageBuffer,
  })

  return asset
}

async function publishToTwitter(
  request: PublishRequest
): Promise<PublishResult> {
  const provider = new TwitterProvider()
  const result = await provider.publishSocial(request.content, request.workspaceId)

  return {
    platform: 'twitter',
    status: 'published',
    postId: result.tweetId,
    postUrl: result.url,
  }
}

// ============================================================================
// Bulk publish
// ============================================================================

export async function publishMultiple(
  requests: PublishRequest[]
): Promise<PublishResult[]> {
  return Promise.all(requests.map(publishToSocial))
}
