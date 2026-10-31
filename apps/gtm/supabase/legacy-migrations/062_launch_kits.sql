-- Launch Kits - Complete marketing asset bundles
-- Phase 2 of the Sako Composer execution plan

CREATE TABLE IF NOT EXISTS launch_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  brand_id UUID REFERENCES brands(id),
  
  -- Brief (what was requested)
  brief JSONB NOT NULL,
  
  -- Status tracking
  status TEXT DEFAULT 'generating',
  
  -- Generated assets (JSONB for flexibility)
  assets JSONB DEFAULT '{
    "landingPage": null,
    "ads": [],
    "emails": null,
    "socialPosts": [],
    "deck": null
  }',
  
  -- Compliance summary
  compliance JSONB DEFAULT '{
    "totalClaims": 0,
    "approved": 0,
    "needsReview": 0,
    "blocked": 0,
    "averageRiskScore": 0
  }',
  
  -- Marketing angles used
  angles JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  exported_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('generating', 'review', 'approved', 'exported'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS launch_kits_workspace ON launch_kits(workspace_id);
CREATE INDEX IF NOT EXISTS launch_kits_brand ON launch_kits(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS launch_kits_status ON launch_kits(workspace_id, status);
CREATE INDEX IF NOT EXISTS launch_kits_created ON launch_kits(created_at DESC);

-- RLS Policies
ALTER TABLE launch_kits ENABLE ROW LEVEL SECURITY;

-- Workspace members can view kits
CREATE POLICY launch_kits_select ON launch_kits
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Workspace members can create kits
CREATE POLICY launch_kits_insert ON launch_kits
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Workspace members can update kits
CREATE POLICY launch_kits_update ON launch_kits
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Workspace members can delete kits
CREATE POLICY launch_kits_delete ON launch_kits
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Service role can do anything
CREATE POLICY launch_kits_service ON launch_kits
  FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_launch_kits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER launch_kits_updated_at
  BEFORE UPDATE ON launch_kits
  FOR EACH ROW
  EXECUTE FUNCTION update_launch_kits_updated_at();

-- Comments
COMMENT ON TABLE launch_kits IS 'Complete marketing asset bundles generated from a brief';
COMMENT ON COLUMN launch_kits.brief IS 'The LaunchKitBrief that defined what to generate';
COMMENT ON COLUMN launch_kits.assets IS 'Generated assets: landingPage, ads[], emails, socialPosts[], deck';
COMMENT ON COLUMN launch_kits.compliance IS 'Compliance summary with claim counts and risk score';
