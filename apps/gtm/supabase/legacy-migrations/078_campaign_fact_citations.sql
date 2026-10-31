-- ============================================================================
-- 078: Campaign Fact Citations + Brain Learning Runs
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_fact_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  fact_id UUID NOT NULL REFERENCES product_facts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, fact_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_fact_citations_workspace
  ON campaign_fact_citations(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_fact_citations_campaign
  ON campaign_fact_citations(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_fact_citations_fact
  ON campaign_fact_citations(fact_id);

CREATE TABLE IF NOT EXISTS brain_learning_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_learning_runs_workspace
  ON brain_learning_runs(workspace_id, created_at DESC);

ALTER TABLE campaign_fact_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_learning_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign fact citations in their workspace"
  ON campaign_fact_citations FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert campaign fact citations"
  ON campaign_fact_citations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view brain learning runs in their workspace"
  ON brain_learning_runs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert brain learning runs"
  ON brain_learning_runs FOR INSERT
  WITH CHECK (true);
