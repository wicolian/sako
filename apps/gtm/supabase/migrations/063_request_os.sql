-- Request OS - Team request workflow system
-- Phase 4 of the Sako Composer execution plan

CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  
  -- Requester and assignee
  requester_id UUID REFERENCES auth.users(id) NOT NULL,
  assignee_id UUID REFERENCES auth.users(id),
  
  -- Request details
  asset_type TEXT NOT NULL, -- landing_page, ads, emails, deck, social, other
  title TEXT NOT NULL,
  brief JSONB NOT NULL DEFAULT '{}',
  
  -- Priority and timing
  priority TEXT DEFAULT 'normal', -- urgent, normal, low
  due_date TIMESTAMPTZ,
  
  -- Status workflow
  status TEXT DEFAULT 'new', -- new, in_progress, review, approved, done, cancelled
  
  -- Generated kit (if any)
  kit_id UUID REFERENCES launch_kits(id),
  
  -- Feedback history
  feedback JSONB DEFAULT '[]',
  
  -- Source tracking
  source TEXT DEFAULT 'app', -- app, slack, email, api
  source_metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_asset_type CHECK (asset_type IN ('landing_page', 'ads', 'emails', 'deck', 'social', 'other')),
  CONSTRAINT valid_priority CHECK (priority IN ('urgent', 'normal', 'low')),
  CONSTRAINT valid_status CHECK (status IN ('new', 'in_progress', 'review', 'approved', 'done', 'cancelled'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS requests_workspace_status ON requests(workspace_id, status);
CREATE INDEX IF NOT EXISTS requests_assignee ON requests(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS requests_requester ON requests(requester_id);
CREATE INDEX IF NOT EXISTS requests_created_at ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS requests_due_date ON requests(due_date) WHERE due_date IS NOT NULL AND status NOT IN ('done', 'cancelled');

-- RLS Policies
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- Workspace members can view requests
CREATE POLICY requests_select ON requests
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Workspace members can create requests
CREATE POLICY requests_insert ON requests
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Workspace members can update requests
CREATE POLICY requests_update ON requests
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Workspace members can delete their own requests or if they're the assignee
CREATE POLICY requests_delete ON requests
  FOR DELETE
  USING (
    requester_id = auth.uid() OR
    assignee_id = auth.uid() OR
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Service role can do anything
CREATE POLICY requests_service ON requests
  FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  -- Also update completed_at if status changed to done
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION update_requests_updated_at();

-- Comments
COMMENT ON TABLE requests IS 'Team request workflow for marketing asset generation';
COMMENT ON COLUMN requests.brief IS 'Request brief containing audience, offer, and constraints';
COMMENT ON COLUMN requests.feedback IS 'Array of feedback entries with user_id, content, and timestamp';
COMMENT ON COLUMN requests.source IS 'Where the request originated (app, slack, email, api)';
