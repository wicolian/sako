/**
 * Deploy Flow Integration Tests (Jan 2026)
 * 
 * Tests for campaign deployment and publishing.
 */

import '@/tests/setup-fetch'
import { describe, it, expect, vi } from 'vitest';

// Mock Supabase
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: mockCampaign, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: mockCampaign, error: null }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: mockDeployment, error: null }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: { path: 'test-path' }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/file' } }),
      }),
    },
  }),
}));

const mockCampaign = {
  id: 'test-campaign-1',
  workspace_id: 'test-workspace',
  name: 'Test Campaign',
  status: 'draft',
};

const mockDeployment = {
  id: 'deploy-1',
  campaign_id: 'test-campaign-1',
  status: 'deployed',
  url: 'https://example.com/campaign/test-campaign-1',
  deployed_at: new Date().toISOString(),
};

describe('Campaign Deployment', () => {
  describe('POST /api/campaigns/[id]/deploy', () => {
    it('should deploy campaign', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'production',
        }),
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.deployment).toBeDefined();
      expect(data.deployment.status).toBe('deployed');
      expect(data.deployment.url).toBeDefined();
    });
    
    it('should validate campaign has assets', async () => {
      const response = await fetch('/api/campaigns/empty-campaign/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'production',
        }),
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('assets');
    });
    
    it('should validate all claims are supported', async () => {
      const response = await fetch('/api/campaigns/blocked-claims-campaign/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'production',
          validateClaims: true,
        }),
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('claims');
    });
  });
  
  describe('GET /api/campaigns/[id]/deployments', () => {
    it('should list deployments', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1/deployments');
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.deployments).toBeDefined();
      expect(Array.isArray(data.deployments)).toBe(true);
    });
  });
  
  describe('POST /api/campaigns/[id]/unpublish', () => {
    it('should unpublish campaign', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1/unpublish', {
        method: 'POST',
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});

describe('Asset Export', () => {
  describe('GET /api/campaigns/[id]/assets/[assetId]/export', () => {
    it('should export landing page as HTML', async () => {
      const response = await fetch(
        '/api/campaigns/test-campaign-1/assets/landing-page-1/export?format=html'
      );
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });
    
    it('should export deck as PPTX', async () => {
      const response = await fetch(
        '/api/campaigns/test-campaign-1/assets/deck-1/export?format=pptx'
      );
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/vnd.openxmlformats');
    });
    
    it('should export social posts as JSON', async () => {
      const response = await fetch(
        '/api/campaigns/test-campaign-1/assets/social-1/export?format=json'
      );
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });
});

describe('Deployment Webhooks', () => {
  describe('POST /api/webhooks/deploy', () => {
    it('should handle deployment webhook', async () => {
      const response = await fetch('/api/webhooks/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test-secret',
        },
        body: JSON.stringify({
          event: 'deployment.completed',
          campaignId: 'test-campaign-1',
          deploymentId: 'deploy-1',
          url: 'https://example.com/campaign',
        }),
      });
      
      expect(response.status).toBe(200);
    });
    
    it('should reject invalid webhook secret', async () => {
      const response = await fetch('/api/webhooks/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'invalid-secret',
        },
        body: JSON.stringify({
          event: 'deployment.completed',
        }),
      });
      
      expect(response.status).toBe(401);
    });
  });
});

describe('Deployment Preview', () => {
  describe('GET /api/campaigns/[id]/preview', () => {
    it('should generate preview URL', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1/preview');
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.previewUrl).toBeDefined();
      expect(data.expiresAt).toBeDefined();
    });
  });
  
  describe('GET /api/preview/[token]', () => {
    it('should render preview page', async () => {
      const response = await fetch('/api/preview/test-token');
      
      expect(response.status).toBe(200);
    });
    
    it('should reject expired tokens', async () => {
      const response = await fetch('/api/preview/expired-token');
      
      expect(response.status).toBe(410);
    });
  });
});

describe('Multi-Channel Deployment', () => {
  it('should deploy to multiple channels', async () => {
    const response = await fetch('/api/campaigns/test-campaign-1/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: ['web', 'email', 'social'],
      }),
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.deployments).toBeDefined();
    expect(data.deployments.length).toBe(3);
  });
  
  it('should handle partial deployment failures', async () => {
    const response = await fetch('/api/campaigns/test-campaign-1/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: ['web', 'invalid-channel'],
      }),
    });
    
    expect(response.status).toBe(207); // Multi-status
    const data = await response.json();
    expect(data.results.some((r: any) => r.status === 'success')).toBe(true);
    expect(data.results.some((r: any) => r.status === 'failed')).toBe(true);
  });
});
