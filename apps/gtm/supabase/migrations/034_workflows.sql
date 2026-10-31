-- ============================================================================
-- Visual Workflows (Phase 4.1)
-- Drag-drop workflow builder with execution tracking
-- ============================================================================

CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Workflow identity
  name TEXT NOT NULL,
  description TEXT,
  
  -- Visual representation (React Flow format)
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  viewport JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}',
  
  -- Compiled execution graph
  compiled_graph JSONB, -- LangGraph-compatible definition
  compiled_at TIMESTAMPTZ,
  compilation_errors TEXT[],
  
  -- Configuration
  trigger_type TEXT DEFAULT 'manual', -- 'manual', 'schedule', 'webhook', 'campaign_created', 'claim_flagged'
  trigger_config JSONB DEFAULT '{}', -- Trigger-specific settings
  
  -- Execution settings
  timeout_seconds INT DEFAULT 300,
  retry_config JSONB DEFAULT '{"max_attempts": 3, "backoff_multiplier": 2}',
  concurrency_limit INT DEFAULT 5,
  
  -- Status
  is_active BOOLEAN DEFAULT FALSE,
  is_template BOOLEAN DEFAULT FALSE, -- Can be used as starting point
  
  -- Version control
  version INT DEFAULT 1,
  
  -- Stats
  run_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  avg_duration_ms INT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  last_run_at TIMESTAMPTZ
);

CREATE INDEX idx_workflows_workspace ON workflows(workspace_id);
CREATE INDEX idx_workflows_active ON workflows(workspace_id) WHERE is_active = TRUE;
CREATE INDEX idx_workflows_trigger ON workflows(trigger_type) WHERE is_active = TRUE;
CREATE INDEX idx_workflows_templates ON workflows(is_template) WHERE is_template = TRUE;

-- Workflow execution runs
CREATE TABLE workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Trigger context
  trigger_type TEXT NOT NULL,
  trigger_data JSONB DEFAULT '{}', -- Input data that triggered the run
  
  -- Execution state
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
  current_node_id TEXT, -- Which node is currently executing
  
  -- Progress tracking
  nodes_completed TEXT[] DEFAULT '{}',
  nodes_failed TEXT[] DEFAULT '{}',
  execution_path TEXT[] DEFAULT '{}', -- Order of node execution
  
  -- State management
  state JSONB DEFAULT '{}', -- Accumulated state from node executions
  
  -- HITL pause state
  paused_at_node TEXT,
  paused_reason TEXT,
  paused_at TIMESTAMPTZ,
  resumed_by UUID REFERENCES auth.users(id),
  resumed_at TIMESTAMPTZ,
  
  -- Error tracking
  error_message TEXT,
  error_node_id TEXT,
  error_details JSONB,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  
  -- Metadata
  initiated_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_workspace ON workflow_runs(workspace_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX idx_workflow_runs_active ON workflow_runs(workflow_id, status) WHERE status IN ('running', 'paused');

-- Individual node executions
CREATE TABLE workflow_node_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL, -- ID from the nodes JSONB
  
  -- Node info
  node_type TEXT NOT NULL, -- 'trigger', 'ai_generate', 'validate', 'condition', 'approval', 'action', 'delay'
  node_label TEXT,
  
  -- Execution
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'skipped'
  
  -- Input/Output
  input_data JSONB,
  output_data JSONB,
  
  -- Error tracking
  error_message TEXT,
  retry_count INT DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INT
);

CREATE INDEX idx_workflow_node_executions_run ON workflow_node_executions(run_id);
CREATE INDEX idx_workflow_node_executions_status ON workflow_node_executions(run_id, status);

-- Workflow templates (pre-built workflows)
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template info
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'campaign_automation', 'compliance', 'content_generation', 'integration'
  
  -- Template content
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  
  -- Visual
  thumbnail_url TEXT,
  
  -- Metadata
  is_official BOOLEAN DEFAULT FALSE,
  usage_count INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_templates_category ON workflow_templates(category);

-- Function to update workflow stats
CREATE OR REPLACE FUNCTION update_workflow_run_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
    UPDATE workflows
    SET 
      run_count = run_count + 1,
      success_count = success_count + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
      failure_count = failure_count + CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
      last_run_at = NEW.completed_at,
      avg_duration_ms = CASE 
        WHEN avg_duration_ms IS NULL THEN NEW.duration_ms
        ELSE (avg_duration_ms + NEW.duration_ms) / 2
      END
    WHERE id = NEW.workflow_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_run_stats_update
  AFTER UPDATE ON workflow_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_run_stats();

-- Triggers
CREATE OR REPLACE FUNCTION update_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_workflows_updated_at();

-- RLS Policies
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflows in their workspace"
  ON workflows FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create workflows in their workspace"
  ON workflows FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update workflows in their workspace"
  ON workflows FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete workflows in their workspace"
  ON workflows FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view runs in their workspace"
  ON workflow_runs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create runs in their workspace"
  ON workflow_runs FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update runs in their workspace"
  ON workflow_runs FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE workflow_node_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view node executions for their runs"
  ON workflow_node_executions FOR SELECT
  USING (
    run_id IN (
      SELECT id FROM workflow_runs WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view workflow templates"
  ON workflow_templates FOR SELECT
  USING (TRUE);
