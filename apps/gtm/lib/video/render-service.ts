/**
 * Video Render Service (Phase 2.2)
 * 
 * Abstraction foimport { Database } from '@/lib/supabase/types'

r external video rendering APIs.
 * Supports Creatomate and Shotstack.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface VideoTemplate {
  id: string
  name: string
  duration: number
  aspectRatio: string
  scenes: VideoScene[]
}

export interface VideoScene {
  id: string
  duration: number
  elements: VideoElement[]
}

export interface VideoElement {
  type: 'text' | 'image' | 'video' | 'shape' | 'audio'
  content?: string
  src?: string
  position: { x: number; y: number }
  size?: { width: number; height: number }
  animation?: {
    in: string
    out: string
  }
  style?: Record<string, unknown>
}

export interface VideoData {
  modifications: Record<string, unknown>
  variables?: Record<string, string>
  voiceover?: {
    text: string
    voice: string
  }
}

export interface RenderResult {
  success: boolean
  renderId?: string
  previewUrl?: string
  error?: string
}

export interface RenderStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  downloadUrl?: string
  thumbnailUrl?: string
  error?: string
}

/**
 * Abstract interface for render services
 */
export interface RenderService {
  name: string
  render(template: VideoTemplate, data: VideoData): Promise<RenderResult>
  getStatus(renderId: string): Promise<RenderStatus>
  getDownloadUrl(renderId: string): Promise<string>
}

/**
 * Creatomate render service
 */
export class CreatomateService implements RenderService {
  name = 'Creatomate'
  private apiKey: string

  constructor() {
    this.apiKey = process.env.CREATOMATE_API_KEY || ''
  }

  async render(template: VideoTemplate, data: VideoData): Promise<RenderResult> {
    if (!this.apiKey) {
      return { success: false, error: 'Creatomate API key not configured' }
    }

    try {
      const response = await fetch('https://api.creatomate.com/v1/renders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: template.id,
          modifications: data.modifications,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: error.message || 'Render request failed' }
      }

      const result = await response.json()
      return {
        success: true,
        renderId: result[0]?.id,
        previewUrl: result[0]?.url,
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async getStatus(renderId: string): Promise<RenderStatus> {
    if (!this.apiKey) {
      return { status: 'failed', error: 'Creatomate API key not configured' }
    }

    try {
      const response = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })

      if (!response.ok) {
        return { status: 'failed', error: 'Failed to get render status' }
      }

      const result = await response.json()
      
      const statusMap: Record<string, RenderStatus['status']> = {
        pending: 'pending',
        rendering: 'processing',
        succeeded: 'completed',
        failed: 'failed',
      }

      return {
        status: statusMap[result.status] || 'pending',
        progress: result.progress,
        downloadUrl: result.url,
        thumbnailUrl: result.snapshot_url,
      }
    } catch (error) {
      return { status: 'failed', error: (error as Error).message }
    }
  }

  async getDownloadUrl(renderId: string): Promise<string> {
    const status = await this.getStatus(renderId)
    return status.downloadUrl || ''
  }
}

/**
 * Shotstack render service
 */
export class ShotstackService implements RenderService {
  name = 'Shotstack'
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env.SHOTSTACK_API_KEY || ''
    this.baseUrl = process.env.SHOTSTACK_ENV === 'production'
      ? 'https://api.shotstack.io/v1'
      : 'https://api.shotstack.io/stage'
  }

  async render(template: VideoTemplate, data: VideoData): Promise<RenderResult> {
    if (!this.apiKey) {
      return { success: false, error: 'Shotstack API key not configured' }
    }

    try {
      // Convert our template format to Shotstack's edit format
      const edit = this.convertToShotstackEdit(template, data)

      const response = await fetch(`${this.baseUrl}/render`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(edit),
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: error.message || 'Render request failed' }
      }

      const result = await response.json()
      return {
        success: true,
        renderId: result.response?.id,
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async getStatus(renderId: string): Promise<RenderStatus> {
    if (!this.apiKey) {
      return { status: 'failed', error: 'Shotstack API key not configured' }
    }

    try {
      const response = await fetch(`${this.baseUrl}/render/${renderId}`, {
        headers: {
          'x-api-key': this.apiKey,
        },
      })

      if (!response.ok) {
        return { status: 'failed', error: 'Failed to get render status' }
      }

      const result = await response.json()
      const data = result.response

      const statusMap: Record<string, RenderStatus['status']> = {
        queued: 'pending',
        fetching: 'processing',
        rendering: 'processing',
        saving: 'processing',
        done: 'completed',
        failed: 'failed',
      }

      return {
        status: statusMap[data.status] || 'pending',
        downloadUrl: data.url,
        thumbnailUrl: data.poster,
      }
    } catch (error) {
      return { status: 'failed', error: (error as Error).message }
    }
  }

  async getDownloadUrl(renderId: string): Promise<string> {
    const status = await this.getStatus(renderId)
    return status.downloadUrl || ''
  }

  private convertToShotstackEdit(template: VideoTemplate, data: VideoData): Record<string, unknown> {
    // Convert our template format to Shotstack's timeline format
    return {
      timeline: {
        tracks: template.scenes.map(scene => ({
          clips: scene.elements.map(el => ({
            asset: this.elementToAsset(el, data),
            start: 0,
            length: scene.duration,
          })),
        })),
      },
      output: {
        format: 'mp4',
        resolution: 'hd',
        aspectRatio: template.aspectRatio,
      },
    }
  }

  private elementToAsset(element: VideoElement, data: VideoData): Record<string, unknown> {
    switch (element.type) {
      case 'text':
        return {
          type: 'title',
          text: data.variables?.[element.content || ''] || element.content,
          style: 'minimal',
        }
      case 'image':
        return {
          type: 'image',
          src: data.modifications?.[element.src || ''] || element.src,
        }
      case 'video':
        return {
          type: 'video',
          src: element.src,
        }
      default:
        return { type: 'html', html: '' }
    }
  }
}

/**
 * Stub render service used when no video provider is configured.
 * Returns explicit errors rather than fake URLs so callers can surface
 * a "configure a video provider" message instead of broken links.
 *
 * To enable real video rendering, set one of:
 *   REMOTION_LAMBDA_FUNCTION_NAME (recommended, self-hosted)
 *   CREATOMATE_API_KEY
 *   SHOTSTACK_API_KEY
 */
export class PreviewRenderService implements RenderService {
  name = 'Preview (not configured)'

  async render(_template: VideoTemplate, _data: VideoData): Promise<RenderResult> {
    return {
      success: false,
      renderId: '',
      error:
        'Video rendering is not configured. Set REMOTION_LAMBDA_FUNCTION_NAME, CREATOMATE_API_KEY, or SHOTSTACK_API_KEY.',
    }
  }

  async getStatus(_renderId: string): Promise<RenderStatus> {
    return {
      status: 'failed',
      progress: 0,
      error: 'Video rendering is not configured.',
    }
  }

  async getDownloadUrl(_renderId: string): Promise<string> {
    throw new Error('Video rendering is not configured.')
  }
}

/**
 * Remotion Lambda render service (preferred)
 */
export class RemotionLambdaService implements RenderService {
  name = 'Remotion'

  async render(template: VideoTemplate, data: VideoData): Promise<RenderResult> {
    const { startRender } = await import('./remotion-lambda')
    
    try {
      const renderId = await startRender({
        composition: template.id || 'MainVideo',
        inputProps: {
          script: {
            scenes: template.scenes.map(scene => ({
              id: scene.id,
              durationFrames: Math.round(scene.duration * 30), // 30fps
              narration: '',
              visualDirection: '',
              textOverlay: scene.elements.find(e => e.type === 'text')?.content,
            })),
            totalDuration: template.duration,
            format: template.aspectRatio as '16:9' | '9:16' | '1:1',
          },
          brand: data.modifications?.brand as CompositionProps['brand'],
          options: {
            includeCaptions: true,
            assets: [],
            resolution: '1080p',
          },
        },
      })

      return {
        success: true,
        renderId,
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async getStatus(renderId: string): Promise<RenderStatus> {
    const { getRenderProgress } = await import('./remotion-lambda')
    
    try {
      const progress = await getRenderProgress(renderId)
      
      const statusMap: Record<string, RenderStatus['status']> = {
        'invoking': 'pending',
        'rendering': 'processing',
        'encoding': 'processing',
        'uploading': 'processing',
        'done': 'completed',
        'error': 'failed',
      }

      return {
        status: statusMap[progress.status] || 'processing',
        progress: progress.progress,
        downloadUrl: progress.outputUrl,
        error: progress.errorMessage,
      }
    } catch (error) {
      return { status: 'failed', error: (error as Error).message }
    }
  }

  async getDownloadUrl(renderId: string): Promise<string> {
    const status = await this.getStatus(renderId)
    if (status.downloadUrl) {
      // Get signed URL for secure download
      const { getSignedDownloadUrl } = await import('./remotion-lambda')
      const key = status.downloadUrl.split('.amazonaws.com/')[1]
      if (key) {
        return getSignedDownloadUrl(key)
      }
    }
    return status.downloadUrl || ''
  }
}

// Import type for Remotion composition props
import type { CompositionProps } from './remotion-lambda'

/**
 * Get the appropriate render service based on configuration
 */
export function getRenderService(): RenderService {
  // Prefer Remotion Lambda (self-hosted, most cost-effective)
  if (process.env.REMOTION_LAMBDA_FUNCTION_NAME) {
    return new RemotionLambdaService()
  }
  // Fall back to Creatomate
  if (process.env.CREATOMATE_API_KEY) {
    return new CreatomateService()
  }
  // Fall back to Shotstack
  if (process.env.SHOTSTACK_API_KEY) {
    return new ShotstackService()
  }
  
  // Return stub so callers receive a clear error rather than a server crash.
  // Configure a real provider to enable video rendering.
  return new PreviewRenderService()
}

/**
 * Render a video and track progress
 */
export async function renderVideo(
  workspaceId: string,
  campaignId: string,
  template: VideoTemplate,
  data: VideoData
): Promise<{
  renderId: string
  status: RenderStatus
}> {
  const supabase = createServiceClient()
  const service = getRenderService()

  // Start the render
  const result = await service.render(template, data)

  if (!result.success || !result.renderId) {
    throw new Error(result.error || 'Failed to start video render')
  }

  // Store render job in database
  await supabase.from('video_renders').insert({
    workspace_id: workspaceId,
    campaign_id: campaignId,
    render_id: result.renderId,
    service: service.name,
    template_id: template.id,
    status: 'pending',
    preview_url: result.previewUrl,
    created_at: new Date().toISOString(),
  })

  // Get initial status
  const status = await service.getStatus(result.renderId)

  return {
    renderId: result.renderId,
    status,
  }
}

/**
 * Poll for render completion
 */
export async function pollRenderStatus(
  renderId: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<RenderStatus> {
  const service = getRenderService()
  let attempts = 0

  while (attempts < maxAttempts) {
    const status = await service.getStatus(renderId)

    if (status.status === 'completed' || status.status === 'failed') {
      return status
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs))
    attempts++
  }

  return { status: 'failed', error: 'Render timed out' }
}
