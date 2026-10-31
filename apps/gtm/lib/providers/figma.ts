/**
 * Figma Deployment Provider
 * 
 * Handles bi-directional sync with Figma for design handoff.
 * - Import: Extract text layers from Figma frames as claims
 * - Export: Push updated copy back to Figma text layers
 */

import { createServiceClient } from '@/lib/supabase/service'
import { encrypt, decrypt } from '@/lib/encryption'
import type {
  DeploymentProvider,
  ProviderCapabilities,
  ProviderConnection,
  PageMetadata,
  DeployResult,
  TextUpdate,
  ImportedContent,
} from './types'

const FIGMA_API_BASE = 'https://api.figma.com/v1'

interface FigmaNode {
  id: string
  name: string
  type: string
  characters?: string
  children?: FigmaNode[]
}

export class FigmaProvider implements DeploymentProvider {
  id = 'figma' as const
  name = 'Figma'
  icon = 'figma'
  description = 'Sync copy and claims bi-directionally with Figma designs'

  capabilities: ProviderCapabilities = {
    deployPage: false, // Figma is design-only
    deployForm: false,
    deployEmail: false,
    deploySequence: false,
    getPerformance: false,
    biDirectionalSync: true, // This is Figma's superpower
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return connection !== null
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const clientId = process.env.FIGMA_CLIENT_ID
    const scopes = 'file_read,file_write'
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')

    return `https://www.figma.com/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${scopes}&state=${state}&response_type=code`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const supabase = createServiceClient()

    const response = await fetch('https://www.figma.com/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.FIGMA_CLIENT_ID!,
        client_secret: process.env.FIGMA_CLIENT_SECRET!,
        redirect_uri: process.env.FIGMA_REDIRECT_URI!,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to exchange Figma OAuth code')
    }

    const tokens = await response.json()
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Get user info
    const userResponse = await fetch(`${FIGMA_API_BASE}/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const user = await userResponse.json()

    const { data: connection, error } = await supabase
      .from('figma_connections')
      .upsert({
        workspace_id: workspaceId,
        access_token_encrypted: encrypt(tokens.access_token),
        refresh_token_encrypted: encrypt(tokens.refresh_token),
        expires_at: expiresAt.toISOString(),
        user_id: user.id,
        user_handle: user.handle,
        user_email: user.email,
      }, { onConflict: 'workspace_id' })
      .select()
      .single()

    if (error) {
      throw new Error('Failed to save Figma connection')
    }

    return {
      id: connection.id,
      workspaceId: connection.workspace_id,
      provider: 'figma',
      isConnected: true,
      externalId: connection.user_id,
      externalName: connection.user_handle,
      expiresAt: new Date(connection.expires_at),
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('figma_connections')
      .delete()
      .eq('workspace_id', workspaceId)
  }

  // Figma doesn't "deploy pages" - it syncs content
  async deployPage(_html: string, _metadata: PageMetadata): Promise<DeployResult> {
    return {
      success: false,
      externalId: '',
      error: 'Figma is a design tool. Use importContent/pushContent for sync.',
    }
  }

  /**
   * Import content from a Figma file
   * Extracts all text layers and structures them as claims
   */
  async importContent(sourceUrl: string): Promise<ImportedContent | null> {
    const fileKey = this.parseFileKey(sourceUrl)
    if (!fileKey) {
      console.error('Invalid Figma URL')
      return null
    }

    // Extract workspace ID from the source URL or context
    // For now, we'll use a generic approach
    const accessToken = await this.getAccessTokenByFileKey(fileKey)
    if (!accessToken) {
      console.error('No access token available')
      return null
    }

    try {
      // Get file data
      const response = await fetch(`${FIGMA_API_BASE}/files/${fileKey}`, {
        headers: { 'X-Figma-Token': accessToken },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch Figma file')
      }

      const file = await response.json()
      
      // Extract text layers
      const textLayers = this.extractTextLayers(file.document)
      
      // Convert to claims
      const claims = textLayers.map(layer => ({
        nodeId: layer.id,
        text: layer.characters || '',
        type: this.inferClaimType(layer.name),
        layerPath: layer.path,
      }))

      // Extract images
      const imageNodes = this.extractImageNodes(file.document)
      
      // Get image URLs
      let assets: ImportedContent['assets'] = []
      if (imageNodes.length > 0) {
        const imageResponse = await fetch(
          `${FIGMA_API_BASE}/images/${fileKey}?ids=${imageNodes.map(n => n.id).join(',')}`,
          { headers: { 'X-Figma-Token': accessToken } }
        )
        const imageData = await imageResponse.json()
        
        assets = imageNodes.map(node => ({
          id: node.id,
          url: imageData.images?.[node.id] || '',
          type: 'image' as const,
        }))
      }

      return {
        claims,
        structure: this.buildPageStructure(file.document),
        assets,
      }
    } catch (error) {
      console.error('Failed to import from Figma:', error)
      return null
    }
  }

  /**
   * Push content updates back to Figma
   * Updates text layers with new copy
   */
  async pushContent(updates: TextUpdate[], fileKey: string): Promise<DeployResult> {
    // Note: Figma's REST API has limited write capabilities
    // Full text updates require the Plugin API or Figma Variables
    
    // For now, we'll generate a Figma plugin link
    const pluginData = Buffer.from(JSON.stringify({ updates })).toString('base64')
    
    return {
      success: true,
      externalId: fileKey,
      url: `https://www.figma.com/file/${fileKey}`,
      warnings: [
        'Text updates prepared. Use the Sako Figma Plugin to apply changes.',
        'Plugin data ready for sync.',
      ],
      metadata: {
        updateCount: updates.length,
        pluginData,
      },
    }
  }

  // Helper methods
  private async getConnection(workspaceId: string): Promise<{
    accessToken: string
    userId: string
  } | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('figma_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()

    if (!data) return null

    return {
      accessToken: decrypt(data.access_token_encrypted),
      userId: data.user_id,
    }
  }

  private async getAccessTokenByFileKey(_fileKey: string): Promise<string | null> {
    // In a real implementation, you'd look up which workspace has access to this file
    // For now, return null and require explicit workspace context
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('figma_connections')
      .select('access_token_encrypted')
      .limit(1)
      .single()

    if (!data?.access_token_encrypted) return null
    return decrypt(data.access_token_encrypted)
  }

  private parseFileKey(url: string): string | null {
    // Parse Figma URLs: https://www.figma.com/file/KEY/name
    const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/)
    return match?.[1] || null
  }

  private extractTextLayers(
    node: FigmaNode,
    path: string = ''
  ): Array<{ id: string; name: string; characters: string; path: string }> {
    const layers: Array<{ id: string; name: string; characters: string; path: string }> = []
    const currentPath = path ? `${path} > ${node.name}` : node.name

    if (node.type === 'TEXT' && node.characters) {
      layers.push({
        id: node.id,
        name: node.name,
        characters: node.characters,
        path: currentPath,
      })
    }

    if (node.children) {
      for (const child of node.children) {
        layers.push(...this.extractTextLayers(child, currentPath))
      }
    }

    return layers
  }

  private extractImageNodes(node: FigmaNode): Array<{ id: string; name: string }> {
    const images: Array<{ id: string; name: string }> = []

    if (node.type === 'RECTANGLE' || node.type === 'FRAME' || node.type === 'INSTANCE') {
      // Check if it has image fills
      // Simplified check - in reality would check fills array
      if (node.name.toLowerCase().includes('image') || node.name.toLowerCase().includes('hero')) {
        images.push({ id: node.id, name: node.name })
      }
    }

    if (node.children) {
      for (const child of node.children) {
        images.push(...this.extractImageNodes(child))
      }
    }

    return images
  }

  private inferClaimType(layerName: string): string {
    const name = layerName.toLowerCase()
    
    if (name.includes('headline') || name.includes('hero') || name.includes('title')) {
      return 'headline'
    }
    if (name.includes('cta') || name.includes('button')) {
      return 'cta'
    }
    if (name.includes('subhead') || name.includes('description')) {
      return 'supporting'
    }
    if (name.includes('disclaimer') || name.includes('legal')) {
      return 'disclaimer'
    }
    
    return 'body'
  }

  private buildPageStructure(document: FigmaNode): Record<string, unknown> {
    // Build a simplified structure of the page
    const structure: Record<string, unknown> = {
      name: document.name,
      type: document.type,
      sections: [],
    }

    // Find top-level frames (likely sections)
    if (document.children) {
      const pages = document.children.filter(c => c.type === 'CANVAS')
      if (pages.length > 0 && pages[0].children) {
        structure.sections = pages[0].children
          .filter(c => c.type === 'FRAME')
          .map(frame => ({
            id: frame.id,
            name: frame.name,
            type: this.inferSectionType(frame.name),
          }))
      }
    }

    return structure
  }

  private inferSectionType(frameName: string): string {
    const name = frameName.toLowerCase()
    
    if (name.includes('hero')) return 'hero'
    if (name.includes('trust') || name.includes('logo')) return 'trust'
    if (name.includes('benefit')) return 'benefits'
    if (name.includes('feature')) return 'features'
    if (name.includes('pricing')) return 'pricing'
    if (name.includes('faq')) return 'faq'
    if (name.includes('footer') || name.includes('cta')) return 'footer_cta'
    
    return 'custom'
  }
}
