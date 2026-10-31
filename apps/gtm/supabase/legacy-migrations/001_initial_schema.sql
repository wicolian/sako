-- Sako Composer Database Schema
-- Run this migration to create all required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workspaces table
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace settings (brand kit, forbidden phrases)
CREATE TABLE workspace_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  forbidden_phrases TEXT[] DEFAULT '{}',
  brand_colors JSONB,
  brand_typography JSONB,
  brand_logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns (formerly "plays")
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'published', 'running', 'archived')),
  audience TEXT,
  goal TEXT,
  offer TEXT,
  cta TEXT,
  constraints JSONB,
  selected_angle_id UUID,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evidence library (formerly "proof items")
CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('url', 'text', 'file', 'metric')),
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  file_path TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages (formerly "claims")
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('headline', 'supporting', 'cta', 'disclaimer')),
  text TEXT NOT NULL,
  status TEXT DEFAULT 'approved' CHECK (status IN ('approved', 'needs_evidence', 'blocked')),
  strength TEXT DEFAULT 'soft' CHECK (strength IN ('hard', 'soft')),
  risk_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message-Evidence links (M:M)
CREATE TABLE message_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  evidence_id UUID REFERENCES evidence(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, evidence_id)
);

-- Angles (formerly "variants")
CREATE TABLE angles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rank INTEGER DEFAULT 0,
  trust_score INTEGER DEFAULT 100 CHECK (trust_score >= 0 AND trust_score <= 100),
  rationale TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for selected_angle_id after angles table exists
ALTER TABLE campaigns ADD CONSTRAINT fk_selected_angle 
  FOREIGN KEY (selected_angle_id) REFERENCES angles(id) ON DELETE SET NULL;

-- Page blocks (landing page sections)
CREATE TABLE page_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  angle_id UUID REFERENCES angles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('hero', 'trust', 'benefits', 'features', 'pricing', 'faq', 'footer', 'custom')),
  "order" INTEGER DEFAULT 0,
  props JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follow-up flows (workflow graphs)
CREATE TABLE followup_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  angle_id UUID REFERENCES angles(id) ON DELETE SET NULL,
  graph_json JSONB DEFAULT '{"nodes": [], "edges": []}',
  compiled_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HubSpot connections
CREATE TABLE hubspot_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  portal_id TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deployments (publish history)
CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  angle_id UUID REFERENCES angles(id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'success', 'failed')),
  hubspot_payload JSONB,
  hubspot_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance data (result snapshots)
CREATE TABLE performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  deployment_id UUID REFERENCES deployments(id) ON DELETE SET NULL,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  metrics JSONB DEFAULT '{}',
  notes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign versions (for A/B iterations)
CREATE TABLE campaign_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  parent_version_id UUID REFERENCES campaign_versions(id) ON DELETE SET NULL,
  diff JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_campaigns_workspace ON campaigns(workspace_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_evidence_workspace ON evidence(workspace_id);
CREATE INDEX idx_messages_campaign ON messages(campaign_id);
CREATE INDEX idx_angles_campaign ON angles(campaign_id);
CREATE INDEX idx_page_blocks_campaign ON page_blocks(campaign_id);
CREATE INDEX idx_deployments_campaign ON deployments(campaign_id);
CREATE INDEX idx_performance_campaign ON performance(campaign_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_settings_updated_at BEFORE UPDATE ON workspace_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_page_blocks_updated_at BEFORE UPDATE ON page_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_followup_flows_updated_at BEFORE UPDATE ON followup_flows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hubspot_connections_updated_at BEFORE UPDATE ON hubspot_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deployments_updated_at BEFORE UPDATE ON deployments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default workspace for development
INSERT INTO workspaces (id, name, slug) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Demo Workspace', 'demo');

INSERT INTO workspace_settings (workspace_id, forbidden_phrases) VALUES 
  ('00000000-0000-0000-0000-000000000001', ARRAY['guaranteed', 'risk-free', '100% safe']);
