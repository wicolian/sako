/**
 * Figma API Client
 * 
 * Connects to Figma API to:
 * - Fetch file/frame data
 * - Parse design tokens
 * - Extract styles and content
 * - Handle OAuth token refresh
 */

import { createServiceClient } from '@/lib/supabase/service'

const FIGMA_API_BASE = 'https://api.figma.com/v1'
const FIGMA_OAUTH_BASE = 'https://www.figma.com/api/oauth'

// Token expiry buffer (refresh 5 minutes before actual expiry)
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000

// ============================================================================
// Token Management
// ============================================================================

interface FigmaTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

/**
 * Get Figma access token for a workspace, refreshing if needed
 */
export async function getFigmaAccessToken(workspaceId: string): Promise<string> {
  const supabase = createServiceClient()
  
  // Get the connection
  const { data: connection, error } = await supabase
    .from('provider_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'figma')
    .eq('is_active', true)
    .single()
  
  if (error || !connection) {
    throw new FigmaNotConnectedError('Figma is not connected to this workspace')
  }
  
  // Check if token is expired or about to expire
  const expiresAt = connection.expires_at ? new Date(connection.expires_at) : null
  const isExpired = expiresAt && (expiresAt.getTime() - Date.now() < TOKEN_EXPIRY_BUFFER_MS)
  
  if (isExpired && connection.refresh_token) {
    // Refresh the token
    const newTokens = await refreshFigmaToken(connection.refresh_token)
    
    // Update the connection with new tokens
    await supabase
      .from('provider_connections')
      .update({
        access_token: newTokens.accessToken,
        refresh_token: newTokens.refreshToken,
        expires_at: newTokens.expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('provider', 'figma')
    
    return newTokens.accessToken
  }
  
  return connection.access_token
}

/**
 * Refresh a Figma OAuth token
 */
async function refreshFigmaToken(refreshToken: string): Promise<FigmaTokens> {
  const clientId = process.env.FIGMA_CLIENT_ID
  const clientSecret = process.env.FIGMA_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    throw new Error('FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET must be set')
  }
  
  const response = await fetch(`${FIGMA_OAUTH_BASE}/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new FigmaTokenRefreshError(error.error_description || 'Failed to refresh Figma token')
  }
  
  const data = await response.json()
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Figma may return a new refresh token
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

/**
 * Custom error for Figma not connected
 */
export class FigmaNotConnectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FigmaNotConnectedError'
  }
}

/**
 * Custom error for token refresh failures
 */
export class FigmaTokenRefreshError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FigmaTokenRefreshError'
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface FigmaFile {
  name: string
  lastModified: string
  thumbnailUrl: string
  version: string
  document: FigmaNode
  styles: Record<string, FigmaStyle>
}

export interface FigmaNode {
  id: string
  name: string
  type: FigmaNodeType
  visible?: boolean
  children?: FigmaNode[]
  absoluteBoundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  backgroundColor?: FigmaColor
  fills?: FigmaFill[]
  strokes?: FigmaStroke[]
  strokeWeight?: number
  cornerRadius?: number
  rectangleCornerRadii?: [number, number, number, number]
  characters?: string
  style?: FigmaTextStyle
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE'
  paddingLeft?: number
  paddingRight?: number
  paddingTop?: number
  paddingBottom?: number
  itemSpacing?: number
  primaryAxisAlignItems?: string
  counterAxisAlignItems?: string
  effects?: FigmaEffect[]
}

export type FigmaNodeType = 
  | 'DOCUMENT'
  | 'CANVAS'
  | 'FRAME'
  | 'GROUP'
  | 'VECTOR'
  | 'BOOLEAN_OPERATION'
  | 'STAR'
  | 'LINE'
  | 'ELLIPSE'
  | 'REGULAR_POLYGON'
  | 'RECTANGLE'
  | 'TEXT'
  | 'SLICE'
  | 'COMPONENT'
  | 'COMPONENT_SET'
  | 'INSTANCE'
  | 'SECTION'

export interface FigmaColor {
  r: number
  g: number
  b: number
  a: number
}

export interface FigmaFill {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE'
  visible?: boolean
  opacity?: number
  color?: FigmaColor
  imageRef?: string
  scaleMode?: string
}

export interface FigmaStroke {
  type: 'SOLID' | 'GRADIENT_LINEAR'
  color?: FigmaColor
}

export interface FigmaTextStyle {
  fontFamily: string
  fontPostScriptName?: string
  fontWeight: number
  fontSize: number
  textAlignHorizontal: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
  textAlignVertical: 'TOP' | 'CENTER' | 'BOTTOM'
  letterSpacing: number
  lineHeightPx: number
  lineHeightPercent?: number
}

export interface FigmaStyle {
  key: string
  name: string
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID'
  description: string
}

export interface FigmaEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR'
  visible: boolean
  radius: number
  color?: FigmaColor
  offset?: { x: number; y: number }
}

export interface FigmaImages {
  err: null | string
  images: Record<string, string>
}

/**
 * Create a Figma API client
 */
export function createFigmaClient(accessToken: string) {
  const headers = {
    'X-Figma-Token': accessToken,
  }

  /**
   * Get a Figma file
   */
  async function getFile(fileKey: string): Promise<FigmaFile> {
    const response = await fetch(`${FIGMA_API_BASE}/files/${fileKey}`, {
      headers,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.err || 'Failed to fetch Figma file')
    }

    return response.json()
  }

  /**
   * Get specific nodes from a file
   */
  async function getNodes(fileKey: string, nodeIds: string[]): Promise<{ nodes: Record<string, { document: FigmaNode }> }> {
    const ids = nodeIds.join(',')
    const response = await fetch(`${FIGMA_API_BASE}/files/${fileKey}/nodes?ids=${ids}`, {
      headers,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.err || 'Failed to fetch nodes')
    }

    return response.json()
  }

  /**
   * Get images for nodes
   */
  async function getImages(
    fileKey: string,
    nodeIds: string[],
    options: { format?: 'jpg' | 'png' | 'svg' | 'pdf'; scale?: number } = {}
  ): Promise<FigmaImages> {
    const { format = 'png', scale = 2 } = options
    const ids = nodeIds.join(',')
    const response = await fetch(
      `${FIGMA_API_BASE}/images/${fileKey}?ids=${ids}&format=${format}&scale=${scale}`,
      { headers }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.err || 'Failed to fetch images')
    }

    return response.json()
  }

  /**
   * Get file styles
   */
  async function getStyles(fileKey: string): Promise<{ meta: { styles: FigmaStyle[] } }> {
    const response = await fetch(`${FIGMA_API_BASE}/files/${fileKey}/styles`, {
      headers,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.err || 'Failed to fetch styles')
    }

    return response.json()
  }

  return {
    getFile,
    getNodes,
    getImages,
    getStyles,
  }
}

/**
 * Parse a Figma URL to extract file key and node ID
 */
export function parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } | null {
  try {
    const urlObj = new URL(url)
    
    // Handle different Figma URL formats
    // https://www.figma.com/file/ABC123/FileName
    // https://www.figma.com/design/ABC123/FileName?node-id=123:456
    // https://www.figma.com/file/ABC123/FileName?node-id=123-456
    
    const pathParts = urlObj.pathname.split('/')
    const fileIndex = pathParts.findIndex(p => p === 'file' || p === 'design')
    
    if (fileIndex === -1 || !pathParts[fileIndex + 1]) {
      return null
    }

    const fileKey = pathParts[fileIndex + 1]
    
    // Extract node-id from query params
    const nodeIdParam = urlObj.searchParams.get('node-id')
    let nodeId: string | undefined
    
    if (nodeIdParam) {
      // Convert node-id format (123-456 or 123:456) to API format (123:456)
      nodeId = nodeIdParam.replace('-', ':')
    }

    return { fileKey, nodeId }
  } catch {
    return null
  }
}

/**
 * Convert Figma color to hex
 */
export function figmaColorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Convert Figma color to rgba
 */
export function figmaColorToRgba(color: FigmaColor): string {
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)
  
  return `rgba(${r}, ${g}, ${b}, ${color.a.toFixed(2)})`
}
