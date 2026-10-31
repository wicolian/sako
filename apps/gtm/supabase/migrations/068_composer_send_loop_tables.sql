-- ============================================================================
-- Composer Send Loop Tables
-- Adds composer document/version/send/snapshot primitives for robust task handoff.
-- ============================================================================

-- 1) Composer documents
CREATE TABLE IF NOT EXISTS composer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('landing', 'deck', 'social', 'email', 'other')),
  quality_score NUMERIC(5,2) DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_composer_documents_workspace_campaign
  ON composer_documents(workspace_id, campaign_id)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_composer_documents_workspace ON composer_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_composer_documents_created_at ON composer_documents(created_at DESC);

ALTER TABLE composer_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view composer documents in workspace"
  ON composer_documents FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create composer documents in workspace"
  ON composer_documents FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update composer documents in workspace"
  ON composer_documents FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- 2) Composer document versions
CREATE TABLE IF NOT EXISTS composer_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES composer_documents(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  version_label TEXT,
  source_campaign_version_id UUID REFERENCES campaign_versions(id) ON DELETE SET NULL,
  snapshot_html TEXT,
  snapshot_json JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_composer_document_versions_workspace ON composer_document_versions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_composer_document_versions_document ON composer_document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_composer_document_versions_created_at ON composer_document_versions(created_at DESC);

ALTER TABLE composer_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view composer document versions in workspace"
  ON composer_document_versions FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create composer document versions in workspace"
  ON composer_document_versions FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- 3) Composer sends (idempotent task creation attempts)
CREATE TABLE IF NOT EXISTS composer_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES composer_documents(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES composer_document_versions(id) ON DELETE CASCADE,
  task_id UUID REFERENCES sako_tasks(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_composer_sends_workspace ON composer_sends(workspace_id);
CREATE INDEX IF NOT EXISTS idx_composer_sends_document ON composer_sends(document_id);
CREATE INDEX IF NOT EXISTS idx_composer_sends_task ON composer_sends(task_id);
CREATE INDEX IF NOT EXISTS idx_composer_sends_created_at ON composer_sends(created_at DESC);

ALTER TABLE composer_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view composer sends in workspace"
  ON composer_sends FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create composer sends in workspace"
  ON composer_sends FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update composer sends in workspace"
  ON composer_sends FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- 4) Frozen task snapshots tied to a task
CREATE TABLE IF NOT EXISTS task_composer_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES sako_tasks(id) ON DELETE CASCADE,
  document_id UUID REFERENCES composer_documents(id) ON DELETE SET NULL,
  version_id UUID REFERENCES composer_document_versions(id) ON DELETE SET NULL,
  html_content TEXT,
  json_content JSONB NOT NULL DEFAULT '{}',
  preview_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_composer_snapshots_workspace ON task_composer_snapshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_task_composer_snapshots_document ON task_composer_snapshots(document_id);
CREATE INDEX IF NOT EXISTS idx_task_composer_snapshots_task ON task_composer_snapshots(task_id);
CREATE INDEX IF NOT EXISTS idx_task_composer_snapshots_created_at ON task_composer_snapshots(created_at DESC);

ALTER TABLE task_composer_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view task composer snapshots in workspace"
  ON task_composer_snapshots FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create task composer snapshots in workspace"
  ON task_composer_snapshots FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- 5) Permission grants
GRANT SELECT, INSERT, UPDATE ON composer_documents TO authenticated;
GRANT SELECT, INSERT ON composer_document_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON composer_sends TO authenticated;
GRANT SELECT, INSERT ON task_composer_snapshots TO authenticated;
