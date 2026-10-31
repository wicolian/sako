/**
 * Share Analytics (Phase 2.4)
 * 
 * Track views and engagement on shared campaign links.
 */

import { createServiceClient } from '@/lib/supabase/service'
import crypto from 'crypto'

export interface ShareLink {
  id: string
  campaign_id: string
  workspace_id: string
  token: string
  name?: string
  password_protected: boolean
  password_hash?: string
  expires_at?: string
  view_count: number
  unique_views: number
  is_active: boolean
  created_by: string
  created_at: string
  last_viewed_at?: string
}

export interface ShareView {
  id: string
  share_id: string
  visitor_id: string
  ip_hash: string
  user_agent?: string
  referrer?: string
  country?: string
  city?: string
  device_type?: string
  duration_seconds?: number
  viewed_at: string
}

export interface ShareAnalytics {
  totalViews: number
  uniqueVisitors: number
  avgDuration: number
  viewsByDay: Array<{ date: string; views: number }>
  viewsByCountry: Array<{ country: string; views: number }>
  viewsByDevice: Array<{ device: string; views: number }>
  topReferrers: Array<{ referrer: string; views: number }>
}

/**
 * Create a share link for a campaign
 */
export async function createShareLink(
  campaignId: string,
  workspaceId: string,
  userId: string,
  options?: {
    name?: string
    password?: string
    expiresAt?: Date
  }
): Promise<ShareLink | null> {
  const supabase = createServiceClient()

  // Generate unique token
  const token = crypto.randomBytes(16).toString('base64url')

  // Hash password if provided
  let passwordHash: string | undefined
  if (options?.password) {
    passwordHash = crypto
      .createHash('sha256')
      .update(options.password)
      .digest('hex')
  }

  const { data, error } = await supabase
    .from('share_links')
    .insert({
      campaign_id: campaignId,
      workspace_id: workspaceId,
      token,
      name: options?.name,
      password_protected: Boolean(options?.password),
      password_hash: passwordHash,
      expires_at: options?.expiresAt?.toISOString(),
      view_count: 0,
      unique_views: 0,
      is_active: true,
      created_by: userId,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create share link:', error)
    return null
  }

  return data as ShareLink
}

/**
 * Get share link by token
 */
export async function getShareLinkByToken(token: string): Promise<ShareLink | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('share_links')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (error) {
    return null
  }

  // Check if expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null
  }

  return data as ShareLink
}

/**
 * Verify share link password
 */
export function verifySharePassword(shareLink: ShareLink, password: string): boolean {
  if (!shareLink.password_protected || !shareLink.password_hash) {
    return true
  }

  const inputHash = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(shareLink.password_hash),
    Buffer.from(inputHash)
  )
}

/**
 * Record a share view
 */
export async function recordShareView(
  shareId: string,
  viewerInfo: {
    ip: string
    userAgent?: string
    referrer?: string
  }
): Promise<void> {
  const supabase = createServiceClient()

  // Hash IP for privacy
  const ipHash = crypto
    .createHash('sha256')
    .update(viewerInfo.ip)
    .digest('hex')
    .substring(0, 16)

  // Generate visitor ID from IP hash
  const visitorId = ipHash

  // Detect device type from user agent
  let deviceType = 'desktop'
  if (viewerInfo.userAgent) {
    const ua = viewerInfo.userAgent.toLowerCase()
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      deviceType = 'mobile'
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      deviceType = 'tablet'
    }
  }

  // Check if this is a unique view (visitor hasn't viewed in last 24 hours)
  const { data: existingView } = await supabase
    .from('share_views')
    .select('id')
    .eq('share_id', shareId)
    .eq('visitor_id', visitorId)
    .gte('viewed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1)
    .single()

  const isUnique = !existingView

  // Record the view
  await supabase.from('share_views').insert({
    share_id: shareId,
    visitor_id: visitorId,
    ip_hash: ipHash,
    user_agent: viewerInfo.userAgent,
    referrer: viewerInfo.referrer,
    device_type: deviceType,
  })

  // Update share link stats
  const { data: shareLink } = await supabase
    .from('share_links')
    .select('view_count, unique_views')
    .eq('id', shareId)
    .single()

  await supabase
    .from('share_links')
    .update({
      view_count: (shareLink?.view_count || 0) + 1,
      unique_views: isUnique
        ? (shareLink?.unique_views || 0) + 1
        : shareLink?.unique_views || 0,
      last_viewed_at: new Date().toISOString(),
    })
    .eq('id', shareId)
}

/**
 * Record view duration (called when viewer leaves)
 */
export async function recordViewDuration(
  shareId: string,
  visitorId: string,
  durationSeconds: number
): Promise<void> {
  const supabase = createServiceClient()

  // Update the most recent view for this visitor
  const { data: views } = await supabase
    .from('share_views')
    .select('id')
    .eq('share_id', shareId)
    .eq('visitor_id', visitorId)
    .order('viewed_at', { ascending: false })
    .limit(1)

  if (views && views.length > 0) {
    await supabase
      .from('share_views')
      .update({ duration_seconds: durationSeconds })
      .eq('id', views[0].id)
  }
}

/**
 * Get analytics for a share link
 */
export async function getShareAnalytics(
  shareId: string,
  days: number = 30
): Promise<ShareAnalytics> {
  const supabase = createServiceClient()

  const since = new Date()
  since.setDate(since.getDate() - days)

  // Get all views
  const { data: views } = await supabase
    .from('share_views')
    .select('*')
    .eq('share_id', shareId)
    .gte('viewed_at', since.toISOString())

  if (!views || views.length === 0) {
    return {
      totalViews: 0,
      uniqueVisitors: 0,
      avgDuration: 0,
      viewsByDay: [],
      viewsByCountry: [],
      viewsByDevice: [],
      topReferrers: [],
    }
  }

  // Calculate metrics
  const uniqueVisitors = new Set(views.map(v => v.visitor_id)).size
  const avgDuration = views.reduce((sum, v) => sum + (v.duration_seconds || 0), 0) / views.length

  // Views by day
  const viewsByDayMap: Record<string, number> = {}
  for (const view of views) {
    const date = view.viewed_at.split('T')[0]
    viewsByDayMap[date] = (viewsByDayMap[date] || 0) + 1
  }
  const viewsByDay = Object.entries(viewsByDayMap)
    .map(([date, views]) => ({ date, views }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Views by country
  const viewsByCountryMap: Record<string, number> = {}
  for (const view of views) {
    const country = view.country || 'Unknown'
    viewsByCountryMap[country] = (viewsByCountryMap[country] || 0) + 1
  }
  const viewsByCountry = Object.entries(viewsByCountryMap)
    .map(([country, views]) => ({ country, views }))
    .sort((a, b) => b.views - a.views)

  // Views by device
  const viewsByDeviceMap: Record<string, number> = {}
  for (const view of views) {
    const device = view.device_type || 'unknown'
    viewsByDeviceMap[device] = (viewsByDeviceMap[device] || 0) + 1
  }
  const viewsByDevice = Object.entries(viewsByDeviceMap)
    .map(([device, views]) => ({ device, views }))
    .sort((a, b) => b.views - a.views)

  // Top referrers
  const referrerMap: Record<string, number> = {}
  for (const view of views) {
    const referrer = view.referrer || 'Direct'
    try {
      const domain = new URL(referrer).hostname
      referrerMap[domain] = (referrerMap[domain] || 0) + 1
    } catch {
      referrerMap[referrer] = (referrerMap[referrer] || 0) + 1
    }
  }
  const topReferrers = Object.entries(referrerMap)
    .map(([referrer, views]) => ({ referrer, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)

  return {
    totalViews: views.length,
    uniqueVisitors,
    avgDuration,
    viewsByDay,
    viewsByCountry,
    viewsByDevice,
    topReferrers,
  }
}

/**
 * Get all share links for a campaign
 */
export async function getCampaignShareLinks(campaignId: string): Promise<ShareLink[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('share_links')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to get share links:', error)
    return []
  }

  return data as ShareLink[]
}

/**
 * Deactivate a share link
 */
export async function deactivateShareLink(shareId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('share_links')
    .update({ is_active: false })
    .eq('id', shareId)

  return !error
}

/**
 * Update share link settings
 */
export async function updateShareLink(
  shareId: string,
  updates: {
    name?: string
    password?: string | null
    expiresAt?: Date | null
  }
): Promise<ShareLink | null> {
  const supabase = createServiceClient()

  const updateData: Record<string, unknown> = {}

  if (updates.name !== undefined) {
    updateData.name = updates.name
  }

  if (updates.password === null) {
    updateData.password_protected = false
    updateData.password_hash = null
  } else if (updates.password) {
    updateData.password_protected = true
    updateData.password_hash = crypto
      .createHash('sha256')
      .update(updates.password)
      .digest('hex')
  }

  if (updates.expiresAt === null) {
    updateData.expires_at = null
  } else if (updates.expiresAt) {
    updateData.expires_at = updates.expiresAt.toISOString()
  }

  const { data, error } = await supabase
    .from('share_links')
    .update(updateData)
    .eq('id', shareId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update share link:', error)
    return null
  }

  return data as ShareLink
}
