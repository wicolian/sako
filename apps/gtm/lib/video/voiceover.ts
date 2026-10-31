/**
 * Voiceover Generator (Jan 2026)
 * 
 * Orchestrates voiceover generation from video scripts
 * using ElevenLabs, with per-scene segmentation and storage.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { 
  generateSpeech, 
  getVoice, 
  estimateCost, 
  estimateAudioDuration,
  selectVoiceForBrand,
  isElevenLabsConfigured,
  type VoiceSettings 
} from './elevenlabs';
import type { VideoScript, Scene } from '@/lib/assets/video-script-generator';
import { getBrandContext } from '@/lib/ai/brand-context';
import { v4 as uuidv4 } from 'uuid';

/**
 * Check if voiceover generation is configured
 */
export function isVoiceoverConfigured(): { configured: boolean; reason?: string } {
  if (isElevenLabsConfigured()) {
    return { configured: true };
  }
  return { 
    configured: false, 
    reason: 'ELEVENLABS_API_KEY not configured. Add it to .env.local to enable AI voiceovers.'
  };
}

export interface Voiceover {
  id: string;
  scriptId: string;
  voiceId: string;
  voiceName: string;
  audioUrl: string;
  duration: number;
  characterCount: number;
  cost: number;
  segments: VoiceoverSegment[];
  provider: 'elevenlabs' | 'playht' | 'openai' | 'google';
  settings: VoiceSettings;
  createdAt: Date;
}

export interface VoiceoverSegment {
  sceneId: string;
  sceneOrder: number;
  audioUrl: string;
  startTime: number;
  duration: number;
  narration: string;
}

export interface GenerateVoiceoverOptions {
  voiceId?: string;
  speed?: number; // 0.5-2.0
  perScene?: boolean; // Generate per scene or full
  voiceSettings?: Partial<VoiceSettings>;
}

/**
 * Generate voiceover for entire script
 */
export async function generateVoiceover(
  script: VideoScript,
  workspaceId: string,
  options: GenerateVoiceoverOptions = {}
): Promise<Voiceover> {
  const brandContext = await getBrandContext(workspaceId);
  
  // Select voice
  const voiceId = options.voiceId || selectVoiceForBrand(brandContext || {});
  const voice = await getVoice(voiceId);
  
  if (!voice) {
    throw new Error(`Voice not found: ${voiceId}`);
  }
  
  const voiceSettings: VoiceSettings = {
    stability: options.voiceSettings?.stability ?? 0.5,
    similarity_boost: options.voiceSettings?.similarity_boost ?? 0.75,
    style: options.voiceSettings?.style ?? 0.5,
    use_speaker_boost: options.voiceSettings?.use_speaker_boost ?? true,
  };
  
  let audioUrl: string;
  let segments: VoiceoverSegment[] = [];
  
  if (options.perScene) {
    // Generate per scene
    const result = await generatePerSceneVoiceover(script, voiceId, voiceSettings, workspaceId);
    audioUrl = result.combinedUrl;
    segments = result.segments;
  } else {
    // Generate full voiceover
    audioUrl = await generateFullVoiceover(script, voiceId, voiceSettings, workspaceId);
    segments = createSegmentsFromScript(script, audioUrl);
  }
  
  const characterCount = script.voiceoverText.length;
  const cost = estimateCost(script.voiceoverText);
  const duration = estimateAudioDuration(script.voiceoverText);
  
  const voiceover: Voiceover = {
    id: uuidv4(),
    scriptId: script.id,
    voiceId,
    voiceName: voice.name,
    audioUrl,
    duration,
    characterCount,
    cost,
    segments,
    provider: 'elevenlabs',
    settings: voiceSettings,
    createdAt: new Date(),
  };
  
  // Save to database
  await saveVoiceover(voiceover, workspaceId);
  
  return voiceover;
}

/**
 * Generate full voiceover as single audio file
 */
async function generateFullVoiceover(
  script: VideoScript,
  voiceId: string,
  settings: VoiceSettings,
  workspaceId: string
): Promise<string> {
  const audioBuffer = await generateSpeech({
    voiceId,
    text: script.voiceoverText,
    voiceSettings: settings,
  });
  
  // Upload to storage
  return uploadAudio(audioBuffer, `voiceover-${script.id}.mp3`, workspaceId);
}

/**
 * Generate voiceover per scene
 */
async function generatePerSceneVoiceover(
  script: VideoScript,
  voiceId: string,
  settings: VoiceSettings,
  workspaceId: string
): Promise<{ combinedUrl: string; segments: VoiceoverSegment[] }> {
  const segments: VoiceoverSegment[] = [];
  const audioBuffers: Buffer[] = [];
  let currentTime = 0;
  
  for (const scene of script.scenes) {
    // Generate audio for this scene
    const audioBuffer = await generateSpeech({
      voiceId,
      text: scene.narration,
      voiceSettings: settings,
    });
    
    // Upload segment
    const segmentUrl = await uploadAudio(
      audioBuffer,
      `voiceover-${script.id}-scene-${scene.order}.mp3`,
      workspaceId
    );
    
    const segmentDuration = estimateAudioDuration(scene.narration);
    
    segments.push({
      sceneId: scene.id,
      sceneOrder: scene.order,
      audioUrl: segmentUrl,
      startTime: currentTime,
      duration: segmentDuration,
      narration: scene.narration,
    });
    
    audioBuffers.push(audioBuffer);
    currentTime += segmentDuration;
  }
  
  // Combine all audio (simple concatenation - in production use ffmpeg)
  const combinedBuffer = Buffer.concat(audioBuffers);
  const combinedUrl = await uploadAudio(
    combinedBuffer,
    `voiceover-${script.id}-combined.mp3`,
    workspaceId
  );
  
  return { combinedUrl, segments };
}

/**
 * Create segments from script timing
 */
function createSegmentsFromScript(script: VideoScript, audioUrl: string): VoiceoverSegment[] {
  let currentTime = 0;
  
  return script.scenes.map(scene => {
    const duration = estimateAudioDuration(scene.narration);
    const segment: VoiceoverSegment = {
      sceneId: scene.id,
      sceneOrder: scene.order,
      audioUrl, // Full audio URL - front-end can use startTime/duration to play segment
      startTime: currentTime,
      duration,
      narration: scene.narration,
    };
    currentTime += duration;
    return segment;
  });
}

/**
 * Upload audio to Supabase Storage
 */
async function uploadAudio(
  buffer: Buffer,
  filename: string,
  workspaceId: string
): Promise<string> {
  const supabase = await createServiceClient();
  const path = `${workspaceId}/voiceovers/${filename}`;
  
  const { data, error } = await supabase.storage
    .from('assets')
    .upload(path, buffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
  
  if (error) {
    console.error('Failed to upload audio:', error);
    throw new Error(`Failed to upload audio: ${error.message}`);
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('assets')
    .getPublicUrl(path);
  
  return urlData.publicUrl;
}

/**
 * Save voiceover to database
 */
async function saveVoiceover(voiceover: Voiceover, workspaceId: string): Promise<void> {
  const supabase = await createServiceClient();
  
  // Find or create the script record first
  const { error } = await supabase
    .from('voiceovers')
    .insert({
      id: voiceover.id,
      script_id: voiceover.scriptId,
      provider: voiceover.provider,
      voice_id: voiceover.voiceId,
      voice_name: voiceover.voiceName,
      audio_url: voiceover.audioUrl,
      duration: voiceover.duration,
      character_count: voiceover.characterCount,
      cost: voiceover.cost,
      stability: voiceover.settings.stability,
      similarity_boost: voiceover.settings.similarity_boost,
      segments: voiceover.segments,
      created_at: voiceover.createdAt.toISOString(),
    });
  
  if (error) {
    console.error('Failed to save voiceover:', error);
    // Don't throw - voiceover was generated successfully
  }
}

/**
 * Regenerate voiceover for a specific scene
 */
export async function regenerateSceneVoiceover(
  voiceover: Voiceover,
  sceneId: string,
  newNarration: string,
  workspaceId: string
): Promise<VoiceoverSegment> {
  const audioBuffer = await generateSpeech({
    voiceId: voiceover.voiceId,
    text: newNarration,
    voiceSettings: voiceover.settings,
  });
  
  const segmentUrl = await uploadAudio(
    audioBuffer,
    `voiceover-${voiceover.scriptId}-scene-${sceneId}-v2.mp3`,
    workspaceId
  );
  
  const duration = estimateAudioDuration(newNarration);
  
  return {
    sceneId,
    sceneOrder: voiceover.segments.find(s => s.sceneId === sceneId)?.sceneOrder || 0,
    audioUrl: segmentUrl,
    startTime: 0, // Will need to be recalculated
    duration,
    narration: newNarration,
  };
}

/**
 * Get voiceover cost estimate
 */
export function getVoiceoverCostEstimate(script: VideoScript): {
  characterCount: number;
  estimatedCost: number;
  estimatedDuration: number;
} {
  return {
    characterCount: script.voiceoverText.length,
    estimatedCost: estimateCost(script.voiceoverText),
    estimatedDuration: estimateAudioDuration(script.voiceoverText),
  };
}
