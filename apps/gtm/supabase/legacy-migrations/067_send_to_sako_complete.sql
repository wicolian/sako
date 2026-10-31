-- ============================================================================
-- Send to Sako - Complete Implementation Migration
-- ============================================================================
-- This migration fixes all the critical bugs identified in the diagnosis:
-- 0. Ensure update_brand_timestamp exists (may be missing if remote schema differs)
-- 1. Creates missing 'escalations' table
-- 2. Adds idempotency support to sako_tasks
-- 3. Adds missing columns (metadata, comments, assigned_to_name)
-- 4. Creates composer_snapshots table for frozen output
-- 5. Creates composer_feedback_events table for learning signals
-- 6. Adds proper indexes for performance
-- ============================================================================

-- Ensure update_brand_timestamp exists (from 013_brands, may differ in remote)
CREATE OR REPLACE FUNCTION update_brand_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. CREATE ESCALATIONS TABLE (missing from original implementation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sako_task_id UUID REFERENCES sako_tasks(id) ON DELETE SET NULL,
  
  -- Idempotency
  idempotency_key TEXT NOT NULL,
  
  -- Escalation details
  reason TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Unique constraint for idempotency
  UNIQUE(workspace_id, campaign_id, idempotency_key)
);

-- Indexes
CREATE INDEX idx_escalations_workspace ON escalations(workspace_id);
CREATE INDEX idx_escalations_campaign ON escalations(campaign_id);
CREATE INDEX idx_escalations_sako_task ON escalations(sako_task_id);
CREATE INDEX idx_escalations_status ON escalations(status);
CREATE INDEX idx_escalations_idempotency ON escalations(workspace_id, campaign_id, idempotency_key);

-- Enable RLS
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view escalations in their workspace" ON escalations
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create escalations in their workspace" ON escalations
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update escalations in their workspace" ON escalations
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER escalations_updated_at
  BEFORE UPDATE ON escalations
  FOR EACH ROW
  EXECUTE FUNCTION update_brand_timestamp();

-- ============================================================================
-- 2. UPDATE SAKO_TASKS TABLE - Add missing columns
-- ============================================================================

-- Add idempotency key (nullable for backwards compatibility)
ALTER TABLE sako_tasks 
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'composer' CHECK (source IN ('composer', 'manual', 'api')),
  ADD COLUMN IF NOT EXISTS asset_type TEXT CHECK (asset_type IN ('landing', 'deck', 'social', 'email', 'other')),
  ADD COLUMN IF NOT EXISTS snapshot_id UUID;

-- Add unique constraint for idempotency (partial index to allow nulls)
CREATE UNIQUE INDEX idx_sako_tasks_idempotency 
  ON sako_tasks(workspace_id, campaign_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Add index for snapshot lookups
CREATE INDEX IF NOT EXISTS idx_sako_tasks_snapshot ON sako_tasks(snapshot_id);

-- ============================================================================
-- 3. CREATE COMPOSER SNAPSHOTS TABLE
-- ============================================================================
-- Stores frozen snapshots of composer output at send-time

CREATE TABLE IF NOT EXISTS composer_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Version tracking
  version_number INTEGER NOT NULL DEFAULT 1,
  version_label TEXT, -- e.g., "v1.2", "Final Draft"
  
  -- Snapshot content
  html_content TEXT, -- Full HTML snapshot
  json_content JSONB, -- Structured blocks/data
  preview_url TEXT, -- URL to preview (if stored separately)
  
  -- Metadata
  asset_type TEXT NOT NULL CHECK (asset_type IN ('landing', 'deck', 'social', 'email', 'other')),
  metadata JSONB DEFAULT '{}', -- Additional metadata (blocks, styles, etc.)
  
  -- Storage
  storage_provider TEXT DEFAULT 'database' CHECK (storage_provider IN ('database', 's3', 'r2')),
  storage_key TEXT, -- Key if stored in external storage
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Unique constraint for version tracking
  UNIQUE(workspace_id, campaign_id, version_number)
);

-- Indexes
CREATE INDEX idx_composer_snapshots_workspace ON composer_snapshots(workspace_id);
CREATE INDEX idx_composer_snapshots_campaign ON composer_snapshots(campaign_id);
CREATE INDEX idx_composer_snapshots_created_at ON composer_snapshots(created_at);
CREATE INDEX idx_composer_snapshots_asset_type ON composer_snapshots(asset_type);

-- Enable RLS
ALTER TABLE composer_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view snapshots in their workspace" ON composer_snapshots
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create snapshots in their workspace" ON composer_snapshots
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. CREATE COMPOSER FEEDBACK EVENTS TABLE
-- ============================================================================
-- Stores feedback signals for the learning loop

CREATE TABLE IF NOT EXISTS composer_feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sako_task_id UUID REFERENCES sako_tasks(id) ON DELETE CASCADE,
  escalation_id UUID REFERENCES escalations(id) ON DELETE SET NULL,
  snapshot_id UUID REFERENCES composer_snapshots(id) ON DELETE SET NULL,
  
  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'task_created',
    'task_assigned',
    'task_in_progress',
    'task_in_review',
    'task_revision_requested',
    'task_completed',
    'task_cancelled',
    'task_accepted',
    'task_rejected',
    'deliverable_uploaded',
    'feedback_submitted'
  )),
  
  -- Outcome data
  outcome TEXT CHECK (outcome IN ('accepted', 'rejected', 'revised', 'cancelled')),
  quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 5),
  revision_count INTEGER DEFAULT 0,
  
  -- Timing metrics
  cycle_time_seconds INTEGER, -- Total time from creation to completion
  time_to_first_delivery INTEGER, -- Time to first deliverable
  time_to_acceptance INTEGER, -- Time to final acceptance
  
  -- Feedback content
  notes TEXT,
  metadata JSONB DEFAULT '{}', -- Structured feedback data
  
  -- Actor
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_composer_feedback_workspace ON composer_feedback_events(workspace_id);
CREATE INDEX idx_composer_feedback_campaign ON composer_feedback_events(campaign_id);
CREATE INDEX idx_composer_feedback_task ON composer_feedback_events(sako_task_id);
CREATE INDEX idx_composer_feedback_event_type ON composer_feedback_events(event_type);
CREATE INDEX idx_composer_feedback_created_at ON composer_feedback_events(created_at);

-- Enable RLS
ALTER TABLE composer_feedback_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view feedback in their workspace" ON composer_feedback_events
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert feedback" ON composer_feedback_events
  FOR INSERT
  WITH CHECK (true); -- Allow service role to insert

-- ============================================================================
-- 5. CREATE VIEWS FOR CONVENIENCE
-- ============================================================================

-- View for escalations with campaign info
CREATE OR REPLACE VIEW escalations_with_campaign AS
SELECT 
  e.*,
  c.name AS campaign_name,
  c.status AS campaign_status,
  st.status AS sako_task_status,
  st.deliverables AS sako_task_deliverables
FROM escalations e
LEFT JOIN campaigns c ON c.id = e.campaign_id
LEFT JOIN sako_tasks st ON st.id = e.sako_task_id;

-- View for feedback analytics
CREATE OR REPLACE VIEW composer_feedback_summary AS
SELECT 
  workspace_id,
  campaign_id,
  sako_task_id,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE event_type = 'task_completed') AS completions,
  COUNT(*) FILTER (WHERE event_type = 'task_accepted') AS acceptances,
  COUNT(*) FILTER (WHERE event_type = 'task_rejected') AS rejections,
  AVG(quality_score) FILTER (WHERE quality_score IS NOT NULL) AS avg_quality_score,
  AVG(cycle_time_seconds) FILTER (WHERE cycle_time_seconds IS NOT NULL) AS avg_cycle_time,
  SUM(revision_count) AS total_revisions
FROM composer_feedback_events
GROUP BY workspace_id, campaign_id, sako_task_id;

-- ============================================================================
-- 6. CREATE FUNCTIONS FOR FEEDBACK LOOP
-- ============================================================================

-- Function to record task lifecycle events
CREATE OR REPLACE FUNCTION record_composer_feedback(
  p_workspace_id UUID,
  p_campaign_id UUID,
  p_sako_task_id UUID,
  p_event_type TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_feedback_id UUID;
BEGIN
  INSERT INTO composer_feedback_events (
    workspace_id,
    campaign_id,
    sako_task_id,
    event_type,
    metadata,
    created_at
  ) VALUES (
    p_workspace_id,
    p_campaign_id,
    p_sako_task_id,
    p_event_type,
    p_metadata,
    now()
  )
  RETURNING id INTO v_feedback_id;
  
  RETURN v_feedback_id;
END;
$$;

-- Function to update cycle time when task completes
CREATE OR REPLACE FUNCTION update_feedback_cycle_time()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Only run on status change to completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Get the task creation time from feedback events
    SELECT created_at INTO v_created_at
    FROM composer_feedback_events
    WHERE sako_task_id = NEW.id AND event_type = 'task_created'
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Update or create completion feedback event with cycle time
    IF v_created_at IS NOT NULL THEN
      UPDATE composer_feedback_events
      SET 
        cycle_time_seconds = EXTRACT(EPOCH FROM (now() - v_created_at))::INTEGER,
        event_type = 'task_completed'
      WHERE sako_task_id = NEW.id 
        AND event_type = 'task_completed'
        AND created_at > now() - interval '1 second'; -- Recent event
      
      -- If no recent completion event, the trigger will have created one
      IF NOT FOUND THEN
        INSERT INTO composer_feedback_events (
          workspace_id,
          campaign_id,
          sako_task_id,
          event_type,
          cycle_time_seconds
        ) VALUES (
          NEW.workspace_id,
          NEW.campaign_id,
          NEW.id,
          'task_completed',
          EXTRACT(EPOCH FROM (now() - v_created_at))::INTEGER
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for cycle time tracking
DROP TRIGGER IF EXISTS track_sako_task_completion ON sako_tasks;
CREATE TRIGGER track_sako_task_completion
  AFTER UPDATE ON sako_tasks
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION update_feedback_cycle_time();

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON escalations TO authenticated;
GRANT SELECT, INSERT ON composer_snapshots TO authenticated;
GRANT SELECT ON composer_feedback_events TO authenticated;
GRANT SELECT ON escalations_with_campaign TO authenticated;
GRANT SELECT ON composer_feedback_summary TO authenticated;

-- Grant sequence access
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
