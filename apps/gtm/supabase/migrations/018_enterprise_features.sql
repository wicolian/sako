-- Enterprise Features: SSO/SAML, Audit Logs, RBAC, Usage Metering
-- Migration: 018_enterprise_features.sql

-- ===========================================
-- AUDIT LOGS
-- ===========================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_email TEXT,
  
  -- Event details
  action TEXT NOT NULL, -- 'create' | 'update' | 'delete' | 'deploy' | 'login' | 'export' | etc.
  resource_type TEXT NOT NULL, -- 'campaign' | 'brand' | 'template' | 'connection' | 'user' | etc.
  resource_id TEXT,
  resource_name TEXT,
  
  -- Change details (JSON diff for updates)
  old_values JSONB,
  new_values JSONB,
  
  -- Request context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_workspace ON audit_logs(workspace_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Partition by month for performance (optional, for high-volume workspaces)
-- CREATE INDEX idx_audit_logs_created_month ON audit_logs(workspace_id, date_trunc('month', created_at));

-- ===========================================
-- SSO/SAML Configuration
-- ===========================================

CREATE TABLE IF NOT EXISTS sso_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- SSO Provider settings
  provider TEXT NOT NULL CHECK (provider IN ('saml', 'oidc', 'okta', 'azure_ad', 'google_workspace')),
  enabled BOOLEAN DEFAULT FALSE,
  
  -- SAML specific
  entity_id TEXT,
  sso_url TEXT,
  slo_url TEXT, -- Single logout URL
  certificate TEXT, -- X.509 certificate
  
  -- OIDC specific
  client_id TEXT,
  client_secret_encrypted TEXT,
  discovery_url TEXT,
  
  -- Domain restrictions
  allowed_domains TEXT[] DEFAULT '{}',
  auto_provision_users BOOLEAN DEFAULT TRUE,
  default_role TEXT DEFAULT 'member',
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sso_config_workspace ON sso_configurations(workspace_id);

-- ===========================================
-- ROLE-BASED ACCESS CONTROL (Enhanced)
-- ===========================================

-- Define granular permissions
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL -- 'campaigns' | 'brands' | 'billing' | 'team' | 'settings' | 'analytics'
);

-- Insert default permissions
INSERT INTO permissions (id, name, description, category) VALUES
  -- Campaign permissions
  ('campaigns:read', 'View Campaigns', 'View all campaigns and their content', 'campaigns'),
  ('campaigns:create', 'Create Campaigns', 'Create new campaigns', 'campaigns'),
  ('campaigns:edit', 'Edit Campaigns', 'Edit existing campaigns', 'campaigns'),
  ('campaigns:delete', 'Delete Campaigns', 'Delete campaigns', 'campaigns'),
  ('campaigns:deploy', 'Deploy Campaigns', 'Deploy campaigns to providers', 'campaigns'),
  ('campaigns:export', 'Export Campaigns', 'Export campaigns to files', 'campaigns'),
  
  -- Brand permissions
  ('brands:read', 'View Brands', 'View brand settings', 'brands'),
  ('brands:manage', 'Manage Brands', 'Create, edit, delete brands', 'brands'),
  
  -- Team permissions
  ('team:read', 'View Team', 'View team members', 'team'),
  ('team:invite', 'Invite Members', 'Invite new team members', 'team'),
  ('team:manage', 'Manage Team', 'Edit roles and remove members', 'team'),
  
  -- Billing permissions
  ('billing:read', 'View Billing', 'View billing information', 'billing'),
  ('billing:manage', 'Manage Billing', 'Change plans, update payment methods', 'billing'),
  
  -- Settings permissions
  ('settings:read', 'View Settings', 'View workspace settings', 'settings'),
  ('settings:manage', 'Manage Settings', 'Edit workspace settings', 'settings'),
  ('connections:manage', 'Manage Connections', 'Connect/disconnect providers', 'settings'),
  ('api_keys:manage', 'Manage API Keys', 'Create and revoke API keys', 'settings'),
  ('sso:manage', 'Manage SSO', 'Configure SSO/SAML settings', 'settings'),
  
  -- Analytics permissions
  ('analytics:read', 'View Analytics', 'View performance analytics', 'analytics'),
  ('analytics:export', 'Export Analytics', 'Export analytics data', 'analytics')
ON CONFLICT (id) DO NOTHING;

-- Custom roles (beyond owner/admin/member)
CREATE TABLE IF NOT EXISTS custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permission_ids TEXT[] NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE, -- Default role for new members
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(workspace_id, name)
);

CREATE INDEX idx_custom_roles_workspace ON custom_roles(workspace_id);

-- Role assignments (extends workspace_members)
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES custom_roles(id) ON DELETE SET NULL;

-- ===========================================
-- USAGE METERING
-- ===========================================

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT,
  
  -- Event type
  event_type TEXT NOT NULL, -- 'ai_generation' | 'deployment' | 'api_call' | 'export' | 'sako_task'
  event_subtype TEXT, -- More specific: 'landing_page' | 'email' | 'ad_copy' etc.
  
  -- Resource tracking
  resource_type TEXT,
  resource_id TEXT,
  
  -- Consumption metrics
  units_consumed INT DEFAULT 1, -- AI credits, API calls, etc.
  tokens_used INT,
  cost_usd FLOAT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_events_workspace ON usage_events(workspace_id);
CREATE INDEX idx_usage_events_type ON usage_events(event_type);
CREATE INDEX idx_usage_events_created ON usage_events(created_at DESC);
CREATE INDEX idx_usage_events_period ON usage_events(workspace_id, date_trunc('month', created_at));

-- Aggregated usage per billing period
CREATE TABLE IF NOT EXISTS usage_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Totals by type
  ai_generations INT DEFAULT 0,
  ai_tokens_used BIGINT DEFAULT 0,
  deployments INT DEFAULT 0,
  api_calls INT DEFAULT 0,
  exports INT DEFAULT 0,
  sako_tasks INT DEFAULT 0,
  
  -- Cost tracking
  total_cost_usd FLOAT DEFAULT 0,
  
  -- Limits (snapshot from plan at period start)
  ai_generation_limit INT,
  deployment_limit INT,
  api_call_limit INT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(workspace_id, period_start)
);

CREATE INDEX idx_usage_aggregates_workspace ON usage_aggregates(workspace_id);
CREATE INDEX idx_usage_aggregates_period ON usage_aggregates(period_start DESC);

-- Function to track usage event and update aggregates
CREATE OR REPLACE FUNCTION track_usage_event(
  p_workspace_id UUID,
  p_user_id TEXT,
  p_event_type TEXT,
  p_event_subtype TEXT DEFAULT NULL,
  p_units INT DEFAULT 1,
  p_tokens INT DEFAULT NULL,
  p_cost FLOAT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_period_start DATE;
BEGIN
  -- Insert event
  INSERT INTO usage_events (workspace_id, user_id, event_type, event_subtype, units_consumed, tokens_used, cost_usd, metadata)
  VALUES (p_workspace_id, p_user_id, p_event_type, p_event_subtype, p_units, p_tokens, p_cost, p_metadata)
  RETURNING id INTO v_event_id;
  
  -- Get current period start (first of month)
  v_period_start := date_trunc('month', CURRENT_DATE)::DATE;
  
  -- Update or insert aggregate
  INSERT INTO usage_aggregates (workspace_id, period_start, period_end, ai_generations, ai_tokens_used, deployments, api_calls, exports, sako_tasks, total_cost_usd)
  VALUES (
    p_workspace_id,
    v_period_start,
    (v_period_start + INTERVAL '1 month - 1 day')::DATE,
    CASE WHEN p_event_type = 'ai_generation' THEN p_units ELSE 0 END,
    COALESCE(p_tokens, 0),
    CASE WHEN p_event_type = 'deployment' THEN p_units ELSE 0 END,
    CASE WHEN p_event_type = 'api_call' THEN p_units ELSE 0 END,
    CASE WHEN p_event_type = 'export' THEN p_units ELSE 0 END,
    CASE WHEN p_event_type = 'sako_task' THEN p_units ELSE 0 END,
    COALESCE(p_cost, 0)
  )
  ON CONFLICT (workspace_id, period_start) DO UPDATE SET
    ai_generations = usage_aggregates.ai_generations + CASE WHEN p_event_type = 'ai_generation' THEN p_units ELSE 0 END,
    ai_tokens_used = usage_aggregates.ai_tokens_used + COALESCE(p_tokens, 0),
    deployments = usage_aggregates.deployments + CASE WHEN p_event_type = 'deployment' THEN p_units ELSE 0 END,
    api_calls = usage_aggregates.api_calls + CASE WHEN p_event_type = 'api_call' THEN p_units ELSE 0 END,
    exports = usage_aggregates.exports + CASE WHEN p_event_type = 'export' THEN p_units ELSE 0 END,
    sako_tasks = usage_aggregates.sako_tasks + CASE WHEN p_event_type = 'sako_task' THEN p_units ELSE 0 END,
    total_cost_usd = usage_aggregates.total_cost_usd + COALESCE(p_cost, 0),
    updated_at = NOW();
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- RLS POLICIES
-- ===========================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sso_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_aggregates ENABLE ROW LEVEL SECURITY;

-- Audit logs: admins and owners can view
CREATE POLICY "admins_view_audit_logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = audit_logs.workspace_id 
      AND workspace_members.user_id = auth.uid()::text
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- SSO config: only owners can manage
CREATE POLICY "owners_manage_sso" ON sso_configurations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = sso_configurations.workspace_id 
      AND workspace_members.user_id = auth.uid()::text
      AND workspace_members.role = 'owner'
    )
  );

-- Custom roles: admins can view, owners can manage
CREATE POLICY "members_view_roles" ON custom_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = custom_roles.workspace_id 
      AND workspace_members.user_id = auth.uid()::text
    )
  );

CREATE POLICY "owners_manage_roles" ON custom_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = custom_roles.workspace_id 
      AND workspace_members.user_id = auth.uid()::text
      AND workspace_members.role = 'owner'
    )
  );

-- Usage: members can view their workspace usage
CREATE POLICY "members_view_usage_events" ON usage_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = usage_events.workspace_id 
      AND workspace_members.user_id = auth.uid()::text
    )
  );

CREATE POLICY "members_view_usage_aggregates" ON usage_aggregates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = usage_aggregates.workspace_id 
      AND workspace_members.user_id = auth.uid()::text
    )
  );
