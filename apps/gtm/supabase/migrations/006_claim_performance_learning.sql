-- ClaimsOS Learning Loop: Performance Attribution & AI Learning
-- This migration adds tracking for claim performance to create a data moat

-- ============================================================================
-- CLAIM PERFORMANCE TABLE - Track claim conversions for learning
-- ============================================================================

CREATE TABLE IF NOT EXISTS claim_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Claim identification
  claim_hash TEXT NOT NULL, -- SHA256 of normalized claim text for deduplication
  claim_text TEXT NOT NULL, -- The actual claim text
  
  -- Source tracking
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  
  -- Performance metrics
  impressions INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  
  -- Computed conversion rate (stored for query efficiency)
  conversion_rate DECIMAL(8,6) GENERATED ALWAYS AS (
    CASE WHEN impressions > 0 THEN conversions::decimal / impressions ELSE 0 END
  ) STORED,
  
  -- Learning signals
  performance_score INTEGER DEFAULT 50 CHECK (performance_score >= 0 AND performance_score <= 100),
  confidence_level TEXT DEFAULT 'low' CHECK (confidence_level IN ('low', 'medium', 'high')),
  
  -- Category for learning context
  category TEXT DEFAULT 'generic',
  claim_type TEXT DEFAULT 'soft',
  
  -- Timestamps
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_impression_at TIMESTAMPTZ,
  last_conversion_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure uniqueness per workspace
  UNIQUE(claim_hash, workspace_id)
);

-- Indexes for performance queries
CREATE INDEX idx_claim_perf_workspace ON claim_performance(workspace_id);
CREATE INDEX idx_claim_perf_score ON claim_performance(workspace_id, performance_score DESC);
CREATE INDEX idx_claim_perf_category ON claim_performance(workspace_id, category);
CREATE INDEX idx_claim_perf_conversions ON claim_performance(workspace_id, conversion_rate DESC) WHERE impressions >= 100;
CREATE INDEX idx_claim_perf_campaign ON claim_performance(campaign_id) WHERE campaign_id IS NOT NULL;

-- ============================================================================
-- RPC FUNCTIONS FOR ATOMIC UPDATES
-- ============================================================================

-- Function to record an impression
CREATE OR REPLACE FUNCTION record_claim_impression(
  p_workspace_id UUID,
  p_claim_hash TEXT,
  p_claim_text TEXT,
  p_campaign_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT 'generic'
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO claim_performance (
    workspace_id, claim_hash, claim_text, campaign_id, category,
    impressions, last_impression_at
  )
  VALUES (
    p_workspace_id, p_claim_hash, p_claim_text, p_campaign_id, p_category,
    1, NOW()
  )
  ON CONFLICT (claim_hash, workspace_id)
  DO UPDATE SET
    impressions = claim_performance.impressions + 1,
    last_impression_at = NOW(),
    updated_at = NOW(),
    -- Update campaign_id if provided and not already set
    campaign_id = COALESCE(claim_performance.campaign_id, EXCLUDED.campaign_id);
END;
$$;

-- Function to record a conversion
CREATE OR REPLACE FUNCTION record_claim_conversion(
  p_workspace_id UUID,
  p_claim_hash TEXT,
  p_campaign_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE claim_performance
  SET 
    conversions = conversions + 1,
    last_conversion_at = NOW(),
    updated_at = NOW(),
    -- Update confidence based on sample size
    confidence_level = CASE
      WHEN impressions >= 1000 THEN 'high'
      WHEN impressions >= 100 THEN 'medium'
      ELSE 'low'
    END,
    -- Recalculate performance score
    performance_score = CASE
      WHEN impressions >= 50 THEN 
        LEAST(100, GREATEST(0, 
          50 + (((conversions + 1)::decimal / GREATEST(impressions, 1)) * 100)::integer
        ))
      ELSE 50 -- Not enough data
    END
  WHERE claim_hash = p_claim_hash AND workspace_id = p_workspace_id;
END;
$$;

-- Function to get top performing claims for a workspace
CREATE OR REPLACE FUNCTION get_top_performing_claims(
  p_workspace_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_min_impressions INTEGER DEFAULT 100,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  claim_text TEXT,
  conversion_rate DECIMAL,
  performance_score INTEGER,
  impressions INTEGER,
  conversions INTEGER,
  confidence_level TEXT,
  category TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.claim_text,
    cp.conversion_rate,
    cp.performance_score,
    cp.impressions,
    cp.conversions,
    cp.confidence_level,
    cp.category
  FROM claim_performance cp
  WHERE cp.workspace_id = p_workspace_id
    AND cp.impressions >= p_min_impressions
    AND (p_category IS NULL OR cp.category = p_category)
  ORDER BY cp.performance_score DESC, cp.conversion_rate DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- CAMPAIGN ATTRIBUTION: Add tracking field for HubSpot
-- ============================================================================

-- Add sako_campaign_id to track which campaign generated a lead
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE;

-- Function to generate a short tracking ID
CREATE OR REPLACE FUNCTION generate_campaign_tracking_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tracking_id IS NULL THEN
    NEW.tracking_id := 'sako_' || SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 12);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate tracking ID
DROP TRIGGER IF EXISTS campaign_tracking_id_trigger ON campaigns;
CREATE TRIGGER campaign_tracking_id_trigger
  BEFORE INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION generate_campaign_tracking_id();

-- Backfill existing campaigns with tracking IDs
UPDATE campaigns 
SET tracking_id = 'sako_' || SUBSTRING(REPLACE(id::text, '-', ''), 1, 12)
WHERE tracking_id IS NULL;

-- ============================================================================
-- ANGLE PERFORMANCE TRACKING
-- ============================================================================

-- Add performance metrics to angles
ALTER TABLE angles ADD COLUMN IF NOT EXISTS actual_conversion_rate DECIMAL(8,6);
ALTER TABLE angles ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0;
ALTER TABLE angles ADD COLUMN IF NOT EXISTS conversions INTEGER DEFAULT 0;
ALTER TABLE angles ADD COLUMN IF NOT EXISTS performance_validated BOOLEAN DEFAULT false;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE claim_performance ENABLE ROW LEVEL SECURITY;

-- Workspace members can view their performance data
CREATE POLICY "Workspace members can view claim performance" ON claim_performance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = claim_performance.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Only service role can insert/update (via API routes)
CREATE POLICY "Service role can manage claim performance" ON claim_performance
  FOR ALL USING (
    auth.role() = 'service_role'
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_claim_performance_updated_at 
  BEFORE UPDATE ON claim_performance
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
