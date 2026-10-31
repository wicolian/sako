-- Integration Webhooks Migration
-- Support for Make.com, Pabbly, and external automation webhooks

-- Webhook configurations table
CREATE TABLE IF NOT EXISTS webhook_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'make', 'pabbly', 'zapier', 'custom'
  webhook_url TEXT NOT NULL,
  secret TEXT, -- HMAC secret for signature verification
  events TEXT[] NOT NULL DEFAULT '{}', -- Events to trigger: campaign.created, claim.approved, etc.
  headers JSONB DEFAULT '{}', -- Custom headers
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_configurations_workspace ON webhook_configurations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_webhook_configurations_provider ON webhook_configurations(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_configurations_active ON webhook_configurations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_webhook_configurations_events ON webhook_configurations USING gin(events);

-- Webhook delivery logs
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhook_configurations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  duration_ms INTEGER,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for delivery logs
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_failed ON webhook_deliveries(success) WHERE success = false;

-- BigQuery sync configurations
CREATE TABLE IF NOT EXISTS bigquery_sync_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  project_id TEXT NOT NULL, -- GCP project ID
  dataset_id TEXT NOT NULL,
  table_id TEXT,
  service_account_json JSONB, -- Encrypted service account credentials
  sync_type TEXT NOT NULL DEFAULT 'export', -- 'export' or 'import'
  sync_schedule TEXT, -- Cron expression
  query TEXT, -- Custom SQL query for imports
  field_mappings JSONB DEFAULT '{}',
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT, -- 'success', 'failed', 'running'
  last_sync_error TEXT,
  rows_synced INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bigquery_sync_workspace ON bigquery_sync_configs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_bigquery_sync_active ON bigquery_sync_configs(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bigquery_sync_type ON bigquery_sync_configs(sync_type);

-- BigQuery sync history
CREATE TABLE IF NOT EXISTS bigquery_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_config_id UUID NOT NULL REFERENCES bigquery_sync_configs(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'running', 'success', 'failed'
  rows_processed INTEGER DEFAULT 0,
  bytes_processed BIGINT DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bigquery_sync_history_config ON bigquery_sync_history(sync_config_id);
CREATE INDEX IF NOT EXISTS idx_bigquery_sync_history_status ON bigquery_sync_history(status);

-- RLS Policies
ALTER TABLE webhook_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bigquery_sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bigquery_sync_history ENABLE ROW LEVEL SECURITY;

-- Webhook configs: View in own workspace
CREATE POLICY "Users can view webhook configs in their workspace" ON webhook_configurations
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Webhook configs: Create in own workspace (admin only)
CREATE POLICY "Admins can create webhook configs" ON webhook_configurations
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Webhook configs: Update in own workspace (admin only)
CREATE POLICY "Admins can update webhook configs" ON webhook_configurations
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Webhook configs: Delete in own workspace (admin only)
CREATE POLICY "Admins can delete webhook configs" ON webhook_configurations
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Webhook deliveries: View logs for workspace webhooks
CREATE POLICY "Users can view webhook delivery logs" ON webhook_deliveries
  FOR SELECT USING (
    webhook_id IN (
      SELECT id FROM webhook_configurations WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- BigQuery configs: Similar policies
CREATE POLICY "Users can view bigquery configs in their workspace" ON bigquery_sync_configs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage bigquery configs" ON bigquery_sync_configs
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- BigQuery history: View sync history
CREATE POLICY "Users can view bigquery sync history" ON bigquery_sync_history
  FOR SELECT USING (
    sync_config_id IN (
      SELECT id FROM bigquery_sync_configs WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_webhook_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_configurations_updated_at
  BEFORE UPDATE ON webhook_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_configurations_updated_at();

CREATE OR REPLACE FUNCTION update_bigquery_sync_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bigquery_sync_configs_updated_at
  BEFORE UPDATE ON bigquery_sync_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_bigquery_sync_configs_updated_at();

-- Function to record webhook trigger
CREATE OR REPLACE FUNCTION record_webhook_trigger(webhook_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE webhook_configurations 
  SET 
    last_triggered_at = now(),
    trigger_count = trigger_count + 1
  WHERE id = webhook_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record webhook failure
CREATE OR REPLACE FUNCTION record_webhook_failure(webhook_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE webhook_configurations 
  SET failure_count = failure_count + 1
  WHERE id = webhook_id;
END;
$$ LANGUAGE plpgsql;
