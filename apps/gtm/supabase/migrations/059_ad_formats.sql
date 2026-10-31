-- Ad Formats Migration
-- Platform-specific ad format configurations and saved ads

-- Ad format configurations
CREATE TABLE IF NOT EXISTS ad_format_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'instagram', 'facebook', 'tiktok', 'google', 'linkedin'
  format TEXT NOT NULL, -- 'story', 'reels', 'feed', 'carousel', 'video'
  name TEXT NOT NULL,
  dimensions JSONB NOT NULL, -- {width, height}
  aspect_ratio TEXT, -- '9:16', '1:1', '4:5', '16:9'
  duration_range JSONB, -- {min, max} in seconds
  file_types TEXT[] DEFAULT '{}', -- ['jpg', 'png', 'mp4']
  max_file_size_mb INTEGER,
  text_limits JSONB DEFAULT '{}', -- {headline: 25, description: 90, etc}
  best_practices TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint on workspace + platform + format
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_format_configs_unique 
  ON ad_format_configs(workspace_id, platform, format);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ad_format_configs_workspace ON ad_format_configs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ad_format_configs_platform ON ad_format_configs(platform);

-- Saved ad creatives
CREATE TABLE IF NOT EXISTS saved_ad_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  format TEXT NOT NULL,
  variant_label TEXT DEFAULT 'A',
  primary_text TEXT,
  headline TEXT,
  description TEXT,
  call_to_action TEXT,
  media_urls TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  slides JSONB, -- For story/carousel
  script JSONB, -- For video/reels
  hashtags TEXT[] DEFAULT '{}',
  claims TEXT[] DEFAULT '{}', -- Associated claim IDs
  archetype TEXT,
  dimensions JSONB,
  duration INTEGER, -- In seconds
  ai_generated BOOLEAN DEFAULT true,
  generation_metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft', -- 'draft', 'approved', 'published', 'archived'
  performance_metrics JSONB DEFAULT '{}', -- Impressions, clicks, etc.
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_ad_creatives_workspace ON saved_ad_creatives(workspace_id);
CREATE INDEX IF NOT EXISTS idx_saved_ad_creatives_campaign ON saved_ad_creatives(campaign_id);
CREATE INDEX IF NOT EXISTS idx_saved_ad_creatives_platform ON saved_ad_creatives(platform);
CREATE INDEX IF NOT EXISTS idx_saved_ad_creatives_format ON saved_ad_creatives(format);
CREATE INDEX IF NOT EXISTS idx_saved_ad_creatives_status ON saved_ad_creatives(status);
CREATE INDEX IF NOT EXISTS idx_saved_ad_creatives_created_by ON saved_ad_creatives(created_by);

-- Full text search
CREATE INDEX IF NOT EXISTS idx_saved_ad_creatives_search ON saved_ad_creatives
  USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(headline, '') || ' ' || coalesce(primary_text, '')));

-- Ad creative versions (for A/B testing)
CREATE TABLE IF NOT EXISTS ad_creative_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id UUID NOT NULL REFERENCES saved_ad_creatives(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  changes JSONB NOT NULL, -- What changed from previous version
  snapshot JSONB NOT NULL, -- Full creative data at this version
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_creative_versions_creative ON ad_creative_versions(creative_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_creative_versions_unique ON ad_creative_versions(creative_id, version_number);

-- Ad A/B tests
CREATE TABLE IF NOT EXISTS ad_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variant_a_id UUID NOT NULL REFERENCES saved_ad_creatives(id) ON DELETE CASCADE,
  variant_b_id UUID NOT NULL REFERENCES saved_ad_creatives(id) ON DELETE CASCADE,
  test_metric TEXT DEFAULT 'ctr', -- 'ctr', 'conversions', 'engagement'
  budget_cents INTEGER,
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed'
  winner_id UUID REFERENCES saved_ad_creatives(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  results JSONB DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_ab_tests_workspace ON ad_ab_tests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ad_ab_tests_status ON ad_ab_tests(status);

-- RLS Policies
ALTER TABLE ad_format_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_ad_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_creative_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_ab_tests ENABLE ROW LEVEL SECURITY;

-- Ad format configs: Workspace access
CREATE POLICY "Users can view ad format configs" ON ad_format_configs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage ad format configs" ON ad_format_configs
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Saved ad creatives: Workspace access
CREATE POLICY "Users can view ad creatives in workspace" ON saved_ad_creatives
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create ad creatives" ON saved_ad_creatives
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update ad creatives in workspace" ON saved_ad_creatives
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their ad creatives" ON saved_ad_creatives
  FOR DELETE USING (created_by = auth.uid());

-- Ad creative versions: View for own creatives
CREATE POLICY "Users can view ad creative versions" ON ad_creative_versions
  FOR SELECT USING (
    creative_id IN (
      SELECT id FROM saved_ad_creatives WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "System can create versions" ON ad_creative_versions
  FOR INSERT WITH CHECK (true);

-- Ad A/B tests: Workspace access
CREATE POLICY "Users can view ad ab tests" ON ad_ab_tests
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage ad ab tests" ON ad_ab_tests
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_ad_format_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ad_format_configs_updated_at
  BEFORE UPDATE ON ad_format_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_format_configs_updated_at();

CREATE OR REPLACE FUNCTION update_saved_ad_creatives_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saved_ad_creatives_updated_at
  BEFORE UPDATE ON saved_ad_creatives
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_ad_creatives_updated_at();

-- Function to create version on update
CREATE OR REPLACE FUNCTION create_ad_creative_version()
RETURNS TRIGGER AS $$
DECLARE
  v_version_number INTEGER;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
  FROM ad_creative_versions WHERE creative_id = NEW.id;
  
  -- Create version record
  INSERT INTO ad_creative_versions (creative_id, version_number, changes, snapshot, created_by)
  VALUES (
    NEW.id,
    v_version_number,
    jsonb_build_object(
      'changed_at', now(),
      'changed_fields', (
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(to_jsonb(NEW))
        WHERE key NOT IN ('id', 'created_at', 'updated_at', 'created_by', 'workspace_id')
        AND to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key
      )
    ),
    to_jsonb(NEW),
    NEW.created_by
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create versions for significant changes (not just updated_at)
CREATE TRIGGER ad_creative_version_trigger
  AFTER UPDATE ON saved_ad_creatives
  FOR EACH ROW
  WHEN (
    OLD.primary_text IS DISTINCT FROM NEW.primary_text OR
    OLD.headline IS DISTINCT FROM NEW.headline OR
    OLD.description IS DISTINCT FROM NEW.description OR
    OLD.media_urls IS DISTINCT FROM NEW.media_urls OR
    OLD.slides IS DISTINCT FROM NEW.slides OR
    OLD.script IS DISTINCT FROM NEW.script
  )
  EXECUTE FUNCTION create_ad_creative_version();

-- Insert default format configurations
INSERT INTO ad_format_configs (workspace_id, platform, format, name, dimensions, aspect_ratio, duration_range, file_types, max_file_size_mb, text_limits, best_practices)
SELECT 
  w.id,
  'instagram',
  'story',
  'Instagram Story',
  '{"width": 1080, "height": 1920}'::jsonb,
  '9:16',
  '{"min": 1, "max": 15}'::jsonb,
  ARRAY['jpg', 'png', 'mp4'],
  30,
  '{"headline": 40, "primary_text": 125}'::jsonb,
  ARRAY['Use full vertical space', 'Keep text in safe zones', 'Add clear CTA']
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM ad_format_configs WHERE workspace_id = w.id AND platform = 'instagram' AND format = 'story')
ON CONFLICT DO NOTHING;

INSERT INTO ad_format_configs (workspace_id, platform, format, name, dimensions, aspect_ratio, duration_range, file_types, max_file_size_mb, text_limits, best_practices)
SELECT 
  w.id,
  'facebook',
  'feed',
  'Facebook Feed',
  '{"width": 1080, "height": 1350}'::jsonb,
  '4:5',
  '{"min": 1, "max": 240}'::jsonb,
  ARRAY['jpg', 'png', 'mp4'],
  4000,
  '{"headline": 25, "primary_text": 125, "description": 30}'::jsonb,
  ARRAY['Use high-quality images', 'Include social proof', 'Test multiple headlines']
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM ad_format_configs WHERE workspace_id = w.id AND platform = 'facebook' AND format = 'feed')
ON CONFLICT DO NOTHING;

INSERT INTO ad_format_configs (workspace_id, platform, format, name, dimensions, aspect_ratio, duration_range, file_types, max_file_size_mb, text_limits, best_practices)
SELECT 
  w.id,
  'tiktok',
  'video',
  'TikTok Video',
  '{"width": 1080, "height": 1920}'::jsonb,
  '9:16',
  '{"min": 5, "max": 60}'::jsonb,
  ARRAY['mp4', 'mov'],
  500,
  '{"caption": 150}'::jsonb,
  ARRAY['Hook in first 3 seconds', 'Use trending sounds', 'Keep it authentic']
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM ad_format_configs WHERE workspace_id = w.id AND platform = 'tiktok' AND format = 'video')
ON CONFLICT DO NOTHING;
