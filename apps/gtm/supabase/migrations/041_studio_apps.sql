-- ============================================================================
-- Studio Apps (No-Code AI App Builder)
-- Jasper Studio equivalent with enhanced capabilities
-- ============================================================================

-- Studio apps table
CREATE TABLE IF NOT EXISTS studio_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- App identity
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🤖', -- emoji or icon identifier
  category TEXT DEFAULT 'custom', -- 'content', 'email', 'social', 'ads', 'custom'
  
  -- Builder configuration
  inputs JSONB DEFAULT '[]', -- Array of AppInput definitions
  instructions TEXT NOT NULL, -- Dynamic instructions with {{placeholders}}
  example_output TEXT, -- Example of expected output format
  
  -- AI configuration
  model TEXT NOT NULL DEFAULT 'openai/gpt-5.2-chat',
  temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 1),
  max_tokens INTEGER,
  
  -- Context attachments (Knowledge Base item IDs)
  knowledge_items UUID[] DEFAULT '{}',
  
  -- Default context
  default_brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  default_audience_id UUID REFERENCES audiences(id) ON DELETE SET NULL,
  
  -- Publishing
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'workspace', 'public')),
  published_at TIMESTAMPTZ,
  
  -- Usage stats
  run_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  
  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_studio_apps_workspace ON studio_apps(workspace_id);
CREATE INDEX idx_studio_apps_visibility ON studio_apps(workspace_id, visibility);
CREATE INDEX idx_studio_apps_category ON studio_apps(workspace_id, category);
CREATE INDEX idx_studio_apps_creator ON studio_apps(created_by);

-- Studio app runs (execution history)
CREATE TABLE IF NOT EXISTS studio_app_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES studio_apps(id) ON DELETE CASCADE,
  
  -- Executor
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Execution details
  inputs JSONB NOT NULL, -- Input values provided
  output TEXT, -- Generated output
  
  -- AI details
  model TEXT NOT NULL,
  tokens_used INTEGER,
  latency_ms INTEGER,
  
  -- Context used
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  audience_id UUID REFERENCES audiences(id) ON DELETE SET NULL,
  knowledge_items UUID[] DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_studio_app_runs_app ON studio_app_runs(app_id);
CREATE INDEX idx_studio_app_runs_user ON studio_app_runs(user_id);
CREATE INDEX idx_studio_app_runs_created ON studio_app_runs(app_id, created_at DESC);

-- Studio app favorites (for quick access)
CREATE TABLE IF NOT EXISTS studio_app_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES studio_apps(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, app_id)
);

CREATE INDEX idx_studio_favorites_user ON studio_app_favorites(user_id);

-- Function to increment run count
CREATE OR REPLACE FUNCTION increment_app_run_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE studio_apps 
  SET run_count = run_count + 1, last_run_at = NOW()
  WHERE id = NEW.app_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER studio_app_run_created
  AFTER INSERT ON studio_app_runs
  FOR EACH ROW
  EXECUTE FUNCTION increment_app_run_count();

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_studio_apps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER studio_apps_updated_at
  BEFORE UPDATE ON studio_apps
  FOR EACH ROW
  EXECUTE FUNCTION update_studio_apps_updated_at();

-- RLS Policies
ALTER TABLE studio_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own apps"
  ON studio_apps FOR SELECT
  USING (
    created_by = auth.uid()
    OR (visibility = 'workspace' AND workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ))
    OR visibility = 'public'
  );

CREATE POLICY "Users can create apps in their workspace"
  ON studio_apps FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own apps"
  ON studio_apps FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own apps"
  ON studio_apps FOR DELETE
  USING (created_by = auth.uid());

ALTER TABLE studio_app_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view runs for accessible apps"
  ON studio_app_runs FOR SELECT
  USING (
    app_id IN (
      SELECT id FROM studio_apps WHERE 
        created_by = auth.uid()
        OR (visibility = 'workspace' AND workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        ))
    )
  );

CREATE POLICY "Users can create runs for accessible apps"
  ON studio_app_runs FOR INSERT
  WITH CHECK (
    app_id IN (
      SELECT id FROM studio_apps WHERE 
        created_by = auth.uid()
        OR (visibility = 'workspace' AND workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        ))
        OR visibility = 'public'
    )
  );

ALTER TABLE studio_app_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their favorites"
  ON studio_app_favorites FOR ALL
  USING (user_id = auth.uid());
