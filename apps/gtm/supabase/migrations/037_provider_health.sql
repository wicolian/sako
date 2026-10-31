-- ============================================================================
-- Provider Health Dashboard (Phase 8.2)
-- Track health status of all connected integration providers
-- ============================================================================

CREATE TABLE provider_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Provider identification
  provider_type TEXT NOT NULL, -- 'hubspot', 'webflow', 'figma', 'salesforce', etc.
  connection_id UUID, -- Reference to provider_connections if exists
  
  -- Health status
  status TEXT NOT NULL, -- 'healthy', 'degraded', 'unhealthy', 'unknown'
  
  -- Check results
  response_time_ms INT,
  is_connected BOOLEAN,
  is_authenticated BOOLEAN,
  api_quota_remaining INT,
  api_quota_total INT,
  
  -- Error details
  error_code TEXT,
  error_message TEXT,
  
  -- Capabilities check
  capabilities_status JSONB DEFAULT '{}',
  -- e.g., { "forms": "healthy", "pages": "degraded", "contacts": "unhealthy" }
  
  -- Timestamps
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_provider_health_checks_workspace ON provider_health_checks(workspace_id);
CREATE INDEX idx_provider_health_checks_provider ON provider_health_checks(workspace_id, provider_type);
CREATE INDEX idx_provider_health_checks_recent ON provider_health_checks(workspace_id, checked_at DESC);
CREATE INDEX idx_provider_health_checks_status ON provider_health_checks(workspace_id, status);

-- Provider health summary (latest status per provider)
CREATE TABLE provider_health_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL,
  
  -- Current status
  current_status TEXT NOT NULL DEFAULT 'unknown',
  last_healthy_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  
  -- Reliability metrics
  uptime_percent_30d DECIMAL(5,2), -- Last 30 days
  avg_response_time_ms INT,
  error_count_24h INT DEFAULT 0,
  
  -- Check frequency
  check_interval_minutes INT DEFAULT 15,
  last_check_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ,
  
  -- Notifications
  alert_threshold_minutes INT DEFAULT 30, -- Alert if unhealthy for this long
  alert_sent_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(workspace_id, provider_type)
);

CREATE INDEX idx_provider_health_summary_workspace ON provider_health_summary(workspace_id);
CREATE INDEX idx_provider_health_summary_status ON provider_health_summary(current_status);

-- Provider incidents (tracked issues)
CREATE TABLE provider_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL,
  
  -- Incident info
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  
  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'investigating', 'resolved'
  
  -- Impact
  affected_capabilities TEXT[] DEFAULT '{}',
  
  -- Resolution
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_provider_incidents_workspace ON provider_incidents(workspace_id);
CREATE INDEX idx_provider_incidents_active ON provider_incidents(workspace_id, status) WHERE status != 'resolved';

-- Function to update health summary
CREATE OR REPLACE FUNCTION update_provider_health_summary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO provider_health_summary (workspace_id, provider_type, current_status, last_check_at)
  VALUES (NEW.workspace_id, NEW.provider_type, NEW.status, NEW.checked_at)
  ON CONFLICT (workspace_id, provider_type) DO UPDATE SET
    current_status = NEW.status,
    last_check_at = NEW.checked_at,
    last_healthy_at = CASE WHEN NEW.status = 'healthy' THEN NEW.checked_at ELSE provider_health_summary.last_healthy_at END,
    last_error_at = CASE WHEN NEW.status = 'unhealthy' THEN NEW.checked_at ELSE provider_health_summary.last_error_at END,
    last_error_message = CASE WHEN NEW.status = 'unhealthy' THEN NEW.error_message ELSE provider_health_summary.last_error_message END,
    avg_response_time_ms = (COALESCE(provider_health_summary.avg_response_time_ms, NEW.response_time_ms) + NEW.response_time_ms) / 2,
    error_count_24h = CASE 
      WHEN NEW.status = 'unhealthy' THEN provider_health_summary.error_count_24h + 1 
      ELSE provider_health_summary.error_count_24h 
    END,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER provider_health_check_summary_update
  AFTER INSERT ON provider_health_checks
  FOR EACH ROW
  EXECUTE FUNCTION update_provider_health_summary();

-- RLS Policies
ALTER TABLE provider_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view health checks in their workspace"
  ON provider_health_checks FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE provider_health_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view health summary in their workspace"
  ON provider_health_summary FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE provider_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view incidents in their workspace"
  ON provider_incidents FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
