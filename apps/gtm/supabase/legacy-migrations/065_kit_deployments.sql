-- Kit Deployments - Track deployment history for launch kits

CREATE TABLE IF NOT EXISTS kit_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID REFERENCES launch_kits(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  
  -- Deployment details
  provider TEXT NOT NULL, -- webflow, hubspot, framer, subdomain, figma
  url TEXT NOT NULL,
  deployment_id TEXT, -- External deployment ID from provider
  
  -- Status
  status TEXT DEFAULT 'success', -- success, failed, pending
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_provider CHECK (provider IN ('webflow', 'hubspot', 'framer', 'subdomain', 'figma'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS kit_deployments_kit_id ON kit_deployments(kit_id);
CREATE INDEX IF NOT EXISTS kit_deployments_workspace ON kit_deployments(workspace_id);
CREATE INDEX IF NOT EXISTS kit_deployments_created ON kit_deployments(created_at DESC);

-- RLS
ALTER TABLE kit_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY kit_deployments_select ON kit_deployments
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY kit_deployments_insert ON kit_deployments
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY kit_deployments_service ON kit_deployments
  FOR ALL
  USING (auth.role() = 'service_role');

-- Published Pages - Store HTML for subdomain deployments
CREATE TABLE IF NOT EXISTS published_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  kit_id UUID REFERENCES launch_kits(id),
  
  -- Page details
  slug TEXT NOT NULL,
  html TEXT NOT NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique slug per workspace
  CONSTRAINT published_pages_slug_unique UNIQUE (workspace_id, slug)
);

-- Indexes
CREATE INDEX IF NOT EXISTS published_pages_workspace ON published_pages(workspace_id);
CREATE INDEX IF NOT EXISTS published_pages_slug ON published_pages(slug) WHERE is_active = true;

-- RLS
ALTER TABLE published_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY published_pages_select ON published_pages
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    OR is_active = true -- Public pages are readable
  );

CREATE POLICY published_pages_insert ON published_pages
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY published_pages_update ON published_pages
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY published_pages_service ON published_pages
  FOR ALL
  USING (auth.role() = 'service_role');

-- Slack Users - Map Slack users to Sako users
CREATE TABLE IF NOT EXISTS slack_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_user_id TEXT NOT NULL,
  slack_team_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  workspace_id UUID REFERENCES workspaces(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT slack_users_unique UNIQUE (slack_user_id, slack_team_id)
);

CREATE INDEX IF NOT EXISTS slack_users_lookup ON slack_users(slack_user_id);

-- Comments
COMMENT ON TABLE kit_deployments IS 'History of kit deployments to various providers';
COMMENT ON TABLE published_pages IS 'HTML content for subdomain deployments';
COMMENT ON TABLE slack_users IS 'Mapping between Slack users and Sako users';
