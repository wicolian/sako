/**
 * Remotion Lambda Integration (Phase 4.2)
 * 
 * Serverless video rendering using Remotion on AWS Lambda.
 * Uses @remotion/lambda for deployment and rendering.
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createServiceClient } from '@/lib/supabase/service'
import type { VideoScript, VideoFormat } from '@/lib/assets/video-script-generator'
import type { Voiceover } from './voiceover'
import type { BrandContext } from '@/lib/ai/brand-context'

// ============================================================================
// Types
// ============================================================================

export interface RemotionConfig {
  functionName: string
  region: string
  bucketName: string
  serveUrl?: string
}

export interface RenderInput {
  composition: string
  inputProps: CompositionProps
  codec?: 'h264' | 'h265' | 'vp8' | 'vp9'
  imageFormat?: 'jpeg' | 'png'
  scale?: number
  frameRange?: [number, number]
}

export interface CompositionProps {
  script: {
    scenes: SceneData[]
    totalDuration: number
    format: VideoFormat
  }
  voiceover?: {
    audioUrl: string
    segments: Array<{ startTime: number; endTime: number; text: string }>
  }
  brand?: {
    primaryColor?: string
    secondaryColor?: string
    fontFamily?: string
    logoUrl?: string
  }
  options?: {
    includeCaptions: boolean
    assets: AssetData[]
    resolution: '720p' | '1080p' | '4k'
  }
}

export interface SceneData {
  id: string
  durationFrames: number
  narration: string
  visualDirection: string
  textOverlay?: string
  transition?: string
}

export interface AssetData {
  type: 'image' | 'video' | 'lottie'
  url: string
  sceneId?: string
  startFrame?: number
  durationFrames?: number
}

export interface RenderProgress {
  renderId: string
  status: 'invoking' | 'rendering' | 'encoding' | 'uploading' | 'done' | 'error'
  progress: number // 0-100
  framesRendered?: number
  totalFrames?: number
  estimatedTimeRemaining?: number
  outputUrl?: string
  errorMessage?: string
}

export interface RenderResult {
  renderId: string
  outputUrl: string
  thumbnailUrl: string
  duration: number
  fileSize: number
  codec: string
  resolution: string
}

// ============================================================================
// Configuration
// ============================================================================

function getConfig(): RemotionConfig {
  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME
  const region = process.env.AWS_REGION || 'ap-south-1'
  const bucketName = process.env.REMOTION_BUCKET || `sako-remotion-renders-${region}`

  if (!functionName) {
    throw new Error(
      'REMOTION_LAMBDA_FUNCTION_NAME is required for video rendering. ' +
      'Run ./infra/setup-remotion.sh to set up Remotion Lambda.'
    )
  }

  return {
    functionName,
    region,
    bucketName,
    serveUrl: process.env.REMOTION_SERVE_URL,
  }
}

function getLambdaClient(): LambdaClient {
  const config = getConfig()
  return new LambdaClient({ region: config.region })
}

function getS3Client(): S3Client {
  const config = getConfig()
  return new S3Client({ region: config.region })
}

// ============================================================================
// Render Functions
// ============================================================================

/**
 * Start a Remotion Lambda render
 */
export async function startRender(input: RenderInput): Promise<string> {
  const config = getConfig()
  const lambda = getLambdaClient()

  const payload = {
    type: 'start',
    serveUrl: config.serveUrl || `https://${config.bucketName}.s3.${config.region}.amazonaws.com/sites/sako-video/index.html`,
    composition: input.composition || 'MainVideo',
    inputProps: input.inputProps,
    codec: input.codec || 'h264',
    imageFormat: input.imageFormat || 'jpeg',
    scale: input.scale || 1,
    outName: `renders/${Date.now()}-${crypto.randomUUID()}.mp4`,
    privacy: 'public',
    downloadBehavior: { type: 'play-in-browser' },
  }

  const command = new InvokeCommand({
    FunctionName: config.functionName,
    Payload: Buffer.from(JSON.stringify(payload)),
  })

  const response = await lambda.send(command)

  if (response.FunctionError) {
    const errorPayload = response.Payload 
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : {}
    throw new Error(`Lambda error: ${errorPayload.errorMessage || 'Unknown error'}`)
  }

  const result = response.Payload 
    ? JSON.parse(Buffer.from(response.Payload).toString())
    : {}

  if (!result.renderId) {
    throw new Error('No renderId returned from Lambda')
  }

  return result.renderId
}

/**
 * Get render progress
 */
export async function getRenderProgress(renderId: string): Promise<RenderProgress> {
  const config = getConfig()
  const lambda = getLambdaClient()

  const payload = {
    type: 'status',
    renderId,
    bucketName: config.bucketName,
  }

  const command = new InvokeCommand({
    FunctionName: config.functionName,
    Payload: Buffer.from(JSON.stringify(payload)),
  })

  const response = await lambda.send(command)

  if (response.FunctionError) {
    return {
      renderId,
      status: 'error',
      progress: 0,
      errorMessage: 'Failed to get render status',
    }
  }

  const result = response.Payload 
    ? JSON.parse(Buffer.from(response.Payload).toString())
    : {}

  // Map Remotion status to our status
  const statusMap: Record<string, RenderProgress['status']> = {
    'invoking': 'invoking',
    'rendering': 'rendering',
    'post-processing': 'encoding',
    'uploading': 'uploading',
    'done': 'done',
    'error': 'error',
  }

  return {
    renderId,
    status: statusMap[result.overallProgress?.status] || 'rendering',
    progress: Math.round((result.overallProgress?.progress || 0) * 100),
    framesRendered: result.overallProgress?.framesRendered,
    totalFrames: result.overallProgress?.totalFrames,
    outputUrl: result.outputFile,
    errorMessage: result.errors?.[0]?.message,
  }
}

/**
 * Wait for render to complete
 */
export async function waitForRender(
  renderId: string,
  options?: { maxWaitMs?: number; pollIntervalMs?: number }
): Promise<RenderResult> {
  const maxWait = options?.maxWaitMs || 600000 // 10 minutes
  const pollInterval = options?.pollIntervalMs || 3000 // 3 seconds
  const startTime = Date.now()

  while (Date.now() - startTime < maxWait) {
    const progress = await getRenderProgress(renderId)

    if (progress.status === 'done' && progress.outputUrl) {
      // Get file metadata from S3
      const config = getConfig()
      const s3 = getS3Client()
      
      // Extract key from URL
      const outputKey = progress.outputUrl.split('.amazonaws.com/')[1] || progress.outputUrl

      const headCommand = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: outputKey,
      })

      try {
        const metadata = await s3.send(headCommand)
        
        return {
          renderId,
          outputUrl: progress.outputUrl,
          thumbnailUrl: progress.outputUrl.replace('.mp4', '-thumbnail.jpg'),
          duration: 0, // Would need to parse from metadata
          fileSize: metadata.ContentLength || 0,
          codec: 'h264',
          resolution: '1080p',
        }
      } catch {
        // If we can't get metadata, return with basic info
        return {
          renderId,
          outputUrl: progress.outputUrl,
          thumbnailUrl: progress.outputUrl.replace('.mp4', '-thumbnail.jpg'),
          duration: 0,
          fileSize: 0,
          codec: 'h264',
          resolution: '1080p',
        }
      }
    }

    if (progress.status === 'error') {
      throw new Error(progress.errorMessage || 'Render failed')
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  throw new Error('Render timed out')
}

// ============================================================================
// High-Level API
// ============================================================================

/**
 * Render a video from script and voiceover
 */
export async function renderVideo(
  script: VideoScript,
  voiceover: Voiceover | null,
  brand: BrandContext | null,
  options?: {
    resolution?: '720p' | '1080p' | '4k'
    includeCaptions?: boolean
    assets?: AssetData[]
  }
): Promise<RenderResult> {
  const fps = 30
  
  // Convert script to composition props
  const compositionProps: CompositionProps = {
    script: {
      scenes: script.scenes.map(scene => ({
        id: scene.id,
        durationFrames: Math.round(scene.duration * fps),
        narration: scene.narration,
        visualDirection: scene.visualDirection,
        textOverlay: scene.textOverlay,
        transition: scene.transition,
      })),
      totalDuration: script.totalDuration,
      format: script.format,
    },
    voiceover: voiceover ? {
      audioUrl: voiceover.audioUrl,
      segments: voiceover.segments.map(seg => ({
        startTime: seg.startTime,
        endTime: seg.startTime + seg.duration,
        text: seg.narration,
      })),
    } : undefined,
    brand: brand ? {
      primaryColor: brand.colors?.primary,
      secondaryColor: brand.colors?.secondary,
      fontFamily: brand.typography?.fontFamily,
      logoUrl: (brand as unknown as { logoUrl?: string }).logoUrl,
    } : undefined,
    options: {
      includeCaptions: options?.includeCaptions ?? true,
      assets: options?.assets || [],
      resolution: options?.resolution || '1080p',
    },
  }

  // Start render
  const renderId = await startRender({
    composition: 'MainVideo',
    inputProps: compositionProps,
    codec: 'h264',
  })

  // Wait for completion
  return waitForRender(renderId)
}

/**
 * Store render job in database
 */
export async function storeRenderJob(
  workspaceId: string,
  campaignId: string | null,
  renderId: string,
  scriptId: string
): Promise<void> {
  const supabase = createServiceClient()

  await supabase.from('video_renders').insert({
    id: renderId,
    workspace_id: workspaceId,
    campaign_id: campaignId,
    script_id: scriptId,
    service: 'remotion',
    status: 'rendering',
    created_at: new Date().toISOString(),
  })
}

/**
 * Update render job status
 */
export async function updateRenderJobStatus(
  renderId: string,
  status: 'rendering' | 'completed' | 'failed',
  outputUrl?: string,
  error?: string
): Promise<void> {
  const supabase = createServiceClient()

  await supabase
    .from('video_renders')
    .update({
      status,
      output_url: outputUrl,
      error,
      updated_at: new Date().toISOString(),
      completed_at: status === 'completed' || status === 'failed' 
        ? new Date().toISOString() 
        : null,
    })
    .eq('id', renderId)
}

/**
 * Get signed URL for download
 */
export async function getSignedDownloadUrl(
  outputKey: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const config = getConfig()
  const s3 = getS3Client()

  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: outputKey,
  })

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if Remotion Lambda is configured
 */
export function isRemotionConfigured(): boolean {
  return !!process.env.REMOTION_LAMBDA_FUNCTION_NAME
}

/**
 * Get Remotion status summary
 */
export async function getRemotionStatus(): Promise<{
  configured: boolean
  functionName?: string
  region?: string
  bucketName?: string
}> {
  if (!isRemotionConfigured()) {
    return { configured: false }
  }

  const config = getConfig()
  return {
    configured: true,
    functionName: config.functionName,
    region: config.region,
    bucketName: config.bucketName,
  }
}
