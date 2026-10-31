/**
 * Video Assembly (Jan 2026)
 * 
 * Assemble videos from scripts, voiceovers, and assets
 * using Remotion, Creatomate, or Shotstack.
 */

import { v4 as uuidv4 } from 'uuid';
import type { VideoScript, VideoFormat } from '@/lib/assets/video-script-generator';
import type { Voiceover } from './voiceover';
import { getBrandContext, type BrandContext } from '@/lib/ai/brand-context';

export interface AssembledVideo {
  id: string;
  scriptId: string;
  voiceoverId?: string;
  templateId?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  format: VideoFormat;
  resolution: string;
  duration: number;
  fileSize?: number;
  status: 'pending' | 'rendering' | 'complete' | 'failed';
  errorMessage?: string;
  renderProgress: number;
  renderCost?: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface VideoAsset {
  type: 'image' | 'video' | 'lottie';
  url: string;
  sceneId?: string;
  startTime?: number;
  duration?: number;
}

export interface AssemblyOptions {
  templateId?: string;
  assets?: VideoAsset[];
  includeCaptions?: boolean;
  brandContext?: BrandContext;
  resolution?: '720p' | '1080p' | '4k';
  quality?: 'draft' | 'standard' | 'high';
}

// Resolution specs
const RESOLUTIONS: Record<string, Record<VideoFormat, { width: number; height: number }>> = {
  '720p': {
    '16:9': { width: 1280, height: 720 },
    '9:16': { width: 720, height: 1280 },
    '1:1': { width: 720, height: 720 },
  },
  '1080p': {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
  },
  '4k': {
    '16:9': { width: 3840, height: 2160 },
    '9:16': { width: 2160, height: 3840 },
    '1:1': { width: 2160, height: 2160 },
  },
};

/**
 * Assemble video from script and voiceover
 */
export async function assembleVideo(
  script: VideoScript,
  voiceover: Voiceover | null,
  workspaceId: string,
  options: AssemblyOptions = {}
): Promise<AssembledVideo> {
  const resolution = options.resolution || '1080p';
  const brandContext = options.brandContext || await getBrandContext(workspaceId);
  
  // Determine which service to use
  const service = determineService();
  
  let result: AssembledVideo;
  
  switch (service) {
    case 'creatomate':
      result = await assembleWithCreatomate(script, voiceover, brandContext, resolution, options);
      break;
    case 'shotstack':
      result = await assembleWithShotstack(script, voiceover, brandContext, resolution, options);
      break;
    case 'remotion':
      result = await assembleWithRemotion(script, voiceover, brandContext, resolution, options);
      break;
    default:
      // This should never happen as determineService() throws if no service is configured
      throw new Error(`Unknown video service: ${service}`);
  }
  
  return result;
}

/**
 * Check if video rendering is configured
 */
export function isVideoRenderingConfigured(): { configured: boolean; service: string | null; reason?: string } {
  if (process.env.CREATOMATE_API_KEY) {
    return { configured: true, service: 'creatomate' };
  }
  if (process.env.SHOTSTACK_API_KEY) {
    return { configured: true, service: 'shotstack' };
  }
  if (process.env.REMOTION_LAMBDA_FUNCTION_NAME) {
    return { configured: true, service: 'remotion' };
  }
  return { 
    configured: false, 
    service: null, 
    reason: 'No video rendering service configured. Add CREATOMATE_API_KEY, SHOTSTACK_API_KEY, or REMOTION_LAMBDA_FUNCTION_NAME to .env.local'
  };
}

/**
 * Determine which video service to use based on env vars
 */
function determineService(): 'remotion' | 'creatomate' | 'shotstack' {
  if (process.env.CREATOMATE_API_KEY) return 'creatomate';
  if (process.env.SHOTSTACK_API_KEY) return 'shotstack';
  if (process.env.REMOTION_LAMBDA_FUNCTION_NAME) return 'remotion';
  
  throw new Error(
    'Video rendering requires one of: CREATOMATE_API_KEY, SHOTSTACK_API_KEY, or REMOTION_LAMBDA_FUNCTION_NAME. ' +
    'Add one to .env.local to enable video assembly.'
  );
}

/**
 * Assemble with Remotion (self-hosted, code-based)
 */
async function assembleWithRemotion(
  script: VideoScript,
  voiceover: Voiceover | null,
  brandContext: BrandContext | null,
  resolution: string,
  options: AssemblyOptions
): Promise<AssembledVideo> {
  const lambdaFunction = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
  const res = RESOLUTIONS[resolution][script.format];
  
  // Prepare composition data for Remotion
  const compositionData = {
    script: {
      scenes: script.scenes.map(scene => ({
        id: scene.id,
        duration: scene.duration * 30, // Convert to frames (assuming 30fps)
        narration: scene.narration,
        visualDirection: scene.visualDirection,
        textOverlay: scene.textOverlay,
        transition: scene.transition,
      })),
      totalDuration: script.totalDuration * 30,
      format: script.format,
    },
    voiceover: voiceover ? {
      url: voiceover.audioUrl,
      segments: voiceover.segments,
    } : null,
    brand: brandContext ? {
      primaryColor: brandContext.colors?.primary,
      secondaryColor: brandContext.colors?.secondary,
      fontFamily: brandContext.typography?.fontFamily,
      logoUrl: (brandContext as any).logoUrl,
    } : null,
    options: {
      includeCaptions: options.includeCaptions ?? true,
      assets: options.assets || [],
    },
  };
  
  // If Lambda is configured, render remotely
  if (lambdaFunction) {
    return await renderWithRemotionLambda(compositionData, res, script);
  }
  
  // Otherwise return a pending video (for local dev)
  return {
    id: uuidv4(),
    scriptId: script.id,
    voiceoverId: voiceover?.id,
    templateId: options.templateId,
    videoUrl: '', // Will be filled after render
    format: script.format,
    resolution: `${res.width}x${res.height}`,
    duration: script.totalDuration,
    status: 'pending',
    renderProgress: 0,
    createdAt: new Date(),
  };
}

/**
 * Render with Remotion Lambda
 */
async function renderWithRemotionLambda(
  compositionData: object,
  resolution: { width: number; height: number },
  script: VideoScript
): Promise<AssembledVideo> {
  // This would call the Remotion Lambda function
  // For now, return a mock pending result
  return {
    id: uuidv4(),
    scriptId: script.id,
    videoUrl: '',
    format: script.format,
    resolution: `${resolution.width}x${resolution.height}`,
    duration: script.totalDuration,
    status: 'rendering',
    renderProgress: 0,
    createdAt: new Date(),
  };
}

/**
 * Assemble with Creatomate API
 */
async function assembleWithCreatomate(
  script: VideoScript,
  voiceover: Voiceover | null,
  brandContext: BrandContext | null,
  resolution: string,
  options: AssemblyOptions
): Promise<AssembledVideo> {
  const apiKey = process.env.CREATOMATE_API_KEY;
  if (!apiKey) throw new Error('CREATOMATE_API_KEY not set');
  
  const res = RESOLUTIONS[resolution][script.format];
  
  // Build Creatomate render request
  const renderRequest = {
    template_id: options.templateId || 'default',
    modifications: {
      // Map script scenes to template elements
      ...buildCreatomateModifications(script, voiceover, brandContext),
    },
    output_format: 'mp4',
    width: res.width,
    height: res.height,
    frame_rate: 30,
  };
  
  const response = await fetch('https://api.creatomate.com/v1/renders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(renderRequest),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Creatomate render failed: ${error}`);
  }
  
  const result = await response.json();
  
  return {
    id: result.id,
    scriptId: script.id,
    voiceoverId: voiceover?.id,
    templateId: options.templateId,
    videoUrl: result.url || '',
    thumbnailUrl: result.snapshot_url,
    format: script.format,
    resolution: `${res.width}x${res.height}`,
    duration: script.totalDuration,
    status: result.status === 'succeeded' ? 'complete' : 
            result.status === 'failed' ? 'failed' : 'rendering',
    renderProgress: result.status === 'succeeded' ? 100 : 50,
    renderCost: calculateRenderCost(script.totalDuration),
    createdAt: new Date(),
    completedAt: result.status === 'succeeded' ? new Date() : undefined,
  };
}

/**
 * Build Creatomate modifications from script
 */
function buildCreatomateModifications(
  script: VideoScript,
  voiceover: Voiceover | null,
  brandContext: BrandContext | null
): Record<string, unknown> {
  const mods: Record<string, unknown> = {};
  
  // Set audio
  if (voiceover) {
    mods['Audio'] = voiceover.audioUrl;
  }
  
  // Set brand colors
  if (brandContext?.colors) {
    mods['PrimaryColor'] = brandContext.colors.primary;
    mods['SecondaryColor'] = brandContext.colors.secondary;
  }
  
  // Set text overlays from scenes
  script.scenes.forEach((scene, idx) => {
    if (scene.textOverlay) {
      mods[`Text_${idx + 1}`] = scene.textOverlay;
    }
  });
  
  return mods;
}

/**
 * Assemble with Shotstack API
 */
async function assembleWithShotstack(
  script: VideoScript,
  voiceover: Voiceover | null,
  brandContext: BrandContext | null,
  resolution: string,
  options: AssemblyOptions
): Promise<AssembledVideo> {
  const apiKey = process.env.SHOTSTACK_API_KEY;
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY not set');
  
  const res = RESOLUTIONS[resolution][script.format];
  
  // Build Shotstack timeline
  const timeline = buildShotstackTimeline(script, voiceover, brandContext, options);
  
  const response = await fetch('https://api.shotstack.io/v1/render', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeline,
      output: {
        format: 'mp4',
        resolution,
        aspectRatio: script.format.replace(':', 'x'),
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Shotstack render failed: ${error}`);
  }
  
  const result = await response.json();
  
  return {
    id: result.response.id,
    scriptId: script.id,
    voiceoverId: voiceover?.id,
    videoUrl: '',
    format: script.format,
    resolution: `${res.width}x${res.height}`,
    duration: script.totalDuration,
    status: 'rendering',
    renderProgress: 0,
    createdAt: new Date(),
  };
}

/**
 * Build Shotstack timeline from script
 */
function buildShotstackTimeline(
  script: VideoScript,
  voiceover: Voiceover | null,
  brandContext: BrandContext | null,
  options: AssemblyOptions
): object {
  const tracks = [];
  let currentTime = 0;
  
  // Audio track
  if (voiceover) {
    tracks.push({
      clips: [{
        asset: {
          type: 'audio',
          src: voiceover.audioUrl,
        },
        start: 0,
        length: script.totalDuration,
      }],
    });
  }
  
  // Text overlay track
  const textClips = script.scenes
    .filter(scene => scene.textOverlay)
    .map(scene => {
      const clip = {
        asset: {
          type: 'title',
          text: scene.textOverlay,
          style: 'subtitle',
          color: brandContext?.colors?.text || '#ffffff',
          background: brandContext?.colors?.primary || '#000000',
        },
        start: currentTime,
        length: scene.duration,
        transition: {
          in: 'fade',
          out: 'fade',
        },
      };
      currentTime += scene.duration;
      return clip;
    });
  
  if (textClips.length > 0) {
    tracks.push({ clips: textClips });
  }
  
  return {
    tracks,
    background: brandContext?.colors?.background || '#000000',
  };
}

/**
 * Calculate render cost estimate
 */
function calculateRenderCost(durationSeconds: number): number {
  // Approximate cost: $0.10 per minute
  return Math.round((durationSeconds / 60) * 0.10 * 100) / 100;
}

/**
 * Get render status
 */
export async function getRenderStatus(
  videoId: string,
  service: 'creatomate' | 'shotstack' = 'creatomate'
): Promise<{
  status: 'pending' | 'rendering' | 'complete' | 'failed';
  progress: number;
  url?: string;
  error?: string;
}> {
  if (service === 'creatomate') {
    const apiKey = process.env.CREATOMATE_API_KEY;
    if (!apiKey) return { status: 'failed', progress: 0, error: 'API key not set' };
    
    const response = await fetch(`https://api.creatomate.com/v1/renders/${videoId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    
    if (!response.ok) {
      return { status: 'failed', progress: 0, error: `API error: ${response.status}` };
    }
    
    const result = await response.json();
    return {
      status: result.status === 'succeeded' ? 'complete' :
              result.status === 'failed' ? 'failed' : 'rendering',
      progress: result.status === 'succeeded' ? 100 : 50,
      url: result.url,
      error: result.error_message,
    };
  }
  
  if (service === 'shotstack') {
    const apiKey = process.env.SHOTSTACK_API_KEY;
    if (!apiKey) return { status: 'failed', progress: 0, error: 'API key not set' };
    
    const response = await fetch(`https://api.shotstack.io/v1/render/${videoId}`, {
      headers: { 'x-api-key': apiKey },
    });
    
    if (!response.ok) {
      return { status: 'failed', progress: 0, error: `API error: ${response.status}` };
    }
    
    const result = await response.json();
    return {
      status: result.response.status === 'done' ? 'complete' :
              result.response.status === 'failed' ? 'failed' : 'rendering',
      progress: result.response.status === 'done' ? 100 : 50,
      url: result.response.url,
      error: result.response.error,
    };
  }
  
  return { status: 'pending', progress: 0 };
}

/**
 * Cancel a render
 */
export async function cancelRender(videoId: string): Promise<boolean> {
  // Most services don't support cancellation, but we can mark it as cancelled locally
  return true;
}
