-- AI Traces Table for cost tracking and observability
-- Created: Jan 2026

CREATE TABLE IF NOT EXISTS ai_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID,
  
  -- Operation details
  operation_type TEXT NOT NULL CHECK (operation_type IN ('generate', 'stream', 'embed', 'tool_call')),
  model TEXT NOT NULL,
  
  -- Token usage
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  
  -- Performance
  latency_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  
  -- Additional context
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS ai_traces_workspace_id_idx ON ai_traces(workspace_id);
CREATE INDEX IF NOT EXISTS ai_traces_created_at_idx ON ai_traces(created_at);
CREATE INDEX IF NOT EXISTS ai_traces_model_idx ON ai_traces(model);
CREATE INDEX IF NOT EXISTS ai_traces_operation_type_idx ON ai_traces(operation_type);

-- RLS policies
ALTER TABLE ai_traces ENABLE ROW LEVEL SECURITY;

-- Workspace members can view their workspace traces
CREATE POLICY "Workspace members can view traces"
  ON ai_traces FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships 
      WHERE user_id = auth.uid()
    )
  );

-- System can insert traces
CREATE POLICY "System can insert traces"
  ON ai_traces FOR INSERT
  WITH CHECK (true);

-- Add title column to sako_tasks if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sako_tasks' AND column_name = 'title'
  ) THEN
    ALTER TABLE sako_tasks ADD COLUMN title TEXT;
  END IF;
END $$;
