-- ============================================================================
-- AI Cost Budget Alerts (Phase 8.3)
-- Budget threshold alerts and cost management
-- ============================================================================

-- Budget alert configurations
CREATE TABLE budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Alert configuration
  name TEXT NOT NULL,
  threshold_type TEXT NOT NULL, -- 'percentage', 'absolute'
  threshold_value DECIMAL(10,2) NOT NULL, -- 80 for 80%, or 100.00 for $100
  
  -- Period
  period TEXT DEFAULT 'monthly', -- 'daily', 'weekly', 'monthly'
  
  -- Notification settings
  notification_channels TEXT[] DEFAULT ARRAY['email'], -- 'email', 'slack', 'webhook'
  notification_emails TEXT[] DEFAULT '{}',
  slack_webhook_url TEXT,
  custom_webhook_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_triggered BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMPTZ,
  
  -- Cooldown (don't re-alert within this period)
  cooldown_hours INT DEFAULT 24,
  last_notification_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_budget_alerts_workspace ON budget_alerts(workspace_id);
CREATE INDEX idx_budget_alerts_active ON budget_alerts(workspace_id) WHERE is_active = TRUE;

-- Budget alert history
CREATE TABLE budget_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES budget_alerts(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Alert context
  threshold_value DECIMAL(10,2),
  current_value DECIMAL(10,2),
  percentage_used DECIMAL(5,2),
  
  -- Period info
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  
  -- Notification status
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_channels TEXT[] DEFAULT '{}',
  notification_error TEXT,
  
  -- Timestamps
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_budget_alert_history_workspace ON budget_alert_history(workspace_id);
CREATE INDEX idx_budget_alert_history_alert ON budget_alert_history(alert_id);
CREATE INDEX idx_budget_alert_history_time ON budget_alert_history(workspace_id, triggered_at DESC);

-- Cost forecasting data
CREATE TABLE cost_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Forecast period
  forecast_date DATE NOT NULL,
  period_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  
  -- Actuals (if available)
  actual_cost DECIMAL(10,2),
  actual_tokens INT,
  actual_calls INT,
  
  -- Forecasts
  forecasted_cost DECIMAL(10,2),
  forecasted_tokens INT,
  forecasted_calls INT,
  
  -- Confidence
  confidence_level DECIMAL(3,2), -- 0.85 = 85% confident
  forecast_model TEXT, -- 'linear', 'seasonal', 'ml'
  
  -- Breakdown by model
  cost_breakdown JSONB DEFAULT '{}',
  -- { "openai/gpt-5.2": 45.00, "anthropic/claude-opus-4.5": 30.00 }
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(workspace_id, forecast_date, period_type)
);

CREATE INDEX idx_cost_forecasts_workspace ON cost_forecasts(workspace_id);
CREATE INDEX idx_cost_forecasts_date ON cost_forecasts(workspace_id, forecast_date);

-- Add budget columns to workspace or plan limits
-- (This assumes the workspace_settings JSONB can store budget info)

-- Function to check budget and trigger alerts
CREATE OR REPLACE FUNCTION check_budget_alerts(p_workspace_id UUID)
RETURNS TABLE(alert_id UUID, should_notify BOOLEAN, message TEXT) AS $$
DECLARE
  v_alert RECORD;
  v_current_usage DECIMAL(10,2);
  v_budget_limit DECIMAL(10,2);
  v_percentage DECIMAL(5,2);
  v_should_notify BOOLEAN;
BEGIN
  -- Get current month's usage (simplified - actual implementation would query ai_traces)
  SELECT COALESCE(SUM(cost), 0) INTO v_current_usage
  FROM ai_traces
  WHERE workspace_id = p_workspace_id
  AND created_at >= date_trunc('month', NOW());
  
  -- Get budget limit from workspace settings (placeholder)
  v_budget_limit := 500.00; -- Default, should come from settings
  
  FOR v_alert IN 
    SELECT * FROM budget_alerts 
    WHERE workspace_id = p_workspace_id AND is_active = TRUE
  LOOP
    IF v_alert.threshold_type = 'percentage' THEN
      v_percentage := (v_current_usage / v_budget_limit) * 100;
      v_should_notify := v_percentage >= v_alert.threshold_value;
    ELSE
      v_should_notify := v_current_usage >= v_alert.threshold_value;
    END IF;
    
    -- Check cooldown
    IF v_should_notify AND v_alert.last_notification_at IS NOT NULL THEN
      IF v_alert.last_notification_at + (v_alert.cooldown_hours || ' hours')::INTERVAL > NOW() THEN
        v_should_notify := FALSE;
      END IF;
    END IF;
    
    IF v_should_notify THEN
      RETURN QUERY SELECT 
        v_alert.id,
        TRUE,
        format('Budget alert: %s%% of monthly budget used ($%s of $%s)', 
          round(v_percentage, 1), round(v_current_usage, 2), round(v_budget_limit, 2));
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE budget_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view budget alerts in their workspace"
  ON budget_alerts FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage budget alerts"
  ON budget_alerts FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

ALTER TABLE budget_alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alert history in their workspace"
  ON budget_alert_history FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE cost_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view forecasts in their workspace"
  ON cost_forecasts FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
