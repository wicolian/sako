-- ============================================================================
-- Zapier Integration (Phase 7.2)
-- Webhooks and actions for Zapier integration
-- ============================================================================

-- Zapier webhook subscriptions (for triggers)
CREATE TABLE zapier_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Webhook info
  webhook_url TEXT NOT NULL,
  
  -- Trigger type
  trigger_type TEXT NOT NULL, -- 'campaign_created', 'campaign_approved', 'claim_validated', 'content_generated'
  
  -- Filters (optional)
  filters JSONB DEFAULT '{}',
  -- e.g., { "campaign_status": "published", "claim_risk": "high" }
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Auth
  zapier_subscription_id TEXT,
  
  -- Stats
  delivery_count INT DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  last_error TEXT,
  error_count INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_zapier_webhooks_workspace ON zapier_webhook_subscriptions(workspace_id);
CREATE INDEX idx_zapier_webhooks_trigger ON zapier_webhook_subscriptions(trigger_type) WHERE is_active = TRUE;

-- Zapier webhook deliveries (audit log)
CREATE TABLE zapier_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES zapier_webhook_subscriptions(id) ON DELETE CASCADE,
  
  -- Payload
  payload JSONB NOT NULL,
  
  -- Delivery status
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'retrying'
  
  -- Response
  response_status INT,
  response_body TEXT,
  
  -- Retries
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  
  -- Timing
  sent_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_zapier_deliveries_subscription ON zapier_webhook_deliveries(subscription_id);
CREATE INDEX idx_zapier_deliveries_status ON zapier_webhook_deliveries(status) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_zapier_deliveries_retry ON zapier_webhook_deliveries(next_retry_at) WHERE status = 'retrying';

-- Zapier API keys (for actions)
CREATE TABLE zapier_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Key info
  key_hash TEXT NOT NULL, -- Hashed API key
  key_prefix TEXT NOT NULL, -- First 8 chars for identification
  name TEXT DEFAULT 'Zapier Integration',
  
  -- Scopes
  scopes TEXT[] DEFAULT ARRAY['campaigns:read', 'campaigns:create', 'claims:read', 'claims:validate'],
  
  -- Rate limiting
  rate_limit_per_minute INT DEFAULT 60,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  usage_count INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_zapier_api_keys_workspace ON zapier_api_keys(workspace_id);
CREATE INDEX idx_zapier_api_keys_prefix ON zapier_api_keys(key_prefix);

-- Function to deliver webhook
CREATE OR REPLACE FUNCTION queue_zapier_webhook(
  p_trigger_type TEXT,
  p_workspace_id UUID,
  p_payload JSONB
)
RETURNS INT AS $$
DECLARE
  v_subscription RECORD;
  v_count INT := 0;
BEGIN
  FOR v_subscription IN 
    SELECT * FROM zapier_webhook_subscriptions
    WHERE workspace_id = p_workspace_id
    AND trigger_type = p_trigger_type
    AND is_active = TRUE
  LOOP
    INSERT INTO zapier_webhook_deliveries (subscription_id, payload)
    VALUES (v_subscription.id, p_payload);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE zapier_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage webhooks in their workspace"
  ON zapier_webhook_subscriptions FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE zapier_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view deliveries for their webhooks"
  ON zapier_webhook_deliveries FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM zapier_webhook_subscriptions WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

ALTER TABLE zapier_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage Zapier API keys"
  ON zapier_api_keys FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
