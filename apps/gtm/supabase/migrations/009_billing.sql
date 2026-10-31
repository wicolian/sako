-- Billing: Subscriptions and Usage Tracking
-- Migration: 009_billing.sql

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_id TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_workspace ON subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_admins_can_manage_billing" ON subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = subscriptions.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
    )
  );

-- Usage metrics table
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('campaigns', 'api_calls', 'deployments')),
  count INT NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_usage_workspace_type_period 
  ON usage_metrics(workspace_id, metric_type, period_start);

ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_can_view_usage" ON usage_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = usage_metrics.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Function to increment usage metrics
CREATE OR REPLACE FUNCTION increment_usage_metric(
  p_workspace_id UUID,
  p_metric_type TEXT,
  p_period_start DATE DEFAULT CURRENT_DATE,
  p_period_end DATE DEFAULT (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO usage_metrics (workspace_id, metric_type, count, period_start, period_end)
  VALUES (p_workspace_id, p_metric_type, 1, p_period_start, p_period_end)
  ON CONFLICT (workspace_id, metric_type, period_start)
  DO UPDATE SET count = usage_metrics.count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create subscription for new workspaces
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (workspace_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_workspace_created_subscription
  AFTER INSERT ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION create_default_subscription();
