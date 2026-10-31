/**
 * Campaign Integration Tests (Jan 2026)
 * 
 * Tests for campaign creation, generation, and management flows.
 */

import '@/tests/setup-fetch'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock Supabase
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: mockCampaign, error: null }),
          order: () => ({
            limit: () => Promise.resolve({ data: [mockCampaign], error: null }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
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
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  }),
}));

// Mock data
const mockCampaign = {
  id: 'test-campaign-1',
  workspace_id: 'test-workspace',
  name: 'Test Campaign',
  goal: 'Lead generation',
  audience: 'Marketing managers',
  offer: '30-day free trial',
  cta: 'Start Free Trial',
  status: 'draft',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockAsset = {
  id: 'test-asset-1',
  campaign_id: 'test-campaign-1',
  workspace_id: 'test-workspace',
  type: 'landing-page',
  format: 'desktop',
  content: { html: '<div>Test</div>' },
  claims_validated: true,
};

describe('Campaign API', () => {
  describe('GET /api/campaigns', () => {
    it('should return list of campaigns', async () => {
      const response = await fetch('/api/campaigns');
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.campaigns).toBeDefined();
      expect(Array.isArray(data.campaigns)).toBe(true);
    });
    
    it('should filter by status', async () => {
      const response = await fetch('/api/campaigns?status=draft');
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.campaigns.every((c: any) => c.status === 'draft')).toBe(true);
    });
  });
  
  describe('POST /api/campaigns', () => {
    it('should create a new campaign', async () => {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Campaign',
          goal: 'Brand awareness',
          audience: 'Developers',
          offer: 'Free ebook',
          cta: 'Download Now',
        }),
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('New Campaign');
    });
    
    it('should require name field', async () => {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: 'Brand awareness',
        }),
      });
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('GET /api/campaigns/[id]', () => {
    it('should return campaign details', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1');
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe('test-campaign-1');
    });
    
    it('should return 404 for non-existent campaign', async () => {
      const response = await fetch('/api/campaigns/non-existent');
      
      expect(response.status).toBe(404);
    });
  });
  
  describe('PATCH /api/campaigns/[id]', () => {
    it('should update campaign', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Campaign',
        }),
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe('Updated Campaign');
    });
  });
  
  describe('DELETE /api/campaigns/[id]', () => {
    it('should delete campaign', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1', {
        method: 'DELETE',
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});

describe('Campaign Generation', () => {
  describe('POST /api/campaigns/[id]/generate', () => {
    it('should start campaign generation', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedAssets: ['landing-page', 'social'],
          validateClaims: true,
          useTemplates: true,
        }),
      });
      
      expect(response.status).toBe(200);
      // SSE response
      expect(response.headers.get('content-type')).toContain('text/event-stream');
    });
  });
});

describe('Campaign Assets', () => {
  describe('GET /api/campaigns/[id]/assets', () => {
    it('should return campaign assets', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1/assets');
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.assets).toBeDefined();
      expect(Array.isArray(data.assets)).toBe(true);
    });
    
    it('should filter by type', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1/assets?type=landing-page');
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.assets.every((a: any) => a.type === 'landing-page')).toBe(true);
    });
  });
  
  describe('POST /api/campaigns/[id]/assets/generate', () => {
    it('should generate specific asset', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1/assets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType: 'social-post',
          formats: ['linkedin', 'twitter'],
        }),
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.asset).toBeDefined();
    });
  });
});

describe('Campaign Health', () => {
  describe('GET /api/campaigns/[id]/health', () => {
    it('should return health score', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1/health');
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.overall).toBeDefined();
      expect(data.grade).toBeDefined();
      expect(data.components).toBeDefined();
    });
  });
  
  describe('POST /api/campaigns/[id]/health', () => {
    it('should refresh health score', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1/health', {
        method: 'POST',
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.refreshed).toBe(true);
    });
  });
});

describe('Campaign Refresh', () => {
  describe('POST /api/campaigns/[id]/refresh', () => {
    it('should start campaign refresh', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshEvidence: true,
          refreshClaims: true,
        }),
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.changes).toBeDefined();
    });
  });
  
  describe('PUT /api/campaigns/[id]/refresh', () => {
    it('should apply approved changes', async () => {
      const response = await fetch('/api/campaigns/test-campaign-1/refresh', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshId: 'test-refresh-1',
          approvedChanges: ['change-1', 'change-2'],
        }),
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});
