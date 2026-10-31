import { Client } from '@hubspot/api-client'
import { decrypt } from '@/lib/encryption'
import { createServiceClient } from '@/lib/supabase/service'

// Default workspace for backwards compatibility
const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'

export interface HubSpotConnection {
  id: string
  workspace_id: string
  portal_id: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  expires_at: string
  scopes: string[]
}

export async function getHubSpotClient(workspaceId?: string): Promise<Client | null> {
  const supabase = createServiceClient()
  const wsId = workspaceId || DEFAULT_WORKSPACE_ID
  
  const { data: connection } = await supabase
    .from('hubspot_connections')
    .select('*')
    .eq('workspace_id', wsId)
    .single()
  
  if (!connection) {
    return null
  }
  
  // Check if token is expired and refresh if needed
  const expiresAt = new Date(connection.expires_at)
  const now = new Date()
  
  if (expiresAt <= now) {
    // Token expired, need to refresh
    const refreshedConnection = await refreshHubSpotToken(connection)
    if (!refreshedConnection) {
      return null
    }
    return createHubSpotClient(refreshedConnection.access_token_encrypted)
  }
  
  return createHubSpotClient(connection.access_token_encrypted)
}

export async function getHubSpotAccessToken(workspaceId?: string): Promise<string | null> {
  const supabase = createServiceClient()
  const wsId = workspaceId || DEFAULT_WORKSPACE_ID
  
  const { data: connection } = await supabase
    .from('hubspot_connections')
    .select('*')
    .eq('workspace_id', wsId)
    .single()
  
  if (!connection) {
    return null
  }
  
  // Check if token is expired and refresh if needed
  const expiresAt = new Date(connection.expires_at)
  const now = new Date()
  
  if (expiresAt <= now) {
    // Token expired, need to refresh
    const refreshedConnection = await refreshHubSpotToken(connection)
    if (!refreshedConnection) {
      return null
    }
    return decrypt(refreshedConnection.access_token_encrypted)
  }
  
  return decrypt(connection.access_token_encrypted)
}

function createHubSpotClient(encryptedToken: string): Client {
  const accessToken = decrypt(encryptedToken)
  return new Client({ accessToken })
}

async function refreshHubSpotToken(connection: HubSpotConnection): Promise<HubSpotConnection | null> {
  const supabase = createServiceClient()
  
  try {
    const refreshToken = decrypt(connection.refresh_token_encrypted)
    
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.HUBSPOT_CLIENT_ID!,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      console.error('Failed to refresh HubSpot token')
      return null
    }
    
    const tokens = await response.json()
    
    const { encrypt } = await import('@/lib/encryption')
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
    
    const { data: updatedConnection, error } = await supabase
      .from('hubspot_connections')
      .update({
        access_token_encrypted: encrypt(tokens.access_token),
        refresh_token_encrypted: encrypt(tokens.refresh_token),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', connection.id)
      .select()
      .single()
    
    if (error) {
      console.error('Failed to update refreshed token:', error)
      return null
    }
    
    return updatedConnection as HubSpotConnection
  } catch (error) {
    console.error('Error refreshing HubSpot token:', error)
    return null
  }
}

// HubSpot API Functions - Using REST API directly for form creation
export async function createHubSpotForm(
  accessToken: string,
  name: string,
  _fields: { name: string; label: string; type: string; required?: boolean }[]
) {
  try {
    // Use REST API directly to avoid SDK serialization issues
    // Each field needs objectTypeId (0-0-1 = contacts) and validation object
    const formPayload = {
      name,
      formType: 'hubspot',
      configuration: {
        language: 'en',
        cloneable: true,
        editable: true,
        archivable: true,
      },
      displayOptions: {
        renderRawHtml: false,
        style: {
          fontFamily: 'arial, helvetica, sans-serif',
          submitColor: '#9ae83e',
        },
      },
      fieldGroups: [
        {
          groupType: 'default_group',
          richTextType: 'text',
          fields: [
            { 
              name: 'email', 
              label: 'Email', 
              fieldType: 'email', 
              required: true,
              objectTypeId: '0-1',
              validation: { blockedEmailDomains: [], useDefaultBlockList: true }
            },
            { 
              name: 'firstname', 
              label: 'First Name', 
              fieldType: 'single_line_text', 
              required: true,
              objectTypeId: '0-1',
              validation: {}
            },
            { 
              name: 'lastname', 
              label: 'Last Name', 
              fieldType: 'single_line_text', 
              required: false,
              objectTypeId: '0-1',
              validation: {}
            },
            { 
              name: 'company', 
              label: 'Company', 
              fieldType: 'single_line_text', 
              required: false,
              objectTypeId: '0-1',
              validation: {}
            },
          ],
        },
      ],
      legalConsentOptions: {
        type: 'none',
      },
    }

    const response = await fetch('https://api.hubapi.com/marketing/v3/forms/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(formPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('HubSpot form creation error:', response.status, errorText)
      throw new Error(`Form creation failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    return {
      id: result.id,
      portalId: result.portalId,
      guid: result.id,
    }
  } catch (error: any) {
    console.error('Failed to create HubSpot form:', error.message)
    throw error
  }
}

export async function createHubSpotLandingPage(
  client: Client,
  name: string,
  htmlContent: string
) {
  try {
    // HubSpot CMS API for creating landing pages
    const response = await client.cms.pages.landingPagesApi.create({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      state: 'DRAFT',
      htmlTitle: name,
      contentTypeCategory: 'LANDING_PAGE',
    } as any)
    
    const result = response as any
    return {
      id: result.id,
      url: `https://app.hubspot.com/content/${result.id}`,
    }
  } catch (error: any) {
    // CMS API might not be available on all HubSpot plans
    console.error('Failed to create landing page:', error.message)
    return null
  }
}

export async function createHubSpotEmailDraft(
  _client: Client,
  name: string,
  subject: string,
  _body: string
) {
  // Email template creation requires Marketing Hub Professional+
  // and a more complex setup with template IDs
  // For now, return a placeholder that indicates email was prepared
  return {
    id: `email-draft-${Date.now()}`,
    name,
    subject,
    note: 'Email content prepared - requires manual creation in HubSpot',
  }
}

export async function getHubSpotFormSubmissions(accessToken: string, formGuid: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.hubapi.com/form-integrations/v1/submissions/forms/${formGuid}?limit=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to get HubSpot form submissions:', response.status, errorText)
      return null
    }

    const result = await response.json() as { results?: unknown[] }
    return result.results?.length ?? 0
  } catch (error: any) {
    console.error('Failed to get form submissions:', error.message)
    return null
  }
}

export async function getHubSpotEmailStats(
  accessToken: string,
  emailId: string
): Promise<{ emailOpens: number | null; emailClicks: number | null }> {
  try {
    const response = await fetch(`https://api.hubapi.com/marketing/v3/emails/${emailId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to get HubSpot email stats:', response.status, errorText)
      return { emailOpens: null, emailClicks: null }
    }

    const result = await response.json() as {
      stats?: {
        counters?: {
          open?: number
          click?: number
        }
        open?: number
        click?: number
      }
    }

    const counters = result.stats?.counters

    return {
      emailOpens: counters?.open ?? result.stats?.open ?? null,
      emailClicks: counters?.click ?? result.stats?.click ?? null,
    }
  } catch (error: any) {
    console.error('Failed to get email stats:', error.message)
    return { emailOpens: null, emailClicks: null }
  }
}

export async function getHubSpotAnalytics(client: Client, objectId: string, objectType: 'form' | 'page' | 'email') {
  try {
    // HubSpot Analytics API
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    // Get contacts created in the last 30 days
    const contactsResponse = await client.crm.contacts.searchApi.doSearch({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'createdate',
              operator: 'GTE' as any,
              value: thirtyDaysAgo.toISOString(),
              },
            ],
          },
        ],
      limit: 100,
      properties: ['email', 'firstname', 'lastname', 'createdate'],
    })
    
    return {
      contactsCreated: contactsResponse.total,
      contacts: contactsResponse.results,
    }
  } catch (error: any) {
    console.error('Failed to get analytics:', error.message)
    return null
  }
}
