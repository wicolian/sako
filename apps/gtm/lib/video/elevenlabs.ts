/**
 * ElevenLabs Integration (Jan 2026)
 * 
 * Text-to-speech generation for video voiceovers using
 * ElevenLabs API with voice cloning and multi-language support.
 */

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

export interface Voice {
  voice_id: string;
  name: string;
  preview_url?: string;
  category?: string;
  labels?: Record<string, string>;
}

export interface VoiceSettings {
  stability: number; // 0-1
  similarity_boost: number; // 0-1
  style?: number; // 0-1
  use_speaker_boost?: boolean;
}

export interface GenerateSpeechOptions {
  voiceId: string;
  text: string;
  modelId?: string;
  voiceSettings?: VoiceSettings;
  outputFormat?: 'mp3_44100_128' | 'mp3_44100_192' | 'pcm_16000' | 'pcm_22050';
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
  segments?: VoiceoverSegment[];
}

export interface VoiceoverSegment {
  sceneId: string;
  audioUrl: string;
  startTime: number;
  duration: number;
}

// Default voice settings for professional voiceovers
const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.5,
  use_speaker_boost: true,
};

// Cost per character (approximate, varies by subscription)
const COST_PER_CHARACTER = 0.00003; // ~$30 per 1M characters

/**
 * Check if ElevenLabs is configured
 */
export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

/**
 * Get API key
 */
function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error('ELEVENLABS_API_KEY not configured. Add it to your .env.local file to enable AI voiceovers.');
  }
  return key;
}

/**
 * Get available voices
 */
export async function getVoices(): Promise<Voice[]> {
  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      'xi-api-key': getApiKey(),
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }
  
  const data = await response.json();
  return data.voices;
}

/**
 * Get a specific voice by ID
 */
export async function getVoice(voiceId: string): Promise<Voice | null> {
  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices/${voiceId}`, {
      headers: {
        'xi-api-key': getApiKey(),
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Generate speech from text
 */
export async function generateSpeech(options: GenerateSpeechOptions): Promise<Buffer> {
  const {
    voiceId,
    text,
    modelId = 'eleven_multilingual_v2',
    voiceSettings = DEFAULT_VOICE_SETTINGS,
    outputFormat = 'mp3_44100_128',
  } = options;
  
  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}?output_format=${outputFormat}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': getApiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: voiceSettings,
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Speech generation failed: ${response.status} - ${error}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate speech with streaming (for long texts)
 */
export async function generateSpeechStream(
  options: GenerateSpeechOptions
): Promise<ReadableStream<Uint8Array>> {
  const {
    voiceId,
    text,
    modelId = 'eleven_multilingual_v2',
    voiceSettings = DEFAULT_VOICE_SETTINGS,
  } = options;
  
  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': getApiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: voiceSettings,
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Speech stream failed: ${response.status} - ${error}`);
  }
  
  return response.body!;
}

/**
 * Estimate cost for text
 */
export function estimateCost(text: string): number {
  return text.length * COST_PER_CHARACTER;
}

/**
 * Get user subscription info
 */
export async function getSubscriptionInfo(): Promise<{
  character_count: number;
  character_limit: number;
  can_use_instant_voice_cloning: boolean;
  available_models: string[];
}> {
  const response = await fetch(`${ELEVENLABS_API_URL}/user/subscription`, {
    headers: {
      'xi-api-key': getApiKey(),
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch subscription: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Recommended voices for different use cases
 */
export const RECOMMENDED_VOICES: Record<string, {
  voiceId: string;
  name: string;
  useCase: string;
}> = {
  professional_male: {
    voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam
    name: 'Adam',
    useCase: 'Professional, corporate videos',
  },
  professional_female: {
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella
    name: 'Bella',
    useCase: 'Professional, corporate videos',
  },
  friendly_male: {
    voiceId: 'TxGEqnHWrfWFTfGW9XjX', // Josh
    name: 'Josh',
    useCase: 'Friendly, approachable content',
  },
  friendly_female: {
    voiceId: 'MF3mGyEYCl7XYWbV9V6O', // Elli
    name: 'Elli',
    useCase: 'Friendly, approachable content',
  },
  energetic: {
    voiceId: 'yoZ06aMxZJJ28mfd3POQ', // Sam
    name: 'Sam',
    useCase: 'High-energy, promotional content',
  },
  narrator: {
    voiceId: 'ThT5KcBeYPX3keUQqHPh', // Dorothy
    name: 'Dorothy',
    useCase: 'Documentary, storytelling',
  },
};

/**
 * Select best voice based on brand context
 */
export function selectVoiceForBrand(brandContext: {
  voice?: { tone?: string };
  audience?: { type?: string };
}): string {
  const tone = brandContext.voice?.tone?.toLowerCase() || '';
  const audience = brandContext.audience?.type?.toLowerCase() || '';
  
  // Match based on tone
  if (tone.includes('professional') || tone.includes('corporate')) {
    return RECOMMENDED_VOICES.professional_male.voiceId;
  }
  if (tone.includes('friendly') || tone.includes('casual')) {
    return RECOMMENDED_VOICES.friendly_female.voiceId;
  }
  if (tone.includes('energetic') || tone.includes('exciting')) {
    return RECOMMENDED_VOICES.energetic.voiceId;
  }
  
  // Match based on audience
  if (audience.includes('b2b') || audience.includes('enterprise')) {
    return RECOMMENDED_VOICES.professional_male.voiceId;
  }
  if (audience.includes('consumer') || audience.includes('retail')) {
    return RECOMMENDED_VOICES.friendly_female.voiceId;
  }
  
  // Default
  return RECOMMENDED_VOICES.professional_male.voiceId;
}

/**
 * Get audio duration from buffer (rough estimate)
 */
export function estimateAudioDuration(text: string): number {
  // Average speaking rate: 150 words per minute
  const words = text.split(/\s+/).length;
  return Math.round((words / 150) * 60);
}
