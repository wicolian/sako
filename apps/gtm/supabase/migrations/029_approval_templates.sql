-- ============================================================================
-- Approval Workflow Templates (Phase 3.4)
-- Configurable approval workflows for enterprise governance
-- ============================================================================

CREATE TABLE approval_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Template identity
  name TEXT NOT NULL,
  description TEXT,
  
  -- Workflow configuration
  stages JSONB NOT NULL DEFAULT '[]', 
  -- Example: [
  --   { "name": "Legal Review", "approvers": ["role:legal", "user:uuid"], "required_approvals": 1, "timeout_hours": 24 },
  --   { "name": "Marketing Sign-off", "approvers": ["role:marketing_lead"], "required_approvals": 1, "can_skip": true }
  -- ]
  
  -- Conditional triggers
  conditions JSONB DEFAULT '{}',
  -- Example: { "claim_risk_high": "require_legal", "budget_over_1000": "require_finance" }
  
  -- Escalation settings
  auto_escalation JSONB DEFAULT '{}',
  -- Example: { "after_hours": 48, "escalate_to": "workspace_admin", "reminder_hours": [24, 36] }
  
  -- Notification settings
  notifications JSONB DEFAULT '{}',
  -- Example: { "on_submit": true, "on_approve": true, "on_reject": true, "channels": ["email", "slack"] }
  
  -- Status
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Ensure only one default template per workspace
CREATE UNIQUE INDEX idx_approval_templates_workspace_default 
  ON approval_templates(workspace_id) 
  WHERE is_default = TRUE;

CREATE INDEX idx_approval_templates_workspace ON approval_templates(workspace_id);
CREATE INDEX idx_approval_templates_active ON approval_templates(workspace_id) WHERE is_active = TRUE;

-- Approval workflow instances (running workflows)
CREATE TABLE approval_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  template_id UUID REFERENCES approval_templates(id) ON DELETE SET NULL,
  
  -- What's being approved
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  content_type TEXT, -- 'campaign', 'claim', 'asset', etc.
  content_id UUID, -- Generic reference to any content
  content_snapshot JSONB, -- Snapshot of content at submission time
  
  -- Workflow state
  current_stage INT DEFAULT 0,
  stages_config JSONB NOT NULL, -- Copy of template stages at creation time
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'approved', 'rejected', 'cancelled', 'expired'
  
  -- Metadata
  submitted_by UUID REFERENCES auth.users(id),
  submission_notes TEXT,
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approval_instances_workspace ON approval_instances(workspace_id);
CREATE INDEX idx_approval_instances_campaign ON approval_instances(campaign_id);
CREATE INDEX idx_approval_instances_status ON approval_instances(status);
CREATE INDEX idx_approval_instances_pending ON approval_instances(workspace_id, status) WHERE status IN ('pending', 'in_progress');

-- Individual approval decisions
CREATE TABLE approval_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES approval_instances(id) ON DELETE CASCADE,
  stage_index INT NOT NULL,
  
  -- Decision
  decision TEXT NOT NULL, -- 'approved', 'rejected', 'request_changes', 'skipped'
  decision_by UUID REFERENCES auth.users(id),
  decision_notes TEXT,
  requested_changes TEXT,
  
  -- Timestamps
  decided_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approval_decisions_instance ON approval_decisions(instance_id);

-- Campaign-approval template association
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS approval_template_id UUID REFERENCES approval_templates(id) ON DELETE SET NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'not_required'; -- 'not_required', 'pending', 'approved', 'rejected'

-- Triggers
CREATE OR REPLACE FUNCTION update_approval_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER approval_templates_updated_at
  BEFORE UPDATE ON approval_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_approval_templates_updated_at();

CREATE TRIGGER approval_instances_updated_at
  BEFORE UPDATE ON approval_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_approval_templates_updated_at();

-- RLS Policies for approval_templates
ALTER TABLE approval_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approval templates in their workspace"
  ON approval_templates FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage approval templates"
  ON approval_templates FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- RLS Policies for approval_instances
ALTER TABLE approval_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approval instances in their workspace"
  ON approval_instances FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create approval instances in their workspace"
  ON approval_instances FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS for approval_decisions
ALTER TABLE approval_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view decisions for instances in their workspace"
  ON approval_decisions FOR SELECT
  USING (
    instance_id IN (
      SELECT id FROM approval_instances WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can add decisions"
  ON approval_decisions FOR INSERT
  WITH CHECK (
    instance_id IN (
      SELECT id FROM approval_instances WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );
