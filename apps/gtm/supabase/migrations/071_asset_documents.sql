-- ============================================================================
-- 071: Unified Asset Document Model (UADM)
-- ============================================================================
-- Canonical schema for all asset types: landing, social, email, deck, ad.
-- Every generator writes to this table. Every editor reads from it.
-- ============================================================================

-- Asset Documents — unified store for all generated/edited assets
CREATE TABLE IF NOT EXISTS asset_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Type classification
  asset_type text NOT NULL CHECK (asset_type IN ('landing', 'social', 'email', 'deck', 'ad')),
  channel text CHECK (channel IN ('linkedin', 'instagram', 'twitter', 'facebook', 'meta', 'google')),

  -- Content — HTML is source of truth
  html text NOT NULL DEFAULT '',
  blocks_json jsonb DEFAULT '[]'::jsonb,
  design_tokens jsonb DEFAULT '{}'::jsonb,

  -- Compliance
  claims_json jsonb DEFAULT '[]'::jsonb,
  evidence_json jsonb DEFAULT '[]'::jsonb,
  compliance_status text DEFAULT 'clean' CHECK (compliance_status IN ('clean', 'warning', 'blocked')),

  -- Rendering
  dimensions jsonb,
  rendered_image_url text,
  render_variants jsonb DEFAULT '[]'::jsonb,

  -- Versioning
  revision integer DEFAULT 1,
  parent_revision_id uuid REFERENCES asset_documents(id) ON DELETE SET NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published')),

  -- Metadata
  title text,
  description text,
  skeleton_id text,
  generation_key text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_asset_documents_workspace ON asset_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_asset_documents_campaign ON asset_documents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_asset_documents_brand ON asset_documents(brand_id);
CREATE INDEX IF NOT EXISTS idx_asset_documents_type ON asset_documents(workspace_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_asset_documents_status ON asset_documents(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_asset_documents_compliance ON asset_documents(compliance_status)
  WHERE compliance_status != 'clean';
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_documents_generation_key
  ON asset_documents(workspace_id, campaign_id, asset_type, generation_key)
  WHERE generation_key IS NOT NULL;

-- RLS
ALTER TABLE asset_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assets in their workspace"
  ON asset_documents FOR SELECT
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert assets in their workspace"
  ON asset_documents FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can update assets in their workspace"
  ON asset_documents FOR UPDATE
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete assets in their workspace"
  ON asset_documents FOR DELETE
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

-- ============================================================================
-- Asset Renders — track all rendered outputs (PNG/JPG/PDF/etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_renders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_document_id uuid NOT NULL REFERENCES asset_documents(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('png', 'jpg', 'pdf', 'html', 'pptx')),
  width integer,
  height integer,
  storage_url text NOT NULL,
  storage_provider text DEFAULT 'supabase' CHECK (storage_provider IN ('supabase', 'r2')),
  file_size integer,
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  provider_artifact_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_renders_document ON asset_renders(asset_document_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_renders_unique
  ON asset_renders(asset_document_id, format, width, height)
  WHERE status = 'completed';

ALTER TABLE asset_renders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view renders in their workspace"
  ON asset_renders FOR SELECT
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert renders in their workspace"
  ON asset_renders FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

-- ============================================================================
-- Design Quality Events — learning loop for training data collection
-- ============================================================================

CREATE TABLE IF NOT EXISTS design_quality_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  asset_document_id uuid REFERENCES asset_documents(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('generated', 'accepted', 'edited', 'rejected', 'exported')),
  original_html text,
  edited_html text,
  edit_diff jsonb,
  quality_score numeric(3,2),
  skeleton_id text,
  template_ids text[],
  issues_json jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_quality_workspace ON design_quality_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_design_quality_asset ON design_quality_events(asset_document_id);
CREATE INDEX IF NOT EXISTS idx_design_quality_type ON design_quality_events(event_type);

ALTER TABLE design_quality_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quality events in their workspace"
  ON design_quality_events FOR SELECT
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert quality events in their workspace"
  ON design_quality_events FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

-- ============================================================================
-- updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_asset_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asset_documents_updated_at
  BEFORE UPDATE ON asset_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_documents_updated_at();
