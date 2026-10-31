-- Campaign Assets: Multi-asset generation storage
-- Migration: 010_campaign_assets.sql

CREATE TABLE campaign_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('email_sequence', 'ad_variants', 'sales_one_pager', 'talk_track', 'custom')),
  content JSONB NOT NULL,
  version INT DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'deployed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_assets_campaign ON campaign_assets(campaign_id);
CREATE INDEX idx_campaign_assets_workspace ON campaign_assets(workspace_id);
CREATE INDEX idx_campaign_assets_type ON campaign_assets(asset_type);

ALTER TABLE campaign_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_can_manage_assets" ON campaign_assets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = campaign_assets.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Create trigger to update updated_at
CREATE TRIGGER update_campaign_assets_updated_at
  BEFORE UPDATE ON campaign_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
