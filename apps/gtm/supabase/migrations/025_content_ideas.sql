-- ============================================================================
-- Content Ideas for Swipe Discovery UI (Phase 1.1)
-- Supports Holo-style "Tinder for content" discovery experience
-- ============================================================================

CREATE TABLE content_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  
  -- Core idea content
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL DEFAULT 'ad', -- 'ad', 'email', 'social', 'landing_page', 'video'
  framework TEXT, -- 'mythbuster', 'before_after', 'us_vs_them', etc.
  
  -- Structured content for generation
  angle_data JSONB DEFAULT '{}',
  hook TEXT, -- Opening hook line
  target_pain_point TEXT,
  emotional_trigger TEXT,
  suggested_cta TEXT,
  
  -- Preview/mockup data
  preview_html TEXT,
  preview_image_url TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'pending', -- 'pending', 'saved', 'skipped', 'used', 'archived'
  source TEXT DEFAULT 'manual', -- 'manual', 'background', 'campaign', 'ai_suggested'
  
  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_in_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- AI generation context
  generation_model TEXT,
  generation_prompt TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_content_ideas_workspace_status ON content_ideas(workspace_id, status);
CREATE INDEX idx_content_ideas_workspace_type ON content_ideas(workspace_id, content_type);
CREATE INDEX idx_content_ideas_framework ON content_ideas(framework) WHERE framework IS NOT NULL;
CREATE INDEX idx_content_ideas_pending ON content_ideas(workspace_id, generated_at) WHERE status = 'pending';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_content_ideas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_ideas_updated_at
  BEFORE UPDATE ON content_ideas
  FOR EACH ROW
  EXECUTE FUNCTION update_content_ideas_updated_at();

-- RLS Policies
ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view content ideas in their workspace"
  ON content_ideas FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create content ideas in their workspace"
  ON content_ideas FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update content ideas in their workspace"
  ON content_ideas FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete content ideas in their workspace"
  ON content_ideas FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );
