/**
 * Video Script Generator (Jan 2026)
 * 
 * Generate scene-by-scene video scripts with timing,
 * visual directions, B-roll suggestions, and voiceover text.
 */

import { generateObject } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { MODELS } from '@/lib/ai/ai-sdk-client';
import { getBrandContext, type BrandContext } from '@/lib/ai/brand-context';
import type { Campaign } from '@/lib/supabase/types';

export type VideoFormat = '16:9' | '9:16' | '1:1';
export type VideoStyle = 'explainer' | 'testimonial' | 'product' | 'brand' | 'announcement';
export type TransitionType = 'cut' | 'fade' | 'slide' | 'zoom' | 'wipe';

export interface Scene {
  id: string;
  order: number;
  duration: number; // seconds
  narration: string;
  visualDirection: string;
  textOverlay?: string;
  brollKeywords: string[];
  transition: TransitionType;
  claims: string[];
}

export interface VideoScript {
  id: string;
  format: VideoFormat;
  style: VideoStyle;
  totalDuration: number;
  scenes: Scene[];
  voiceoverText: string;
  musicMood: string;
  claims: string[];
  estimatedCost?: number;
}

export interface VideoScriptOptions {
  duration?: number; // target duration in seconds
  style?: VideoStyle;
  includeVoiceover?: boolean;
  hookStyle?: 'question' | 'statistic' | 'bold-claim' | 'story';
}

// Format specifications
const FORMAT_SPECS: Record<VideoFormat, {
  name: string;
  useCase: string;
  aspectRatio: string;
  resolution: string;
  platforms: string[];
  optimalDuration: { min: number; max: number };
}> = {
  '16:9': {
    name: 'Landscape',
    useCase: 'YouTube, LinkedIn, Website embeds',
    aspectRatio: '16:9',
    resolution: '1920x1080',
    platforms: ['youtube', 'linkedin', 'website'],
    optimalDuration: { min: 30, max: 180 },
  },
  '9:16': {
    name: 'Portrait/Vertical',
    useCase: 'TikTok, Instagram Reels, YouTube Shorts',
    aspectRatio: '9:16',
    resolution: '1080x1920',
    platforms: ['tiktok', 'instagram', 'youtube-shorts'],
    optimalDuration: { min: 15, max: 60 },
  },
  '1:1': {
    name: 'Square',
    useCase: 'Instagram Feed, LinkedIn Feed, Facebook',
    aspectRatio: '1:1',
    resolution: '1080x1080',
    platforms: ['instagram', 'linkedin', 'facebook'],
    optimalDuration: { min: 15, max: 60 },
  },
};

// Schema for scene generation
const SceneSchema = z.object({
  duration: z.number().describe('Scene duration in seconds'),
  narration: z.string().describe('What is spoken in this scene'),
  visualDirection: z.string().describe('What should be shown on screen'),
  textOverlay: z.string().optional().describe('Text to display on screen'),
  brollKeywords: z.array(z.string()).describe('Keywords for B-roll footage search'),
  transition: z.enum(['cut', 'fade', 'slide', 'zoom', 'wipe']),
});

const VideoScriptSchema = z.object({
  scenes: z.array(SceneSchema),
  musicMood: z.string().describe('Background music mood/genre'),
  hook: z.string().describe('The opening hook/first 3 seconds'),
});

/**
 * Generate a video script
 */
export async function generateVideoScript(
  campaign: Campaign,
  workspaceId: string,
  format: VideoFormat,
  options: VideoScriptOptions = {}
): Promise<VideoScript> {
  const brandContext = await getBrandContext(workspaceId);
  const formatSpec = FORMAT_SPECS[format];
  
  // Calculate target duration
  const targetDuration = options.duration || 
    (format === '16:9' ? 60 : format === '9:16' ? 30 : 45);
  
  const style = options.style || 'explainer';
  const sceneCount = calculateSceneCount(targetDuration, style);
  
  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: VideoScriptSchema,
    prompt: `Create a ${targetDuration}-second ${style} video script in ${format} format.

CAMPAIGN:
- Name: ${campaign.name}
- Audience: ${campaign.audience || 'general'}
- Goal: ${campaign.goal || 'awareness'}
- Key Message: ${campaign.offer || campaign.name}
- CTA: ${campaign.cta || 'Learn more'}

BRAND:
- Name: ${brandContext?.name || 'Company'}
- Voice: ${brandContext?.voice?.tone || 'professional, friendly'}

FORMAT: ${formatSpec.name} (${formatSpec.resolution})
PLATFORMS: ${formatSpec.platforms.join(', ')}
STYLE: ${style}
${options.hookStyle ? `HOOK STYLE: ${options.hookStyle}` : ''}

Create ${sceneCount} scenes totaling approximately ${targetDuration} seconds.

STRUCTURE FOR ${style.toUpperCase()}:
${getStyleStructure(style, sceneCount)}

REQUIREMENTS:
1. Hook must grab attention in first 3 seconds
2. Each scene should have clear visual direction
3. Narration should be conversational, not salesy
4. End with a clear CTA
5. B-roll keywords should be specific and searchable
6. Text overlays should reinforce key points
7. Transitions should match the pace/mood

${format === '9:16' ? 'VERTICAL VIDEO TIPS: Keep action centered, use text overlays for key points, fast pacing' : ''}
${format === '16:9' ? 'LANDSCAPE VIDEO TIPS: Can show more detail, good for demonstrations, professional feel' : ''}`,
  });
  
  // Process scenes
  const scenes: Scene[] = (object as any).scenes.map((scene: any, idx: number) => ({
    id: `scene-${idx + 1}`,
    order: idx + 1,
    ...scene,
    claims: [], // TODO: Extract claims from narration
  }));
  
  // Calculate actual duration
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  
  // Combine all narration for voiceover
  const voiceoverText = scenes.map(s => s.narration).join('\n\n');
  
  return {
    id: `script-${Date.now()}`,
    format,
    style,
    totalDuration,
    scenes,
    voiceoverText,
    musicMood: (object as any).musicMood,
    claims: [],
    estimatedCost: estimateProductionCost(totalDuration),
  };
}

/**
 * Calculate optimal scene count based on duration and style
 */
function calculateSceneCount(duration: number, style: VideoStyle): number {
  // Average scene duration varies by style
  const avgSceneDuration: Record<VideoStyle, number> = {
    explainer: 8,
    testimonial: 12,
    product: 6,
    brand: 10,
    announcement: 7,
  };
  
  const avg = avgSceneDuration[style];
  return Math.max(3, Math.min(15, Math.round(duration / avg)));
}

/**
 * Get style-specific structure guidelines
 */
function getStyleStructure(style: VideoStyle, sceneCount: number): string {
  const structures: Record<VideoStyle, string> = {
    explainer: `
- Scene 1: Hook with problem statement
- Scenes 2-${Math.floor(sceneCount * 0.4)}: Problem amplification
- Scenes ${Math.floor(sceneCount * 0.4) + 1}-${Math.floor(sceneCount * 0.7)}: Solution introduction
- Scenes ${Math.floor(sceneCount * 0.7) + 1}-${sceneCount - 1}: Benefits/features
- Scene ${sceneCount}: CTA`,
    
    testimonial: `
- Scene 1: Customer introduction
- Scenes 2-${Math.floor(sceneCount * 0.3)}: Their challenge/problem
- Scenes ${Math.floor(sceneCount * 0.3) + 1}-${Math.floor(sceneCount * 0.6)}: Discovery and implementation
- Scenes ${Math.floor(sceneCount * 0.6) + 1}-${sceneCount - 1}: Results and impact
- Scene ${sceneCount}: Recommendation/CTA`,
    
    product: `
- Scene 1: Hook showing the product
- Scenes 2-${Math.floor(sceneCount * 0.3)}: Key problem it solves
- Scenes ${Math.floor(sceneCount * 0.3) + 1}-${sceneCount - 1}: Feature demonstrations
- Scene ${sceneCount}: CTA`,
    
    brand: `
- Scene 1: Attention-grabbing brand moment
- Scenes 2-${Math.floor(sceneCount * 0.4)}: Brand story/mission
- Scenes ${Math.floor(sceneCount * 0.4) + 1}-${Math.floor(sceneCount * 0.7)}: Values in action
- Scenes ${Math.floor(sceneCount * 0.7) + 1}-${sceneCount - 1}: Community/impact
- Scene ${sceneCount}: Brand tagline/CTA`,
    
    announcement: `
- Scene 1: Exciting hook/teaser
- Scene 2: The big news
- Scenes 3-${sceneCount - 1}: Details and benefits
- Scene ${sceneCount}: How to get involved/CTA`,
  };
  
  return structures[style];
}

/**
 * Estimate production cost
 */
function estimateProductionCost(durationSeconds: number): number {
  // Rough estimates (adjust based on actual costs)
  const voiceoverCostPerSecond = 0.05; // ~$3 per minute
  const renderCostPerSecond = 0.10; // ~$6 per minute
  
  return Math.round((voiceoverCostPerSecond + renderCostPerSecond) * durationSeconds * 100) / 100;
}

/**
 * Generate a short-form video script (TikTok/Reels style)
 */
export async function generateShortFormScript(
  campaign: Campaign,
  workspaceId: string,
  options: {
    duration?: 15 | 30 | 60;
    trend?: string;
    format?: 'hook-value-cta' | 'storytelling' | 'list' | 'before-after';
  } = {}
): Promise<VideoScript> {
  const duration = options.duration || 30;
  const format = options.format || 'hook-value-cta';
  
  return generateVideoScript(campaign, workspaceId, '9:16', {
    duration,
    style: 'product',
    hookStyle: 'bold-claim',
  });
}

/**
 * Regenerate a single scene
 */
export async function regenerateScene(
  script: VideoScript,
  sceneId: string,
  instructions?: string
): Promise<Scene> {
  const sceneIndex = script.scenes.findIndex(s => s.id === sceneId);
  const originalScene = script.scenes[sceneIndex];
  
  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: SceneSchema,
    prompt: `Regenerate this video scene with improvements.

ORIGINAL SCENE:
- Duration: ${originalScene.duration}s
- Narration: "${originalScene.narration}"
- Visual: ${originalScene.visualDirection}
- Transition: ${originalScene.transition}

CONTEXT:
- Video format: ${script.format}
- Video style: ${script.style}
- Total duration: ${script.totalDuration}s
- This is scene ${sceneIndex + 1} of ${script.scenes.length}
- Previous scene: ${sceneIndex > 0 ? script.scenes[sceneIndex - 1].narration.slice(0, 50) : 'N/A'}
- Next scene: ${sceneIndex < script.scenes.length - 1 ? script.scenes[sceneIndex + 1].narration.slice(0, 50) : 'N/A'}

${instructions ? `SPECIFIC INSTRUCTIONS:\n${instructions}` : 'Make it more engaging and impactful.'}

Keep the same approximate duration but improve the content.`,
  });
  
  return {
    id: sceneId,
    order: sceneIndex + 1,
    ...(object as any),
    claims: [],
  };
}

/**
 * Export script to teleprompter format
 */
export function exportToTeleprompter(script: VideoScript): string {
  const lines: string[] = [];
  
  lines.push(`# ${script.style.toUpperCase()} VIDEO SCRIPT`);
  lines.push(`Format: ${script.format} | Duration: ${script.totalDuration}s`);
  lines.push('---');
  lines.push('');
  
  script.scenes.forEach((scene: any, idx: number) => {
    lines.push(`[SCENE ${idx + 1} - ${scene.duration}s]`);
    lines.push('');
    lines.push(scene.narration);
    lines.push('');
    lines.push(`📹 ${scene.visualDirection}`);
    if (scene.textOverlay) {
      lines.push(`📝 TEXT: "${scene.textOverlay}"`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  });
  
  return lines.join('\n');
}

/**
 * Get reading time estimate for voiceover
 */
export function estimateReadingTime(text: string): number {
  // Average speaking rate: 150 words per minute
  const words = text.split(/\s+/).length;
  return Math.round((words / 150) * 60); // seconds
}

/**
 * Validate script timing
 */
export function validateScriptTiming(script: VideoScript): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check total duration
  const actualDuration = script.scenes.reduce((sum, s) => sum + s.duration, 0);
  if (Math.abs(actualDuration - script.totalDuration) > 5) {
    issues.push(`Duration mismatch: scenes total ${actualDuration}s but script says ${script.totalDuration}s`);
  }
  
  // Check voiceover fits in scenes
  script.scenes.forEach((scene: any, idx: number) => {
    const readingTime = estimateReadingTime(scene.narration);
    if (readingTime > scene.duration + 2) {
      issues.push(`Scene ${idx + 1}: Narration takes ~${readingTime}s but scene is only ${scene.duration}s`);
    }
  });
  
  // Check format-specific constraints
  const formatSpec = FORMAT_SPECS[script.format];
  if (actualDuration < formatSpec.optimalDuration.min) {
    issues.push(`Video is too short for ${script.format} format (min: ${formatSpec.optimalDuration.min}s)`);
  }
  if (actualDuration > formatSpec.optimalDuration.max) {
    issues.push(`Video may be too long for ${script.format} format (max: ${formatSpec.optimalDuration.max}s)`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}
