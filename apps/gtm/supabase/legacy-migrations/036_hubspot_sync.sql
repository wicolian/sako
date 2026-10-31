-- ============================================================================
-- HubSpot Contact Sync (Phase 7.1)
-- Sync HubSpot contacts and lists for campaign targeting
-- ============================================================================

-- Synced HubSpot contacts
CREATE TABLE hubspot_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- HubSpot identifiers
  hubspot_id TEXT NOT NULL,
  hubspot_portal_id TEXT,
  
  -- Contact info
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) STORED,
  
  -- Company info
  company_name TEXT,
  company_id TEXT,
  
  -- Contact details
  phone TEXT,
  job_title TEXT,
  
  -- Lifecycle
  lifecycle_stage TEXT, -- 'subscriber', 'lead', 'mql', 'sql', 'opportunity', 'customer'
  lead_status TEXT,
  
  -- List membership
  list_ids TEXT[] DEFAULT '{}',
  
  -- All properties (for flexibility)
  properties JSONB DEFAULT '{}',
  
  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  hubspot_updated_at TIMESTAMPTZ,
  
  -- Engagement metrics from HubSpot
  engagement_score INT,
  last_email_open_date TIMESTAMPTZ,
  last_email_click_date TIMESTAMPTZ,
  
  UNIQUE(workspace_id, hubspot_id)
);

CREATE INDEX idx_hubspot_contacts_workspace ON hubspot_contacts(workspace_id);
CREATE INDEX idx_hubspot_contacts_email ON hubspot_contacts(workspace_id, email);
CREATE INDEX idx_hubspot_contacts_lifecycle ON hubspot_contacts(workspace_id, lifecycle_stage);
CREATE INDEX idx_hubspot_contacts_lists ON hubspot_contacts USING GIN(list_ids);
CREATE INDEX idx_hubspot_contacts_synced ON hubspot_contacts(workspace_id, synced_at);

-- HubSpot contact lists
CREATE TABLE hubspot_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- HubSpot identifiers
  hubspot_list_id TEXT NOT NULL,
  
  -- List info
  name TEXT NOT NULL,
  list_type TEXT, -- 'static', 'dynamic'
  
  -- Stats
  contact_count INT DEFAULT 0,
  
  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- For targeting
  is_available_for_targeting BOOLEAN DEFAULT TRUE,
  
  UNIQUE(workspace_id, hubspot_list_id)
);

CREATE INDEX idx_hubspot_lists_workspace ON hubspot_lists(workspace_id);

-- Sync job tracking
CREATE TABLE hubspot_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Job info
  job_type TEXT NOT NULL, -- 'full', 'incremental', 'lists_only', 'contacts_only'
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  
  -- Progress
  total_contacts INT,
  synced_contacts INT DEFAULT 0,
  total_lists INT,
  synced_lists INT DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  errors_count INT DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hubspot_sync_jobs_workspace ON hubspot_sync_jobs(workspace_id);
CREATE INDEX idx_hubspot_sync_jobs_status ON hubspot_sync_jobs(workspace_id, status);

-- Campaign targeting rules using HubSpot data
CREATE TABLE campaign_targeting_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Rule type
  rule_type TEXT NOT NULL, -- 'hubspot_list', 'hubspot_property', 'audience', 'custom'
  
  -- Rule configuration
  config JSONB NOT NULL,
  -- For hubspot_list: { list_id: "..." }
  -- For hubspot_property: { property: "lifecycle_stage", operator: "equals", value: "mql" }
  -- For audience: { audience_id: "..." }
  
  -- Operator for multiple rules
  operator TEXT DEFAULT 'AND', -- 'AND', 'OR'
  
  -- Ordering
  rule_order INT DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_targeting_rules_campaign ON campaign_targeting_rules(campaign_id);

-- Add HubSpot sync settings to workspace_settings
-- This would be in the existing workspace_settings JSONB column

-- RLS Policies
ALTER TABLE hubspot_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contacts in their workspace"
  ON hubspot_contacts FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE hubspot_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lists in their workspace"
  ON hubspot_lists FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE hubspot_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync jobs in their workspace"
  ON hubspot_sync_jobs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE campaign_targeting_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage targeting rules in their workspace"
  ON campaign_targeting_rules FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
