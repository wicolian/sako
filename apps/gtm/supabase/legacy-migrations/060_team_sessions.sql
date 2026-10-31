-- Team Sessions Table for Multi-Agent Team System (Jan 2026)
-- Tracks state of multi-agent team runs for resumability and observability
-- 
-- @see PRD Part 2.8: Database Additions

-- ============================================================================
-- TEAM SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_sessions (
  id text PRIMARY KEY, -- Format: team-uuid
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  input_url text NOT NULL,
  brand_data jsonb,
  agent_states jsonb DEFAULT '{}',
  current_phase text NOT NULL DEFAULT 'import' CHECK (current_phase IN (
    'import',
    'scout',
    'guardian', 
    'review',
    'creator',
    'architect',
    'ops',
    'ready',
    'deployed',
    'error'
  )),
  approval_request_id text REFERENCES approval_requests(id),
  output_data jsonb,
  deployed_to text[] DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  created_by uuid NOT NULL,
  
  -- Metadata for observability
  metadata jsonb DEFAULT '{}'
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Query sessions by workspace
CREATE INDEX IF NOT EXISTS idx_team_sessions_workspace 
  ON team_sessions(workspace_id, started_at DESC);

-- Query sessions by phase
CREATE INDEX IF NOT EXISTS idx_team_sessions_phase 
  ON team_sessions(current_phase);

-- Query sessions needing review
CREATE INDEX IF NOT EXISTS idx_team_sessions_review 
  ON team_sessions(workspace_id) 
  WHERE current_phase = 'review';

-- Query completed sessions
CREATE INDEX IF NOT EXISTS idx_team_sessions_completed 
  ON team_sessions(workspace_id, completed_at DESC) 
  WHERE current_phase IN ('ready', 'deployed');

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE team_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view sessions in their workspace
CREATE POLICY team_sessions_select ON team_sessions
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can insert sessions in their workspace
CREATE POLICY team_sessions_insert ON team_sessions
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can update sessions in their workspace
CREATE POLICY team_sessions_update ON team_sessions
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can delete sessions in their workspace (for cleanup)
CREATE POLICY team_sessions_delete ON team_sessions
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE team_sessions IS 'Tracks multi-agent team orchestration sessions for the AI Marketing Team feature';
COMMENT ON COLUMN team_sessions.current_phase IS 'Current stage in the agent pipeline: import→scout→guardian→review→creator→architect→ops→ready→deployed';
COMMENT ON COLUMN team_sessions.agent_states IS 'JSON object tracking each agent completion status and output summaries';
COMMENT ON COLUMN team_sessions.brand_data IS 'Extracted brand context passed to agents (name, industry, colors, voice, claims)';
COMMENT ON COLUMN team_sessions.output_data IS 'Final campaign output including landing page, emails, social posts, quality signals';
COMMENT ON COLUMN team_sessions.deployed_to IS 'Array of provider names where campaign was deployed';
