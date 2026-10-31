-- Migration: 044_ad_creatives.sql
-- Platform-specific ad creatives storage

CREATE TABLE IF NOT EXISTS ad_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Platform and format
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok')),
  format TEXT NOT NULL CHECK (format IN ('story', 'reels', 'carousel', 'feed', 'video')),
  
  -- Content
  primary_text TEXT,
  headline TEXT,
  description TEXT,
  call_to_action TEXT,
  hook TEXT,
  
  -- Structured content (JSON for complex formats)
  slides JSONB,       -- For story ads
  script JSONB,       -- For video/reels ads
  cards JSONB,        -- For carousel ads
  
  -- Assets
  image_prompts TEXT[],
  dimensions JSONB,   -- {width, height}
  duration INTEGER,   -- seconds for video
  
  -- Metadata
  hashtags TEXT[],
  archetype TEXT,
  variant_label TEXT,
  claims TEXT[],
  
  -- Tracking
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published', 'archived')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS ad_creatives_workspace_idx ON ad_creatives(workspace_id);
CREATE INDEX IF NOT EXISTS ad_creatives_campaign_idx ON ad_creatives(campaign_id);
CREATE INDEX IF NOT EXISTS ad_creatives_platform_idx ON ad_creatives(platform, format);

-- Enable RLS
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view ad creatives in their workspace"
ON ad_creatives FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = ad_creatives.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert ad creatives in their workspace"
ON ad_creatives FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = ad_creatives.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update ad creatives in their workspace"
ON ad_creatives FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = ad_creatives.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete ad creatives in their workspace"
ON ad_creatives FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = ad_creatives.workspace_id
    AND wm.user_id = auth.uid()
  )
);

-- Trigger to update updated_at
CREATE TRIGGER ad_creatives_updated_at
BEFORE UPDATE ON ad_creatives
FOR EACH ROW
EXECUTE FUNCTION update_project_pages_updated_at();
