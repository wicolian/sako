-- Sako Tasks Table
-- Tracks design escalation requests to Sako V1 agency layer

CREATE TABLE IF NOT EXISTS sako_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  
  -- Sako V1 sync
  sako_v1_id TEXT, -- ID in Sako V1 system
  
  -- Task details
  type TEXT NOT NULL CHECK (type IN ('design_refinement', 'full_redesign', 'copywriting', 'brand_refresh')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'review', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Content
  brief TEXT NOT NULL,
  reason TEXT,
  current_html TEXT,
  feedback TEXT,
  
  -- Assignment
  assigned_to TEXT,
  estimated_delivery TIMESTAMPTZ,
  
  -- Deliverables
  deliverables JSONB DEFAULT '[]', -- Array of {type, url}
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sako_tasks_campaign ON sako_tasks(campaign_id);
CREATE INDEX idx_sako_tasks_workspace ON sako_tasks(workspace_id);
CREATE INDEX idx_sako_tasks_status ON sako_tasks(status);
CREATE INDEX idx_sako_tasks_sako_v1_id ON sako_tasks(sako_v1_id);

-- Enable RLS
ALTER TABLE sako_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view tasks in their workspace" ON sako_tasks
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create tasks in their workspace" ON sako_tasks
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tasks in their workspace" ON sako_tasks
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER sako_tasks_updated_at
  BEFORE UPDATE ON sako_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_brand_timestamp();

-- Task comments/activity
CREATE TABLE IF NOT EXISTS sako_task_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES sako_tasks(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('comment', 'status_change', 'assignment', 'delivery')),
  content TEXT,
  metadata JSONB DEFAULT '{}',
  
  user_id UUID,
  user_name TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sako_task_activity_task ON sako_task_activity(task_id);

ALTER TABLE sako_task_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity for their tasks" ON sako_task_activity
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM sako_tasks
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- View for easy task lookup with campaign info
CREATE OR REPLACE VIEW sako_tasks_with_campaign AS
SELECT 
  t.*,
  c.name AS campaign_name,
  c.status AS campaign_status,
  b.name AS brand_name
FROM sako_tasks t
LEFT JOIN campaigns c ON c.id = t.campaign_id
LEFT JOIN brands b ON b.id = t.brand_id;
