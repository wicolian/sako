-- Migration: Add provider connections table for multi-provider support
-- Supports HubSpot, Webflow, Figma, and future integrations

-- Create provider_connections table
CREATE TABLE IF NOT EXISTS provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL, -- e.g., 'hubspot', 'webflow', 'figma', 'linkedin'
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}', -- Store provider-specific details (e.g., siteId for Webflow)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, provider_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_provider_connections_workspace ON provider_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_provider_connections_provider ON provider_connections(provider_id);

-- Enable RLS
ALTER TABLE provider_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Workspace members can view own provider connections" ON provider_connections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = provider_connections.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can manage provider connections" ON provider_connections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = provider_connections.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
    )
  );

-- Add deployments table if not exists (for tracking multi-provider deployments)
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  angle_id UUID REFERENCES angles(id),
  provider_id TEXT DEFAULT 'hubspot',
  idempotency_key TEXT UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'success', 'partial', 'failed')),
  hubspot_payload JSONB,
  hubspot_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for deployment lookups
CREATE INDEX IF NOT EXISTS idx_deployments_campaign ON deployments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_idempotency ON deployments(idempotency_key);

-- Add performance table for tracking metrics
CREATE TABLE IF NOT EXISTS performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  deployment_id UUID REFERENCES deployments(id),
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  metrics JSONB NOT NULL DEFAULT '{}',
  notes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_campaign ON performance(campaign_id);
CREATE INDEX IF NOT EXISTS idx_performance_captured ON performance(captured_at DESC);

-- Enable RLS on deployments and performance
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance ENABLE ROW LEVEL SECURITY;

-- RLS policies for deployments (through campaigns)
CREATE POLICY "Users can view deployments for their campaigns" ON deployments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = deployments.campaign_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage deployments for their campaigns" ON deployments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = deployments.campaign_id
      AND wm.user_id = auth.uid()
    )
  );

-- RLS policies for performance (through campaigns)
CREATE POLICY "Users can view performance for their campaigns" ON performance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = performance.campaign_id
      AND wm.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS provider_connections_updated_at ON provider_connections;
CREATE TRIGGER provider_connections_updated_at
  BEFORE UPDATE ON provider_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS deployments_updated_at ON deployments;
CREATE TRIGGER deployments_updated_at
  BEFORE UPDATE ON deployments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
