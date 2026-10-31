-- ============================================================================
-- 075: Automation Runs (manual + scheduled execution records)
-- ============================================================================
-- Provides idempotent run records for playbook execution and troubleshooting.
-- ============================================================================

CREATE TABLE IF NOT EXISTS automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  automation_rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  run_key text NOT NULL,
  triggered_by uuid,
  trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'scheduled')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_workspace ON automation_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_rule ON automation_runs(automation_rule_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_runs_idempotent
  ON automation_runs(workspace_id, automation_rule_id, run_key);

ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage automation runs in their workspace"
  ON automation_runs FOR ALL
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));
