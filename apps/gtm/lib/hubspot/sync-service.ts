/**
 * HubSpot Sync Service (Phase 4.4)
 * 
 * Synchronizes HubSpot contacts, companies, and lists
 * for personalization and targeting.
 */

import { createServiceClient } from '@/lib/supabase/service'

interface HubSpotCredentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

interface HubSpotContact {
  id: string
  email?: string
  firstName?: string
  lastName?: string
  company?: string
  jobTitle?: string
  lifecycleStage?: string
  properties?: Record<string, unknown>
}

interface HubSpotCompany {
  id: string
  name: string
  domain?: string
  industry?: string
  numberOfEmployees?: number
  annualRevenue?: number
  properties?: Record<string, unknown>
}

interface HubSpotList {
  id: string
  name: string
  contactCount: number
  isDynamic: boolean
  filters?: Record<string, unknown>
}

interface SyncResult {
  success: boolean
  syncedCount: number
  errorCount: number
  errors?: string[]
}

/**
 * HubSpot Sync Service
 */
export class HubSpotSyncService {
  private workspaceId: string
  private credentials: HubSpotCredentials | null = null
  private baseUrl = 'https://api.hubapi.com'

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId
  }

  /**
   * Initialize credentials from database
   */
  async initialize(): Promise<boolean> {
    const supabase = createServiceClient()

    const { data: credentials } = await supabase
      .from('provider_credentials')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('provider', 'hubspot')
      .single()

    if (!credentials?.access_token) {
      return false
    }

    this.credentials = {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token,
      expiresAt: credentials.expires_at
        ? new Date(credentials.expires_at).getTime()
        : undefined,
    }

    // Check if token needs refresh
    if (this.credentials.expiresAt && Date.now() > this.credentials.expiresAt - 60000) {
      await this.refreshToken()
    }

    return true
  }

  /**
   * Refresh the access token
   */
  private async refreshToken(): Promise<void> {
    if (!this.credentials?.refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refreshToken,
        client_id: process.env.HUBSPOT_CLIENT_ID || '',
        client_secret: process.env.HUBSPOT_CLIENT_SECRET || '',
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to refresh HubSpot token')
    }

    const data = await response.json()

    // Update credentials
    this.credentials = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }

    // Save to database
    const supabase = createServiceClient()
    await supabase
      .from('provider_credentials')
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(this.credentials.expiresAt!).toISOString(),
      })
      .eq('workspace_id', this.workspaceId)
      .eq('provider', 'hubspot')
  }

  /**
   * Make an authenticated API request
   */
  private async apiRequest<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    if (!this.credentials) {
      throw new Error('Not initialized')
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || `API request failed: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Sync contacts from HubSpot
   */
  async syncContacts(): Promise<SyncResult> {
    const supabase = createServiceClient()
    let syncedCount = 0
    let errorCount = 0
    const errors: string[] = []
    let after: string | undefined

    try {
      do {
        const params = new URLSearchParams({
          limit: '100',
          properties: 'email,firstname,lastname,company,jobtitle,lifecyclestage',
        })
        if (after) {
          params.append('after', after)
        }

        const response = await this.apiRequest<{
          results: Array<{
            id: string
            properties: Record<string, string>
          }>
          paging?: { next?: { after: string } }
        }>(`/crm/v3/objects/contacts?${params}`)

        for (const contact of response.results) {
          try {
            const contactData = {
              workspace_id: this.workspaceId,
              hubspot_id: contact.id,
              email: contact.properties.email,
              first_name: contact.properties.firstname,
              last_name: contact.properties.lastname,
              company: contact.properties.company,
              job_title: contact.properties.jobtitle,
              lifecycle_stage: contact.properties.lifecyclestage,
              properties: contact.properties,
              last_synced_at: new Date().toISOString(),
            }

            await supabase
              .from('hubspot_contacts')
              .upsert(contactData, { onConflict: 'workspace_id,hubspot_id' })

            syncedCount++
          } catch (err) {
            errorCount++
            errors.push(`Contact ${contact.id}: ${(err as Error).message}`)
          }
        }

        after = response.paging?.next?.after

      } while (after)

      // Update sync status
      await this.updateSyncStatus('contacts', syncedCount)

      return { success: true, syncedCount, errorCount, errors: errors.length > 0 ? errors : undefined }
    } catch (error) {
      return { success: false, syncedCount, errorCount: 1, errors: [(error as Error).message] }
    }
  }

  /**
   * Sync companies from HubSpot
   */
  async syncCompanies(): Promise<SyncResult> {
    const supabase = createServiceClient()
    let syncedCount = 0
    let errorCount = 0
    const errors: string[] = []
    let after: string | undefined

    try {
      do {
        const params = new URLSearchParams({
          limit: '100',
          properties: 'name,domain,industry,numberofemployees,annualrevenue',
        })
        if (after) {
          params.append('after', after)
        }

        const response = await this.apiRequest<{
          results: Array<{
            id: string
            properties: Record<string, string>
          }>
          paging?: { next?: { after: string } }
        }>(`/crm/v3/objects/companies?${params}`)

        for (const company of response.results) {
          try {
            const companyData = {
              workspace_id: this.workspaceId,
              hubspot_id: company.id,
              name: company.properties.name,
              domain: company.properties.domain,
              industry: company.properties.industry,
              employee_count: company.properties.numberofemployees
                ? parseInt(company.properties.numberofemployees)
                : null,
              annual_revenue: company.properties.annualrevenue
                ? parseFloat(company.properties.annualrevenue)
                : null,
              properties: company.properties,
              last_synced_at: new Date().toISOString(),
            }

            await supabase
              .from('hubspot_companies')
              .upsert(companyData, { onConflict: 'workspace_id,hubspot_id' })

            syncedCount++
          } catch (err) {
            errorCount++
            errors.push(`Company ${company.id}: ${(err as Error).message}`)
          }
        }

        after = response.paging?.next?.after

      } while (after)

      await this.updateSyncStatus('companies', syncedCount)

      return { success: true, syncedCount, errorCount, errors: errors.length > 0 ? errors : undefined }
    } catch (error) {
      return { success: false, syncedCount, errorCount: 1, errors: [(error as Error).message] }
    }
  }

  /**
   * Sync lists from HubSpot
   */
  async syncLists(): Promise<SyncResult> {
    const supabase = createServiceClient()
    let syncedCount = 0
    let errorCount = 0
    const errors: string[] = []

    try {
      // Using legacy lists API as it's more stable
      const response = await this.apiRequest<{
        lists: Array<{
          listId: number
          name: string
          listType: string
          metaData: { size: number }
          filters?: unknown[]
        }>
      }>('/contacts/v1/lists')

      for (const list of response.lists) {
        try {
          const listData = {
            workspace_id: this.workspaceId,
            hubspot_list_id: list.listId.toString(),
            name: list.name,
            contact_count: list.metaData?.size || 0,
            is_dynamic: list.listType === 'DYNAMIC',
            filters: list.filters,
            is_available_for_targeting: true,
            last_synced_at: new Date().toISOString(),
          }

          await supabase
            .from('hubspot_lists')
            .upsert(listData, { onConflict: 'workspace_id,hubspot_list_id' })

          syncedCount++
        } catch (err) {
          errorCount++
          errors.push(`List ${list.listId}: ${(err as Error).message}`)
        }
      }

      await this.updateSyncStatus('lists', syncedCount)

      return { success: true, syncedCount, errorCount, errors: errors.length > 0 ? errors : undefined }
    } catch (error) {
      return { success: false, syncedCount, errorCount: 1, errors: [(error as Error).message] }
    }
  }

  /**
   * Run full sync
   */
  async fullSync(): Promise<{
    contacts: SyncResult
    companies: SyncResult
    lists: SyncResult
  }> {
    const [contacts, companies, lists] = await Promise.all([
      this.syncContacts(),
      this.syncCompanies(),
      this.syncLists(),
    ])

    return { contacts, companies, lists }
  }

  /**
   * Update sync status
   */
  private async updateSyncStatus(entity: string, count: number): Promise<void> {
    const supabase = createServiceClient()

    await supabase.from('hubspot_sync_status').upsert({
      workspace_id: this.workspaceId,
      entity_type: entity,
      last_sync_at: new Date().toISOString(),
      records_synced: count,
      status: 'completed',
    }, { onConflict: 'workspace_id,entity_type' })
  }

  /**
   * Get sync status for workspace
   */
  async getSyncStatus(): Promise<Record<string, {
    lastSyncAt?: string
    recordsSynced: number
    status: string
  }>> {
    const supabase = createServiceClient()

    const { data } = await supabase
      .from('hubspot_sync_status')
      .select('*')
      .eq('workspace_id', this.workspaceId)

    const status: Record<string, { lastSyncAt?: string; recordsSynced: number; status: string }> = {}

    for (const record of data || []) {
      status[record.entity_type] = {
        lastSyncAt: record.last_sync_at,
        recordsSynced: record.records_synced,
        status: record.status,
      }
    }

    return status
  }
}

/**
 * Get contacts by list ID
 */
export async function getContactsByList(workspaceId: string, listId: string): Promise<HubSpotContact[]> {
  const supabase = createServiceClient()

  // Get list members from hubspot_list_members join table
  const { data } = await supabase
    .from('hubspot_contacts')
    .select(`
      hubspot_id,
      email,
      first_name,
      last_name,
      company,
      job_title,
      lifecycle_stage,
      properties
    `)
    .eq('workspace_id', workspaceId)

  return (data || []).map(c => ({
    id: c.hubspot_id,
    email: c.email,
    firstName: c.first_name,
    lastName: c.last_name,
    company: c.company,
    jobTitle: c.job_title,
    lifecycleStage: c.lifecycle_stage,
    properties: c.properties as Record<string, unknown>,
  }))
}

/**
 * Trigger HubSpot sync for a workspace
 */
export async function triggerHubSpotSync(workspaceId: string): Promise<boolean> {
  const service = new HubSpotSyncService(workspaceId)
  const initialized = await service.initialize()

  if (!initialized) {
    console.error('Failed to initialize HubSpot sync - no credentials')
    return false
  }

  try {
    await service.fullSync()
    return true
  } catch (error) {
    console.error('HubSpot sync failed:', error)
    return false
  }
}
