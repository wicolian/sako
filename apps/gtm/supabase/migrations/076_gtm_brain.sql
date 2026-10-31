-- ============================================================================
-- 076: GTM Brain Foundation
-- ============================================================================
-- Adds canonical source, sync, fact, legal rule, and snapshot tables for the
-- Composer GTM Brain. Also extends campaigns and asset_documents so generation
-- runs can bind to a stable approved snapshot with source provenance.
-- ============================================================================

CREATE TABLE IF NOT EXISTS brain_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (
    source_type IN ('url', 'webflow', 'framer', 'notion', 'github', 'file_upload', 'manual')
  ),
  connection_ref text,
  external_id text,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'connected', 'syncing', 'ready', 'review_required', 'error', 'disabled')
  ),
  last_synced_at timestamptz,
  last_snapshot_id uuid,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brain_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_source_id uuid NOT NULL REFERENCES brain_sources(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'running', 'completed', 'review_required', 'failed')
  ),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  changes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_text text,
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  fact_key text NOT NULL,
  statement text NOT NULL,
  category text NOT NULL DEFAULT 'generic',
  source_id uuid REFERENCES brain_sources(id) ON DELETE SET NULL,
  confidence numeric(4,3) NOT NULL DEFAULT 0.5,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'active', 'review_required', 'conflicted', 'archived')
  ),
  claimable boolean NOT NULL DEFAULT false,
  effective_region text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  rule_text text NOT NULL,
  severity text NOT NULL DEFAULT 'warn' CHECK (
    severity IN ('info', 'warn', 'block')
  ),
  applies_to_channels text[] NOT NULL DEFAULT '{}'::text[],
  applies_to_regions text[] NOT NULL DEFAULT '{}'::text[],
  required_disclaimer text,
  source_id uuid REFERENCES brain_sources(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'active', 'review_required', 'archived')
  ),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brain_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'approved', 'superseded', 'archived')
  ),
  source_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority_rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE brain_sources
  ADD CONSTRAINT brain_sources_last_snapshot_fk
  FOREIGN KEY (last_snapshot_id) REFERENCES brain_snapshots(id) ON DELETE SET NULL;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS brain_snapshot_id uuid REFERENCES brain_snapshots(id) ON DELETE SET NULL;

ALTER TABLE asset_documents
  ADD COLUMN IF NOT EXISTS brain_snapshot_id uuid REFERENCES brain_snapshots(id) ON DELETE SET NULL;

ALTER TABLE asset_documents
  ADD COLUMN IF NOT EXISTS provenance_json jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_brain_sources_workspace ON brain_sources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brain_sources_brand ON brain_sources(brand_id);
CREATE INDEX IF NOT EXISTS idx_brain_sources_type ON brain_sources(workspace_id, source_type);

CREATE INDEX IF NOT EXISTS idx_brain_sync_runs_source ON brain_sync_runs(brain_source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_sync_runs_workspace ON brain_sync_runs(workspace_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_facts_workspace ON product_facts(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_product_facts_brand ON product_facts(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_product_facts_source ON product_facts(source_id);
CREATE INDEX IF NOT EXISTS idx_product_facts_fact_key ON product_facts(workspace_id, fact_key);

CREATE INDEX IF NOT EXISTS idx_legal_rules_workspace ON legal_rules(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_legal_rules_brand ON legal_rules(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_legal_rules_source ON legal_rules(source_id);

CREATE INDEX IF NOT EXISTS idx_brain_snapshots_workspace ON brain_snapshots(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_snapshots_brand_status ON brain_snapshots(brand_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaigns_brain_snapshot ON campaigns(brain_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_asset_documents_brain_snapshot ON asset_documents(brain_snapshot_id);

ALTER TABLE brain_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view brain sources in their workspace"
  ON brain_sources FOR SELECT
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert brain sources in their workspace"
  ON brain_sources FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can update brain sources in their workspace"
  ON brain_sources FOR UPDATE
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can view brain sync runs in their workspace"
  ON brain_sync_runs FOR SELECT
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert brain sync runs in their workspace"
  ON brain_sync_runs FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can update brain sync runs in their workspace"
  ON brain_sync_runs FOR UPDATE
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can view product facts in their workspace"
  ON product_facts FOR SELECT
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert product facts in their workspace"
  ON product_facts FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can update product facts in their workspace"
  ON product_facts FOR UPDATE
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can view legal rules in their workspace"
  ON legal_rules FOR SELECT
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert legal rules in their workspace"
  ON legal_rules FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can update legal rules in their workspace"
  ON legal_rules FOR UPDATE
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can view brain snapshots in their workspace"
  ON brain_snapshots FOR SELECT
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert brain snapshots in their workspace"
  ON brain_snapshots FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can update brain snapshots in their workspace"
  ON brain_snapshots FOR UPDATE
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE TRIGGER trg_brain_sources_updated_at
  BEFORE UPDATE ON brain_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_documents_updated_at();

CREATE TRIGGER trg_product_facts_updated_at
  BEFORE UPDATE ON product_facts
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_documents_updated_at();

CREATE TRIGGER trg_legal_rules_updated_at
  BEFORE UPDATE ON legal_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_documents_updated_at();
