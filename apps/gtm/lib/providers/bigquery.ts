/**
 * Google BigQuery Integration
 * 
 * Enables database-driven content generation at scale:
 * - Bulk data export from Sako to BigQuery
 * - Analytics queries
 * - Campaign performance data sync
 */

import { createServiceClient } from '@/lib/supabase/service'
import { encrypt, decrypt } from '@/lib/encryption'

// ============================================================================
// Types
// ============================================================================

export interface BigQueryConnection {
  id: string
  workspace_id: string
  project_id: string
  dataset_id: string
  credentials_encrypted: string
  sync_enabled: boolean
  last_sync_at?: string
  created_at: string
  updated_at: string
}

export interface BigQueryExportOptions {
  tableId: string
  data: Record<string, unknown>[]
  schema?: BigQuerySchema
  writeDisposition?: 'WRITE_TRUNCATE' | 'WRITE_APPEND' | 'WRITE_EMPTY'
}

export interface BigQuerySchema {
  fields: Array<{
    name: string
    type: 'STRING' | 'INTEGER' | 'FLOAT' | 'BOOLEAN' | 'TIMESTAMP' | 'RECORD' | 'JSON'
    mode?: 'NULLABLE' | 'REQUIRED' | 'REPEATED'
    fields?: BigQuerySchema['fields']
  }>
}

export interface BigQueryQueryResult {
  rows: Record<string, unknown>[]
  totalRows: number
  schema: BigQuerySchema
}

// ============================================================================
// BigQuery Client
// ============================================================================

export class BigQueryClient {
  private projectId: string
  private datasetId: string
  private credentials: Record<string, unknown>
  private accessToken: string | null = null
  private tokenExpiry: Date | null = null
  
  constructor(
    projectId: string,
    datasetId: string,
    credentials: Record<string, unknown>
  ) {
    this.projectId = projectId
    this.datasetId = datasetId
    this.credentials = credentials
  }
  
  /**
   * Create client from workspace ID
   */
  static async fromWorkspace(workspaceId: string): Promise<BigQueryClient | null> {
    const supabase = createServiceClient()
    
    const { data } = await supabase
      .from('bigquery_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()
    
    if (!data) return null
    
    const credentials = JSON.parse(decrypt(data.credentials_encrypted))
    
    return new BigQueryClient(
      data.project_id,
      data.dataset_id,
      credentials
    )
  }
  
  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken
    }
    
    const jwt = await this.createJWT()
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(`Failed to get access token: ${data.error_description}`)
    }
    
    this.accessToken = data.access_token
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000)
    
    return this.accessToken!
  }
  
  /**
   * Create JWT for service account authentication
   */
  private async createJWT(): Promise<string> {
    const crypto = require('crypto')
    
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    }
    
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iss: this.credentials.client_email,
      scope: 'https://www.googleapis.com/auth/bigquery',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }
    
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
    
    const signatureInput = `${encodedHeader}.${encodedPayload}`
    const privateKey = (this.credentials.private_key as string).replace(/\\n/g, '\n')
    
    const sign = crypto.createSign('RSA-SHA256')
    sign.update(signatureInput)
    const signature = sign.sign(privateKey, 'base64url')
    
    return `${signatureInput}.${signature}`
  }
  
  /**
   * Execute a BigQuery query
   */
  async query(sql: string): Promise<BigQueryQueryResult> {
    const token = await this.getAccessToken()
    
    const response = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${this.projectId}/queries`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: sql,
          useLegacySql: false,
          defaultDataset: {
            projectId: this.projectId,
            datasetId: this.datasetId,
          },
        }),
      }
    )
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(`BigQuery query failed: ${data.error?.message}`)
    }
    
    const rows = (data.rows || []).map((row: { f: Array<{ v: unknown }> }) => {
      const obj: Record<string, unknown> = {}
      data.schema.fields.forEach((field: { name: string }, i: number) => {
        obj[field.name] = row.f[i].v
      })
      return obj
    })
    
    return {
      rows,
      totalRows: parseInt(data.totalRows || '0', 10),
      schema: data.schema,
    }
  }
  
  /**
   * Export data to a BigQuery table
   */
  async exportToTable(options: BigQueryExportOptions): Promise<{ success: boolean; rowsInserted: number }> {
    const { tableId, data, schema, writeDisposition = 'WRITE_APPEND' } = options
    
    if (data.length === 0) {
      return { success: true, rowsInserted: 0 }
    }
    
    const token = await this.getAccessToken()
    
    // Create table if it doesn't exist
    if (schema) {
      await this.createTableIfNotExists(tableId, schema)
    }
    
    // Insert data in batches
    const batchSize = 500
    let totalInserted = 0
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      
      const rows = batch.map(item => ({
        insertId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        json: item,
      }))
      
      const response = await fetch(
        `https://bigquery.googleapis.com/bigquery/v2/projects/${this.projectId}/datasets/${this.datasetId}/tables/${tableId}/insertAll`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rows }),
        }
      )
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(`BigQuery insert failed: ${result.error?.message}`)
      }
      
      if (result.insertErrors?.length > 0) {
        console.warn('BigQuery insert errors:', result.insertErrors)
      }
      
      totalInserted += batch.length
    }
    
    return { success: true, rowsInserted: totalInserted }
  }
  
  /**
   * Create a table if it doesn't exist
   */
  private async createTableIfNotExists(tableId: string, schema: BigQuerySchema): Promise<void> {
    const token = await this.getAccessToken()
    
    const response = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${this.projectId}/datasets/${this.datasetId}/tables`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tableReference: {
            projectId: this.projectId,
            datasetId: this.datasetId,
            tableId,
          },
          schema,
        }),
      }
    )
    
    // 409 = table already exists, which is fine
    if (!response.ok && response.status !== 409) {
      const data = await response.json()
      throw new Error(`Failed to create table: ${data.error?.message}`)
    }
  }
  
  /**
   * List available tables
   */
  async listTables(): Promise<Array<{ tableId: string; type: string; creationTime: string }>> {
    const token = await this.getAccessToken()
    
    const response = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${this.projectId}/datasets/${this.datasetId}/tables`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    )
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(`Failed to list tables: ${data.error?.message}`)
    }
    
    return (data.tables || []).map((t: { tableReference: { tableId: string }; type: string; creationTime: string }) => ({
      tableId: t.tableReference.tableId,
      type: t.type,
      creationTime: t.creationTime,
    }))
  }
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export campaigns to BigQuery
 */
export async function exportCampaignsToBigQuery(
  workspaceId: string
): Promise<{ success: boolean; rowsInserted: number }> {
  const client = await BigQueryClient.fromWorkspace(workspaceId)
  if (!client) {
    throw new Error('BigQuery not configured for this workspace')
  }
  
  const supabase = createServiceClient()
  
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', workspaceId)
  
  if (!campaigns) {
    return { success: true, rowsInserted: 0 }
  }
  
  const schema: BigQuerySchema = {
    fields: [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'name', type: 'STRING' },
      { name: 'status', type: 'STRING' },
      { name: 'goal', type: 'STRING' },
      { name: 'audience', type: 'STRING' },
      { name: 'created_at', type: 'TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMP' },
    ],
  }
  
  return client.exportToTable({
    tableId: 'campaigns',
    data: campaigns,
    schema,
    writeDisposition: 'WRITE_TRUNCATE',
  })
}

/**
 * Export claims to BigQuery
 */
export async function exportClaimsToBigQuery(
  workspaceId: string
): Promise<{ success: boolean; rowsInserted: number }> {
  const client = await BigQueryClient.fromWorkspace(workspaceId)
  if (!client) {
    throw new Error('BigQuery not configured for this workspace')
  }
  
  const supabase = createServiceClient()
  
  const { data: claims } = await supabase
    .from('claims')
    .select('*')
    .eq('workspace_id', workspaceId)
  
  if (!claims) {
    return { success: true, rowsInserted: 0 }
  }
  
  const schema: BigQuerySchema = {
    fields: [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'claim_text', type: 'STRING' },
      { name: 'status', type: 'STRING' },
      { name: 'confidence_score', type: 'FLOAT' },
      { name: 'created_at', type: 'TIMESTAMP' },
    ],
  }
  
  return client.exportToTable({
    tableId: 'claims',
    data: claims,
    schema,
    writeDisposition: 'WRITE_TRUNCATE',
  })
}

// ============================================================================
// Audience Import Functions
// ============================================================================

export interface AudienceSegment {
  id: string
  name: string
  description?: string
  criteria: AudienceQueryCriteria
  size?: number
}

export interface AudienceQueryCriteria {
  table: string
  conditions: QueryCondition[]
  limit?: number
}

export interface QueryCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'is_null' | 'is_not_null'
  value?: string | number | boolean | string[]
}

/**
 * Import audience data from BigQuery
 */
export async function importAudienceFromBigQuery(
  workspaceId: string,
  segment: AudienceSegment
): Promise<{ success: boolean; rowsImported: number; audienceId: string }> {
  const client = await BigQueryClient.fromWorkspace(workspaceId)
  if (!client) {
    throw new Error('BigQuery not configured for this workspace')
  }
  
  const supabase = createServiceClient()
  
  // Build and execute query
  const sql = buildSegmentQuery(segment.criteria)
  const result = await client.query(sql)
  
  if (result.rows.length === 0) {
    throw new Error('No audience members found matching criteria')
  }
  
  // Create or update audience in Sako
  const { data: audience, error: audienceError } = await supabase
    .from('audiences')
    .upsert({
      id: segment.id,
      workspace_id: workspaceId,
      name: segment.name,
      description: segment.description,
      source: 'bigquery',
      source_query: sql,
      member_count: result.rows.length,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  
  if (audienceError) {
    throw new Error(`Failed to create audience: ${audienceError.message}`)
  }
  
  // Store audience members
  const members = result.rows.map((row, index) => ({
    audience_id: audience.id,
    external_id: (row.id || row.user_id || row.customer_id || `member-${index}`) as string,
    data: row,
    created_at: new Date().toISOString(),
  }))
  
  // Insert in batches
  const batchSize = 1000
  for (let i = 0; i < members.length; i += batchSize) {
    const batch = members.slice(i, i + batchSize)
    await supabase.from('audience_members').upsert(batch)
  }
  
  return {
    success: true,
    rowsImported: result.rows.length,
    audienceId: audience.id,
  }
}

/**
 * Build SQL query from segment criteria
 */
function buildSegmentQuery(criteria: AudienceQueryCriteria): string {
  const { table, conditions, limit } = criteria
  
  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.map(buildCondition).join(' AND ')
    : ''
  
  const limitClause = limit ? `LIMIT ${limit}` : ''
  
  return `SELECT * FROM \`${table}\` ${whereClause} ${limitClause}`.trim()
}

/**
 * Build SQL condition from QueryCondition
 */
function buildCondition(condition: QueryCondition): string {
  const { field, operator, value } = condition
  
  switch (operator) {
    case 'equals':
      return typeof value === 'string'
        ? `${field} = '${escapeString(value)}'`
        : `${field} = ${value}`
    case 'not_equals':
      return typeof value === 'string'
        ? `${field} != '${escapeString(value)}'`
        : `${field} != ${value}`
    case 'contains':
      return `LOWER(${field}) LIKE LOWER('%${escapeString(String(value))}%')`
    case 'not_contains':
      return `LOWER(${field}) NOT LIKE LOWER('%${escapeString(String(value))}%')`
    case 'greater_than':
      return `${field} > ${value}`
    case 'less_than':
      return `${field} < ${value}`
    case 'in':
      const inValues = (value as string[]).map(v => `'${escapeString(v)}'`).join(', ')
      return `${field} IN (${inValues})`
    case 'not_in':
      const notInValues = (value as string[]).map(v => `'${escapeString(v)}'`).join(', ')
      return `${field} NOT IN (${notInValues})`
    case 'is_null':
      return `${field} IS NULL`
    case 'is_not_null':
      return `${field} IS NOT NULL`
    default:
      return 'TRUE'
  }
}

/**
 * Escape string for SQL
 */
function escapeString(str: string): string {
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\')
}

// ============================================================================
// SQL Query Builder
// ============================================================================

export interface QueryBuilderOptions {
  table: string
  select?: string[]
  conditions?: QueryCondition[]
  groupBy?: string[]
  orderBy?: { field: string; direction: 'ASC' | 'DESC' }[]
  limit?: number
  offset?: number
}

/**
 * Build a SQL query from options
 */
export function buildQuery(options: QueryBuilderOptions): string {
  const { table, select, conditions, groupBy, orderBy, limit, offset } = options
  
  const selectClause = select?.length ? select.join(', ') : '*'
  
  const whereClause = conditions?.length
    ? 'WHERE ' + conditions.map(buildCondition).join(' AND ')
    : ''
  
  const groupByClause = groupBy?.length
    ? 'GROUP BY ' + groupBy.join(', ')
    : ''
  
  const orderByClause = orderBy?.length
    ? 'ORDER BY ' + orderBy.map(o => `${o.field} ${o.direction}`).join(', ')
    : ''
  
  const limitClause = limit ? `LIMIT ${limit}` : ''
  const offsetClause = offset ? `OFFSET ${offset}` : ''
  
  return [
    `SELECT ${selectClause}`,
    `FROM \`${table}\``,
    whereClause,
    groupByClause,
    orderByClause,
    limitClause,
    offsetClause,
  ].filter(Boolean).join(' ')
}

/**
 * Preview query results (limited)
 */
export async function previewQuery(
  workspaceId: string,
  sql: string,
  maxRows: number = 100
): Promise<BigQueryQueryResult> {
  const client = await BigQueryClient.fromWorkspace(workspaceId)
  if (!client) {
    throw new Error('BigQuery not configured for this workspace')
  }
  
  // Add LIMIT if not present
  const limitedSql = sql.toLowerCase().includes('limit')
    ? sql
    : `${sql} LIMIT ${maxRows}`
  
  return client.query(limitedSql)
}

/**
 * Get available tables and their schemas
 */
export async function getAvailableTables(
  workspaceId: string
): Promise<Array<{ tableId: string; type: string; schema?: BigQuerySchema }>> {
  const client = await BigQueryClient.fromWorkspace(workspaceId)
  if (!client) {
    throw new Error('BigQuery not configured for this workspace')
  }
  
  return client.listTables()
}

/**
 * Get table schema
 */
export async function getTableSchema(
  workspaceId: string,
  tableId: string
): Promise<BigQuerySchema> {
  const client = await BigQueryClient.fromWorkspace(workspaceId)
  if (!client) {
    throw new Error('BigQuery not configured for this workspace')
  }
  
  const result = await client.query(`SELECT * FROM \`${tableId}\` LIMIT 0`)
  return result.schema
}

// ============================================================================
// Scheduled Sync Functions
// ============================================================================

export interface SyncSchedule {
  workspaceId: string
  frequency: 'hourly' | 'daily' | 'weekly'
  tables: string[]
  lastRunAt?: string
  nextRunAt?: string
}

/**
 * Run scheduled BigQuery sync
 */
export async function runScheduledSync(
  workspaceId: string
): Promise<{ success: boolean; tablesExported: string[] }> {
  const exportedTables: string[] = []
  
  try {
    // Export campaigns
    await exportCampaignsToBigQuery(workspaceId)
    exportedTables.push('campaigns')
    
    // Export claims
    await exportClaimsToBigQuery(workspaceId)
    exportedTables.push('claims')
    
    // Update sync timestamp
    const supabase = createServiceClient()
    await supabase
      .from('bigquery_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
    
    return { success: true, tablesExported: exportedTables }
  } catch (error) {
    console.error('BigQuery sync failed:', error)
    return { success: false, tablesExported: exportedTables }
  }
}
