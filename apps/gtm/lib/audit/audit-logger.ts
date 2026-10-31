/**
 * Audit Logger
 * 
 * Comprehensive audit logging for enterprise compliance.
 * Tracks all significant actions with full context.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { headers } from 'next/headers'

export interface AuditEvent {
  workspaceId: string
  userId: string
  userEmail?: string
  action: AuditAction
  resourceType: ResourceType
  resourceId?: string
  resourceName?: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  metadata?: Record<string, any>
}

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'deploy'
  | 'publish'
  | 'archive'
  | 'restore'
  | 'export'
  | 'import'
  | 'login'
  | 'logout'
  | 'invite'
  | 'remove_member'
  | 'change_role'
  | 'connect_provider'
  | 'disconnect_provider'
  | 'api_key_create'
  | 'api_key_revoke'
  | 'settings_change'
  | 'billing_change'
  | 'sso_config_change'
  | 'escalate_to_sako'
  | 'claim_validation'
  | 'approve'
  | 'reject'

export type ResourceType =
  | 'campaign'
  | 'brand'
  | 'template'
  | 'connection'
  | 'user'
  | 'workspace'
  | 'api_key'
  | 'billing'
  | 'settings'
  | 'sso'
  | 'claim'
  | 'deployment'
  | 'experiment'

class AuditLogger {
  private _supabase: ReturnType<typeof createServiceClient> | null = null
  
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createServiceClient()
    }
    return this._supabase
  }

  /**
   * Log an audit event
   */
  async log(event: AuditEvent): Promise<void> {
    try {
      // Get request context
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
      const userAgent = headersList.get('user-agent')
      const requestId = headersList.get('x-request-id')

      await this.supabase.from('audit_logs').insert({
        workspace_id: event.workspaceId,
        user_id: event.userId,
        user_email: event.userEmail,
        action: event.action,
        resource_type: event.resourceType,
        resource_id: event.resourceId,
        resource_name: event.resourceName,
        old_values: event.oldValues,
        new_values: event.newValues,
        ip_address: ipAddress,
        user_agent: userAgent,
        request_id: requestId,
        metadata: event.metadata,
      })
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      console.error('Audit logging failed:', error)
    }
  }

  /**
   * Log campaign creation
   */
  async logCampaignCreate(
    workspaceId: string,
    userId: string,
    userEmail: string,
    campaignId: string,
    campaignName: string,
    campaignData: Record<string, any>
  ): Promise<void> {
    await this.log({
      workspaceId,
      userId,
      userEmail,
      action: 'create',
      resourceType: 'campaign',
      resourceId: campaignId,
      resourceName: campaignName,
      newValues: campaignData,
    })
  }

  /**
   * Log campaign update with diff
   */
  async logCampaignUpdate(
    workspaceId: string,
    userId: string,
    userEmail: string,
    campaignId: string,
    campaignName: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>
  ): Promise<void> {
    // Only log the diff
    const changedFields: Record<string, any> = {}
    const previousFields: Record<string, any> = {}

    for (const key of Object.keys(newValues)) {
      if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
        changedFields[key] = newValues[key]
        previousFields[key] = oldValues[key]
      }
    }

    if (Object.keys(changedFields).length === 0) return

    await this.log({
      workspaceId,
      userId,
      userEmail,
      action: 'update',
      resourceType: 'campaign',
      resourceId: campaignId,
      resourceName: campaignName,
      oldValues: previousFields,
      newValues: changedFields,
    })
  }

  /**
   * Log deployment
   */
  async logDeployment(
    workspaceId: string,
    userId: string,
    userEmail: string,
    campaignId: string,
    campaignName: string,
    provider: string,
    result: { success: boolean; externalId?: string; error?: string }
  ): Promise<void> {
    await this.log({
      workspaceId,
      userId,
      userEmail,
      action: 'deploy',
      resourceType: 'deployment',
      resourceId: campaignId,
      resourceName: campaignName,
      metadata: {
        provider,
        success: result.success,
        externalId: result.externalId,
        error: result.error,
      },
    })
  }

  /**
   * Log Sako escalation
   */
  async logSakoEscalation(
    workspaceId: string,
    userId: string,
    userEmail: string,
    campaignId: string,
    campaignName: string,
    taskId: string,
    reason: string
  ): Promise<void> {
    await this.log({
      workspaceId,
      userId,
      userEmail,
      action: 'escalate_to_sako',
      resourceType: 'campaign',
      resourceId: campaignId,
      resourceName: campaignName,
      metadata: {
        sakoTaskId: taskId,
        reason,
      },
    })
  }

  /**
   * Log provider connection
   */
  async logProviderConnect(
    workspaceId: string,
    userId: string,
    userEmail: string,
    provider: string,
    externalId: string
  ): Promise<void> {
    await this.log({
      workspaceId,
      userId,
      userEmail,
      action: 'connect_provider',
      resourceType: 'connection',
      resourceId: externalId,
      resourceName: provider,
    })
  }

  /**
   * Log team member changes
   */
  async logMemberInvite(
    workspaceId: string,
    userId: string,
    userEmail: string,
    invitedEmail: string,
    role: string
  ): Promise<void> {
    await this.log({
      workspaceId,
      userId,
      userEmail,
      action: 'invite',
      resourceType: 'user',
      resourceName: invitedEmail,
      newValues: { role },
    })
  }

  async logMemberRemove(
    workspaceId: string,
    userId: string,
    userEmail: string,
    removedUserId: string,
    removedEmail: string
  ): Promise<void> {
    await this.log({
      workspaceId,
      userId,
      userEmail,
      action: 'remove_member',
      resourceType: 'user',
      resourceId: removedUserId,
      resourceName: removedEmail,
    })
  }

  async logRoleChange(
    workspaceId: string,
    userId: string,
    userEmail: string,
    targetUserId: string,
    targetEmail: string,
    oldRole: string,
    newRole: string
  ): Promise<void> {
    await this.log({
      workspaceId,
      userId,
      userEmail,
      action: 'change_role',
      resourceType: 'user',
      resourceId: targetUserId,
      resourceName: targetEmail,
      oldValues: { role: oldRole },
      newValues: { role: newRole },
    })
  }

  /**
   * Log API key events
   */
  async logApiKeyCreate(
    workspaceId: string,
    userId: string,
    userEmail: string,
    keyName: string,
    keyPrefix: string
  ): Promise<void> {
    await this.log({
      workspaceId,
      userId,
      userEmail,
      action: 'api_key_create',
      resourceType: 'api_key',
      resourceName: keyName,
      metadata: { keyPrefix },
    })
  }

  async logApiKeyRevoke(
    workspaceId: string,
    userId: string,
    userEmail: string,
    keyName: string
  ): Promise<void> {
    await this.log({
      workspaceId,
      userId,
      userEmail,
      action: 'api_key_revoke',
      resourceType: 'api_key',
      resourceName: keyName,
    })
  }

  /**
   * Log billing changes
   */
  async logBillingChange(
    workspaceId: string,
    userId: string,
    userEmail: string,
    changeType: 'plan_upgrade' | 'plan_downgrade' | 'payment_method' | 'subscription_cancel',
    details: Record<string, any>
  ): Promise<void> {
    await this.log({
      workspaceId,
      userId,
      userEmail,
      action: 'billing_change',
      resourceType: 'billing',
      metadata: {
        changeType,
        ...details,
      },
    })
  }

  /**
   * Log SSO configuration changes
   */
  async logSsoConfigChange(
    workspaceId: string,
    userId: string,
    userEmail: string,
    action: 'enable' | 'disable' | 'update',
    provider: string
  ): Promise<void> {
    await this.log({
      workspaceId,
      userId,
      userEmail,
      action: 'sso_config_change',
      resourceType: 'sso',
      metadata: {
        ssoAction: action,
        provider,
      },
    })
  }

  /**
   * Log claim validation
   */
  async logClaimValidation(
    workspaceId: string,
    userId: string,
    campaignId: string,
    claimId: string,
    claim: string,
    result: { status: string; riskScore: number; issues: string[] }
  ): Promise<void> {
    await this.log({
      workspaceId,
      userId,
      action: 'claim_validation',
      resourceType: 'claim',
      resourceId: claimId,
      resourceName: claim.slice(0, 100),
      metadata: {
        campaignId,
        status: result.status,
        riskScore: result.riskScore,
        issueCount: result.issues.length,
      },
    })
  }

  /**
   * Get audit logs for a workspace
   */
  async getAuditLogs(
    workspaceId: string,
    options: {
      limit?: number
      offset?: number
      action?: AuditAction
      resourceType?: ResourceType
      userId?: string
      startDate?: Date
      endDate?: Date
    } = {}
  ): Promise<{
    logs: any[]
    total: number
  }> {
    let query = this.supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (options.action) {
      query = query.eq('action', options.action)
    }

    if (options.resourceType) {
      query = query.eq('resource_type', options.resourceType)
    }

    if (options.userId) {
      query = query.eq('user_id', options.userId)
    }

    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString())
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString())
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
    }

    const { data, count, error } = await query

    if (error) {
      console.error('Failed to fetch audit logs:', error)
      return { logs: [], total: 0 }
    }

    return {
      logs: data || [],
      total: count || 0,
    }
  }

  /**
   * Export audit logs to CSV
   */
  async exportToCsv(workspaceId: string, startDate: Date, endDate: Date): Promise<string> {
    const { logs } = await this.getAuditLogs(workspaceId, {
      startDate,
      endDate,
      limit: 10000,
    })

    const headers = [
      'Timestamp',
      'User',
      'Action',
      'Resource Type',
      'Resource Name',
      'IP Address',
      'Details',
    ]

    const rows = logs.map((log) => [
      log.created_at,
      log.user_email || log.user_id,
      log.action,
      log.resource_type,
      log.resource_name || log.resource_id || '',
      log.ip_address || '',
      JSON.stringify(log.metadata || {}),
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n')

    return csv
  }
}

// Singleton instance
export const auditLogger = new AuditLogger()
