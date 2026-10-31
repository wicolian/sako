/**
 * Campaign Version Control (Phase 6.1)
 * 
 * Full vers

on history with diff view and rollback capability.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface CampaignVersion {
  id: string
  campaign_id: string
  workspace_id: string
  version_number: number
  version_tag?: string
  snapshot: Record<string, unknown>
  diff_from_previous?: Record<string, unknown>
  changes_summary?: string
  change_type?: 'content' | 'structure' | 'settings' | 'major' | 'minor'
  created_by?: string
  description?: string
  is_published: boolean
  is_current: boolean
  restored_from_version?: number
  created_at: string
}

export interface VersionDiff {
  field: string
  old_value: unknown
  new_value: unknown
  change_type: 'added' | 'removed' | 'modified'
}

/**
 * Create a new version of a campaign
 */
export async function createCampaignVersion(
  campaignId: string,
  options?: {
    description?: string
    changeType?: 'content' | 'structure' | 'settings' | 'major' | 'minor'
    versionTag?: string
  }
): Promise<CampaignVersion | null> {
  const supabase = createServiceClient()

  // Get current campaign state
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle()

  if (campaignError || !campaign) {
    console.error('Failed to get campaign for versioning:', campaignError)
    return null
  }

  // Get current version number
  const { data: versions } = await supabase
    .from('campaign_versions')
    .select('version_number')
    .eq('campaign_id', campaignId)
    .order('version_number', { ascending: false })
    .limit(1)

  const nextVersionNumber = (versions?.[0]?.version_number || 0) + 1

  // Get previous snapshot for diff
  const { data: previousVersion } = await supabase
    .from('campaign_versions')
    .select('snapshot')
    .eq('campaign_id', campaignId)
    .eq('is_current', true)
    .maybeSingle()

  // Calculate diff
  let diff: Record<string, VersionDiff[]> | undefined
  if (previousVersion?.snapshot) {
    diff = calculateDiff(previousVersion.snapshot as Record<string, unknown>, campaign)
  }

  // Generate changes summary
  const changesSummary = diff ? generateChangesSummary(diff) : 'Initial version'

  // Unset current flag on previous version
  await supabase
    .from('campaign_versions')
    .update({ is_current: false })
    .eq('campaign_id', campaignId)
    .eq('is_current', true)

  // Create new version
  const { data: newVersion, error: versionError } = await supabase
    .from('campaign_versions')
    .insert({
      campaign_id: campaignId,
      workspace_id: campaign.workspace_id,
      version_number: nextVersionNumber,
      version_tag: options?.versionTag,
      snapshot: campaign,
      diff_from_previous: diff,
      changes_summary: options?.description || changesSummary,
      change_type: options?.changeType || 'content',
      is_current: true,
      is_published: campaign.status === 'published',
    })
    .select()
    .maybeSingle()

  if (versionError) {
    console.error('Failed to create campaign version:', versionError)
    return null
  }

  // Update campaign version info
  await supabase
    .from('campaigns')
    .update({
      current_version: nextVersionNumber,
      version_count: nextVersionNumber,
    })
    .eq('id', campaignId)

  return newVersion as CampaignVersion
}

/**
 * Get all versions of a campaign
 */
export async function getCampaignVersions(campaignId: string): Promise<CampaignVersion[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('campaign_versions')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('version_number', { ascending: false })

  if (error) {
    console.error('Failed to get campaign versions:', error)
    return []
  }

  return (data || []) as CampaignVersion[]
}

/**
 * Get a specific version
 */
export async function getCampaignVersion(
  campaignId: string,
  versionNumber: number
): Promise<CampaignVersion | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('campaign_versions')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('version_number', versionNumber)
    .maybeSingle()

  if (error) {
    return null
  }

  return data as CampaignVersion
}

/**
 * Restore a campaign to a previous version
 */
export async function restoreCampaignVersion(
  campaignId: string,
  versionNumber: number,
  userId?: string
): Promise<CampaignVersion | null> {
  const supabase = createServiceClient()

  // Get the version to restore
  const version = await getCampaignVersion(campaignId, versionNumber)
  if (!version) {
    throw new Error(`Version ${versionNumber} not found for campaign ${campaignId}`)
  }

  const snapshot = version.snapshot as Record<string, unknown>

  // Update campaign with snapshot data
  const { error: updateError } = await supabase
    .from('campaigns')
    .update({
      name: snapshot.name,
      audience: snapshot.audience,
      goal: snapshot.goal,
      offer: snapshot.offer,
      cta: snapshot.cta,
      status: 'draft', // Reset to draft when restoring
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)

  if (updateError) {
    console.error('Failed to restore campaign:', updateError)
    return null
  }

  // Create a new version to record the restoration
  const newVersion = await createCampaignVersion(campaignId, {
    description: `Restored from version ${versionNumber}`,
    changeType: 'major',
  })

  // Mark the restoration source
  if (newVersion) {
    await supabase
      .from('campaign_versions')
      .update({ restored_from_version: versionNumber })
      .eq('id', newVersion.id)
  }

  return newVersion
}

/**
 * Compare two versions
 */
export async function compareCampaignVersions(
  campaignId: string,
  versionA: number,
  versionB: number
): Promise<{
  versionA: CampaignVersion
  versionB: CampaignVersion
  diff: Record<string, VersionDiff[]>
}> {
  const [verA, verB] = await Promise.all([
    getCampaignVersion(campaignId, versionA),
    getCampaignVersion(campaignId, versionB),
  ])

  if (!verA || !verB) {
    throw new Error('One or both versions not found')
  }

  const diff = calculateDiff(
    verA.snapshot as Record<string, unknown>,
    verB.snapshot as Record<string, unknown>
  )

  return {
    versionA: verA,
    versionB: verB,
    diff,
  }
}

/**
 * Calculate diff between two objects
 */
function calculateDiff(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>
): Record<string, VersionDiff[]> {
  const diffs: Record<string, VersionDiff[]> = {}
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])

  for (const key of allKeys) {
    // Skip metadata fields
    if (['id', 'workspace_id', 'created_at', 'updated_at'].includes(key)) {
      continue
    }

    const oldValue = oldObj[key]
    const newValue = newObj[key]

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      const changeType = oldValue === undefined ? 'added' :
                        newValue === undefined ? 'removed' : 'modified'

      if (!diffs[key]) {
        diffs[key] = []
      }

      diffs[key].push({
        field: key,
        old_value: oldValue,
        new_value: newValue,
        change_type: changeType,
      })
    }
  }

  return diffs
}

/**
 * Generate a human-readable changes summary
 */
function generateChangesSummary(diff: Record<string, VersionDiff[]>): string {
  const changes: string[] = []

  for (const [field, fieldDiffs] of Object.entries(diff)) {
    for (const d of fieldDiffs) {
      switch (d.change_type) {
        case 'added':
          changes.push(`Added ${field}`)
          break
        case 'removed':
          changes.push(`Removed ${field}`)
          break
        case 'modified':
          changes.push(`Updated ${field}`)
          break
      }
    }
  }

  if (changes.length === 0) {
    return 'No changes'
  }

  if (changes.length <= 3) {
    return changes.join(', ')
  }

  return `${changes.slice(0, 3).join(', ')} and ${changes.length - 3} more changes`
}

/**
 * Tag a version
 */
export async function tagCampaignVersion(
  campaignId: string,
  versionNumber: number,
  tag: string
): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('campaign_versions')
    .update({ version_tag: tag })
    .eq('campaign_id', campaignId)
    .eq('version_number', versionNumber)

  return !error
}

/**
 * Get versions by tag
 */
export async function getCampaignVersionByTag(
  campaignId: string,
  tag: string
): Promise<CampaignVersion | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('campaign_versions')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('version_tag', tag)
    .maybeSingle()

  if (error) {
    return null
  }

  return data as CampaignVersion
}

/**
 * Auto-save with version creation
 */
export async function autoSaveWithVersion(
  campaignId: string,
  updates: Record<string, unknown>
): Promise<{ saved: boolean; versionCreated: boolean; version?: CampaignVersion }> {
  const supabase = createServiceClient()

  // Save the updates
  const { error: saveError } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', campaignId)

  if (saveError) {
    return { saved: false, versionCreated: false }
  }

  // Check if we should create a version
  // (e.g., every 10 minutes or significant changes)
  const { data: lastVersion } = await supabase
    .from('campaign_versions')
    .select('created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const shouldCreateVersion = !lastVersion ||
    (Date.now() - new Date(lastVersion.created_at).getTime()) > 10 * 60 * 1000 // 10 minutes

  if (shouldCreateVersion) {
    const version = await createCampaignVersion(campaignId, {
      changeType: 'minor',
      description: 'Auto-saved',
    })

    return { saved: true, versionCreated: true, version: version || undefined }
  }

  return { saved: true, versionCreated: false }
}
