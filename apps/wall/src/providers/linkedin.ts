/**
 * LinkedIn Company Page Provider
 * 
 * Fetches latest post and engagement metrics from a LinkedIn company page.
 * 
 * REQUIREMENTS:
 * 1. LinkedIn App with "Marketing API" product enabled
 * 2. OAuth scopes: r_organization_social, rw_organization_admin
 * 3. Company page admin access for the authenticated user
 * 4. Environment variables: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_ACCESS_TOKEN
 * 
 * To get Marketing API access:
 * 1. Go to https://www.linkedin.com/developers/apps/{your-app-id}/products
 * 2. Request access to "Marketing API" 
 * 3. Once approved, add scopes: r_organization_social, rw_organization_admin
 * 4. Generate an access token via OAuth flow
 */

import type { SocialPost } from '@/types';

interface LinkedInConfig {
  accessToken: string;
  organizationId: string; // Company page URN ID
}

interface LinkedInPost {
  id: string;
  commentary?: string;
  created: { time: number };
  socialCounts?: {
    numLikes?: number;
    numComments?: number;
    numImpressions?: number;
  };
}

function getConfig(): LinkedInConfig | null {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const organizationId = process.env.LINKEDIN_ORGANIZATION_ID;

  if (!accessToken || !organizationId) {
    return null;
  }

  return { accessToken, organizationId };
}

export function isLinkedInConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Fetch the latest post from a LinkedIn company page
 */
export async function fetchLatestLinkedInPost(): Promise<SocialPost | null> {
  const config = getConfig();
  
  if (!config) {
    console.log('LinkedIn not configured. Required: LINKEDIN_ACCESS_TOKEN, LINKEDIN_ORGANIZATION_ID');
    return null;
  }

  try {
    // Fetch organization posts using Marketing API
    const response = await fetch(
      `https://api.linkedin.com/rest/posts?q=author&author=urn%3Ali%3Aorganization%3A${config.organizationId}&count=1&sortBy=LAST_MODIFIED`,
      {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202401',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LinkedIn API error:', response.status, errorText);
      
      if (response.status === 401) {
        console.error('LinkedIn access token expired or invalid. Regenerate at https://www.linkedin.com/developers/');
      } else if (response.status === 403) {
        console.error('LinkedIn Marketing API access required. Request at https://www.linkedin.com/developers/apps/YOUR_APP_ID/products');
      }
      
      return null;
    }

    const data = await response.json();
    const posts = data.elements || [];

    if (posts.length === 0) {
      return null;
    }

    const latestPost = posts[0] as LinkedInPost;

    // Fetch social engagement metrics
    const socialStats = await fetchPostStats(config.accessToken, latestPost.id);

    return {
      platform: 'linkedin',
      title: latestPost.commentary?.slice(0, 100) || 'LinkedIn Post',
      impressions: formatNumber(socialStats.impressions),
      reactions: formatNumber(socialStats.likes),
      comments: formatNumber(socialStats.comments),
      postedAt: formatTimeAgo(latestPost.created.time),
    };
  } catch (error) {
    console.error('Failed to fetch LinkedIn post:', error);
    return null;
  }
}

/**
 * Fetch engagement stats for a specific post
 */
async function fetchPostStats(
  accessToken: string,
  postUrn: string
): Promise<{ impressions: number; likes: number; comments: number }> {
  try {
    const response = await fetch(
      `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(postUrn)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202401',
        },
      }
    );

    if (!response.ok) {
      return { impressions: 0, likes: 0, comments: 0 };
    }

    const data = await response.json();
    return {
      impressions: data.impressionCount || 0,
      likes: data.likesSummary?.totalLikes || 0,
      comments: data.commentsSummary?.totalFirstLevelComments || 0,
    };
  } catch {
    return { impressions: 0, likes: 0, comments: 0 };
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);

  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'now';
}

/**
 * Get LinkedIn Organization ID from company vanity name
 * 
 * Call this once to get your organization ID:
 * 1. Go to your LinkedIn company page
 * 2. The URL is: linkedin.com/company/sakohq
 * 3. Use this function to convert "sakohq" to the numeric org ID
 */
export async function getOrganizationIdFromVanityName(
  accessToken: string,
  vanityName: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.linkedin.com/rest/organizations?q=vanityName&vanityName=${vanityName}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202401',
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to lookup organization:', await response.text());
      return null;
    }

    const data = await response.json();
    const org = data.elements?.[0];
    
    if (org) {
      // Extract numeric ID from URN like "urn:li:organization:12345"
      const urn = org['$URN'] || org.id;
      const match = urn?.match(/organization:(\d+)/);
      return match ? match[1] : null;
    }

    return null;
  } catch (error) {
    console.error('Failed to get organization ID:', error);
    return null;
  }
}
