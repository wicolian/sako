-- ============================================================================
-- 074: Automation Playbooks & Scheduled Content
-- ============================================================================
-- Supports "Daily LinkedIn Post + Visual @8AM" and campaign drip sequences.
-- Always requires approval gate — no auto-publish by default.
-- ============================================================================

CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('daily_linkedin', 'weekly_social', 'campaign_drip', 'custom')),
  schedule text NOT NULL, -- cron expression e.g. '0 8 * * *'
  timezone text DEFAULT 'UTC',
  config jsonb DEFAULT '{}'::jsonb,
  -- config: { platforms: [], contentTypes: [], topics: [], approvalRequired: true }
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  last_run_at timestamptz,
  next_run_at timestamptz,
  run_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_workspace ON automation_rules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_status ON automation_rules(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_automation_rules_next_run ON automation_rules(next_run_at) WHERE status = 'active';

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage automation rules in their workspace"
  ON automation_rules FOR ALL
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

-- Scheduled content items produced by automation runs
CREATE TABLE IF NOT EXISTS scheduled_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_rule_id uuid REFERENCES automation_rules(id) ON DELETE SET NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  asset_document_id uuid REFERENCES asset_documents(id) ON DELETE SET NULL,
  scheduled_for timestamptz,
  status text DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'published', 'rejected', 'failed')),
  approved_by uuid,
  approved_at timestamptz,
  published_at timestamptz,
  rejection_reason text,
  metrics_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_content_workspace ON scheduled_content(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_content_rule ON scheduled_content(automation_rule_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_content_status ON scheduled_content(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_content_scheduled ON scheduled_content(scheduled_for)
  WHERE status IN ('pending_review', 'approved');
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_content_idempotent
  ON scheduled_content(automation_rule_id, scheduled_for)
  WHERE automation_rule_id IS NOT NULL;

ALTER TABLE scheduled_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage scheduled content in their workspace"
  ON scheduled_content FOR ALL
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

-- Updated_at trigger
CREATE TRIGGER trg_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_documents_updated_at();
