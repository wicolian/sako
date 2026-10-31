/**
 * Video Pipeline Integration Tests (Jan 2026)
 * 
 * Tests for video script generation, voiceover, and assembly.
 */

import '@/tests/setup-fetch'
import { describe, it, expect, vi } from 'vitest';

// Mock AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      title: 'Test Video',
      scenes: [
        {
          id: 'scene-1',
          order: 1,
          narration: 'Welcome to our product',
          visualDirection: 'Product logo animation',
          duration: 5,
          transition: 'fade',
          textOverlay: 'Welcome',
          brollKeywords: ['technology', 'innovation'],
        },
      ],
      voiceoverText: 'Welcome to our product',
      totalDuration: 30,
      format: '16:9',
      style: 'professional',
    },
  }),
}));

// Mock ElevenLabs
vi.mock('@/lib/video/voiceover', () => ({
  generateVoiceover: vi.fn().mockResolvedValue({
    id: 'vo-test-1',
    audioUrl: 'https://example.com/audio.mp3',
    duration: 30,
    voiceId: 'test-voice',
    segments: [],
  }),
}));

// Mock video assembly
vi.mock('@/lib/video/assembly', () => ({
  assembleVideo: vi.fn().mockResolvedValue({
    id: 'render-test-1',
    status: 'rendering',
    videoUrl: null,
    thumbnailUrl: null,
    renderProgress: 0,
  }),
  getRenderStatus: vi.fn().mockResolvedValue({
    status: 'complete',
    progress: 100,
    url: 'https://example.com/video.mp4',
  }),
}));

describe('Video Script Generation', () => {
  describe('POST /api/video/generate-script', () => {
    it('should generate video script', async () => {
      const response = await fetch('/api/video/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: 'test-campaign-1',
          format: '16:9',
          style: 'professional',
          duration: 30,
        }),
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.script).toBeDefined();
      expect(data.script.scenes).toBeDefined();
      expect(Array.isArray(data.script.scenes)).toBe(true);
    });
    
    it('should support different formats', async () => {
      const formats = ['16:9', '9:16', '1:1'];
      
      for (const format of formats) {
        const response = await fetch('/api/video/generate-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: 'test-campaign-1',
            format,
          }),
        });
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.script.format).toBe(format);
      }
    });
    
    it('should validate campaign exists', async () => {
      const response = await fetch('/api/video/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: 'non-existent',
          format: '16:9',
        }),
      });
      
      expect(response.status).toBe(404);
    });
  });
});

describe('Voiceover Generation', () => {
  describe('POST /api/video/generate-voiceover', () => {
    it('should generate voiceover', async () => {
      const response = await fetch('/api/video/generate-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId: 'test-script-1',
          voiceId: 'test-voice',
        }),
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.voiceover).toBeDefined();
      expect(data.voiceover.audioUrl).toBeDefined();
    });
    
    it('should require script ID', async () => {
      const response = await fetch('/api/video/generate-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: 'test-voice',
        }),
      });
      
      expect(response.status).toBe(400);
    });
  });
});

describe('Video Assembly', () => {
  describe('POST /api/video/assemble', () => {
    it('should start video assembly', async () => {
      const response = await fetch('/api/video/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptAssetId: 'test-script-1',
          voiceoverAssetId: 'test-voiceover-1',
        }),
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.renderId).toBeDefined();
      expect(data.status).toBe('rendering');
    });
  });
  
  describe('GET /api/video/[id]/status', () => {
    it('should return render status', async () => {
      const response = await fetch('/api/video/render-test-1/status');
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBeDefined();
      expect(['pending', 'rendering', 'complete', 'failed']).toContain(data.status);
    });
    
    it('should return video URL when complete', async () => {
      const response = await fetch('/api/video/render-complete-1/status');
      
      expect(response.status).toBe(200);
      const data = await response.json();
      if (data.status === 'complete') {
        expect(data.url).toBeDefined();
      }
    });
  });
});

describe('Video Editor Integration', () => {
  it('should save script changes', async () => {
    const response = await fetch('/api/campaigns/test-campaign-1/assets/test-script-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: {
          scenes: [
            {
              id: 'scene-1',
              narration: 'Updated narration',
              duration: 10,
            },
          ],
        },
      }),
    });
    
    expect(response.status).toBe(200);
  });
  
  it('should trigger re-render after changes', async () => {
    // First update the script
    await fetch('/api/campaigns/test-campaign-1/assets/test-script-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { scenes: [] },
      }),
    });
    
    // Then trigger re-render
    const response = await fetch('/api/video/assemble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scriptAssetId: 'test-script-1',
        voiceoverAssetId: 'test-voiceover-1',
        forceRerender: true,
      }),
    });
    
    expect(response.status).toBe(200);
  });
});
