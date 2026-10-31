-- Migration: Add API keys table for public ClaimsOS API
-- Enables customers to access /api/v1/validate programmatically

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- User-friendly name, e.g. "Production API Key"
  key_hash TEXT NOT NULL UNIQUE, -- SHA256 hash of the actual key
  key_prefix TEXT NOT NULL, -- First 8 chars of key for display (sk_live_abc...)
  permissions JSONB DEFAULT '{"validate": true, "claims": false, "evidence": false}',
  rate_limit INT DEFAULT 100, -- Requests per minute
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- NULL means never expires
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Workspace members can view own API keys" ON api_keys
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = api_keys.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can manage API keys" ON api_keys
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = api_keys.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
    )
  );

-- API usage tracking for billing and analytics
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL, -- e.g. '/api/v1/validate'
  method TEXT NOT NULL, -- GET, POST, etc.
  claims_count INT DEFAULT 0, -- Number of claims validated
  response_status INT, -- HTTP status code
  latency_ms INT, -- Response time
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by month for efficient querying
CREATE INDEX IF NOT EXISTS idx_api_usage_workspace_time ON api_usage(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage(api_key_id, created_at DESC);

-- Function to update last_used_at on API key
CREATE OR REPLACE FUNCTION update_api_key_last_used()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE api_keys SET last_used_at = NOW() WHERE id = NEW.api_key_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_usage_update_last_used
  AFTER INSERT ON api_usage
  FOR EACH ROW
  WHEN (NEW.api_key_id IS NOT NULL)
  EXECUTE FUNCTION update_api_key_last_used();

-- Add template tracking to policies table
ALTER TABLE policies ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS template_name TEXT;

-- Comment for documentation
COMMENT ON TABLE api_keys IS 'API keys for external access to ClaimsOS public API (/api/v1/validate)';
COMMENT ON TABLE api_usage IS 'Usage tracking for API billing and analytics';
