-- ============================================================================
-- Campaign Version Control (Phase 6.1)
-- Full version history with diff view and rollback capability
-- ============================================================================

CREATE TABLE campaign_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Version identification
  version_number INT NOT NULL,
  version_tag TEXT, -- Optional tag like 'v1.0-release', 'pre-launch'
  
  -- Full state snapshot
  snapshot JSONB NOT NULL, -- Complete campaign state at this version
  
  -- Change tracking
  diff_from_previous JSONB, -- What changed from previous version
  changes_summary TEXT, -- AI-generated or user-provided summary
  change_type TEXT, -- 'content', 'structure', 'settings', 'major', 'minor'
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  description TEXT,
  is_published BOOLEAN DEFAULT FALSE, -- Was this version published?
  is_current BOOLEAN DEFAULT FALSE, -- Is this the current version?
  
  -- Restoration
  restored_from_version INT, -- If this was restored from another version
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure version numbers are unique per campaign and sequential
CREATE UNIQUE INDEX idx_campaign_versions_unique ON campaign_versions(campaign_id, version_number);

-- Only one current version per campaign
CREATE UNIQUE INDEX idx_campaign_versions_current 
  ON campaign_versions(campaign_id) 
  WHERE is_current = TRUE;

-- Indexes
CREATE INDEX idx_campaign_versions_campaign ON campaign_versions(campaign_id);
CREATE INDEX idx_campaign_versions_workspace ON campaign_versions(workspace_id);
CREATE INDEX idx_campaign_versions_created ON campaign_versions(campaign_id, created_at DESC);

-- Add version tracking to campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS current_version INT DEFAULT 1;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS version_count INT DEFAULT 1;

-- Function to create a new version
CREATE OR REPLACE FUNCTION create_campaign_version(
  p_campaign_id UUID,
  p_description TEXT DEFAULT NULL,
  p_change_type TEXT DEFAULT 'content'
)
RETURNS UUID AS $$
DECLARE
  v_campaign RECORD;
  v_new_version_number INT;
  v_new_version_id UUID;
  v_prev_snapshot JSONB;
BEGIN
  -- Get campaign
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found: %', p_campaign_id;
  END IF;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_new_version_number
  FROM campaign_versions
  WHERE campaign_id = p_campaign_id;
  
  -- Get previous snapshot for diff
  SELECT snapshot INTO v_prev_snapshot
  FROM campaign_versions
  WHERE campaign_id = p_campaign_id AND is_current = TRUE;
  
  -- Unset current flag on previous version
  UPDATE campaign_versions
  SET is_current = FALSE
  WHERE campaign_id = p_campaign_id AND is_current = TRUE;
  
  -- Create new version
  INSERT INTO campaign_versions (
    campaign_id,
    workspace_id,
    version_number,
    snapshot,
    diff_from_previous,
    description,
    change_type,
    is_current,
    created_by
  )
  VALUES (
    p_campaign_id,
    v_campaign.workspace_id,
    v_new_version_number,
    to_jsonb(v_campaign),
    NULL, -- Diff calculation can be done async
    p_description,
    p_change_type,
    TRUE,
    auth.uid()
  )
  RETURNING id INTO v_new_version_id;
  
  -- Update campaign version info
  UPDATE campaigns
  SET current_version = v_new_version_number,
      version_count = v_new_version_number
  WHERE id = p_campaign_id;
  
  RETURN v_new_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore a version
CREATE OR REPLACE FUNCTION restore_campaign_version(
  p_campaign_id UUID,
  p_version_number INT
)
RETURNS UUID AS $$
DECLARE
  v_version RECORD;
  v_restored_id UUID;
BEGIN
  -- Get version to restore
  SELECT * INTO v_version
  FROM campaign_versions
  WHERE campaign_id = p_campaign_id AND version_number = p_version_number;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version % not found for campaign %', p_version_number, p_campaign_id;
  END IF;
  
  -- Update campaign with snapshot data
  UPDATE campaigns
  SET 
    name = (v_version.snapshot->>'name'),
    audience = (v_version.snapshot->>'audience'),
    goal = (v_version.snapshot->>'goal'),
    offer = (v_version.snapshot->>'offer'),
    cta = (v_version.snapshot->>'cta'),
    status = 'draft', -- Reset to draft when restoring
    updated_at = NOW()
  WHERE id = p_campaign_id;
  
  -- Create new version to record the restoration
  SELECT create_campaign_version(
    p_campaign_id,
    format('Restored from version %s', p_version_number),
    'major'
  ) INTO v_restored_id;
  
  -- Mark restoration source
  UPDATE campaign_versions
  SET restored_from_version = p_version_number
  WHERE id = v_restored_id;
  
  RETURN v_restored_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE campaign_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions in their workspace"
  ON campaign_versions FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create versions in their workspace"
  ON campaign_versions FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );
