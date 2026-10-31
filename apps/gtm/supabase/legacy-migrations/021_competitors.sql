-- Competitors Migration (Jan 2026)
-- Tables for competitor tracking and battle cards

-- Competitors table
CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  
  -- Basic info
  domain TEXT NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  
  -- Public metrics (JSON for flexibility)
  metrics JSONB DEFAULT '{}',
  -- Structure: {
  --   g2Rating: number,
  --   g2Reviews: number,
  --   g2Url: string,
  --   capterraRating: number,
  --   capterraReviews: number,
  --   capterraUrl: string,
  --   trustRadiusRating: number,
  --   linkedinFollowers: number,
  --   linkedinEmployees: number,
  --   linkedinUrl: string,
  --   fundingTotal: number,
  --   fundingStage: string,
  --   employeeCount: { min: number, max: number },
  --   trafficEstimate: number,
  --   trafficTrend: string
  -- }
  
  -- Historical data
  metrics_history JSONB DEFAULT '[]',
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  
  -- Timestamps
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint per workspace
  UNIQUE(workspace_id, domain)
);

-- Indexes
CREATE INDEX idx_competitors_workspace ON competitors(workspace_id);
CREATE INDEX idx_competitors_domain ON competitors(domain);
CREATE INDEX idx_competitors_status ON competitors(status);

-- Enable RLS
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view competitors in their workspace" ON competitors
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage competitors in their workspace" ON competitors
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Battle cards table
CREATE TABLE battle_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  
  -- Battle card content
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  counter_messages JSONB DEFAULT '[]',
  -- Structure: [{ competitorClaim, yourResponse, evidenceNeeded }]
  
  winning_angles TEXT[] DEFAULT '{}',
  lose_tos TEXT[] DEFAULT '{}',
  key_differentiators TEXT[] DEFAULT '{}',
  
  -- AI generation info
  model_used TEXT,
  prompt_used TEXT,
  
  -- Version tracking
  version INTEGER DEFAULT 1,
  
  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_battle_cards_competitor ON battle_cards(competitor_id);
CREATE INDEX idx_battle_cards_workspace ON battle_cards(workspace_id);

ALTER TABLE battle_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view battle cards in their workspace" ON battle_cards
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage battle cards in their workspace" ON battle_cards
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Positioning suggestions table
CREATE TABLE positioning_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  
  -- Suggestion content
  category TEXT NOT NULL,
  current_position TEXT,
  suggested_position TEXT,
  rationale TEXT,
  messaging_angles TEXT[] DEFAULT '{}',
  
  -- Competitor context
  competitor_ids UUID[] DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'implemented')),
  
  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  implemented_at TIMESTAMPTZ
);

CREATE INDEX idx_positioning_workspace ON positioning_suggestions(workspace_id);

ALTER TABLE positioning_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view positioning in their workspace" ON positioning_suggestions
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage positioning in their workspace" ON positioning_suggestions
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Claim performance tracking table
CREATE TABLE claim_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  engagement_time_seconds INTEGER DEFAULT 0,
  
  -- A/B test info
  variant_id TEXT,
  ab_test_id UUID,
  
  -- Time period
  date DATE NOT NULL,
  
  -- Calculated metrics
  ctr DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN impressions > 0 THEN clicks::DECIMAL / impressions ELSE 0 END
  ) STORED,
  conversion_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN impressions > 0 THEN conversions::DECIMAL / impressions ELSE 0 END
  ) STORED,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint per claim per day per variant
  UNIQUE(claim_id, date, variant_id)
);

CREATE INDEX idx_claim_perf_claim ON claim_performance(claim_id);
CREATE INDEX idx_claim_perf_workspace ON claim_performance(workspace_id);
CREATE INDEX idx_claim_perf_campaign ON claim_performance(campaign_id);
CREATE INDEX idx_claim_perf_date ON claim_performance(date DESC);

ALTER TABLE claim_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view claim performance in their workspace" ON claim_performance
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage claim performance in their workspace" ON claim_performance
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Function to aggregate claim performance
CREATE OR REPLACE FUNCTION get_claim_performance_summary(p_claim_id UUID)
RETURNS TABLE (
  total_impressions BIGINT,
  total_clicks BIGINT,
  total_conversions BIGINT,
  avg_ctr DECIMAL,
  avg_conversion_rate DECIMAL,
  performance_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUM(impressions)::BIGINT as total_impressions,
    SUM(clicks)::BIGINT as total_clicks,
    SUM(conversions)::BIGINT as total_conversions,
    AVG(ctr) as avg_ctr,
    AVG(conversion_rate) as avg_conversion_rate,
    -- Performance score: weighted combination of CTR and conversion rate
    (AVG(ctr) * 0.3 + AVG(conversion_rate) * 0.7) * 100 as performance_score
  FROM claim_performance
  WHERE claim_id = p_claim_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE competitors IS 'Tracked competitors with public metrics';
COMMENT ON TABLE battle_cards IS 'AI-generated competitive battle cards';
COMMENT ON TABLE positioning_suggestions IS 'AI-generated positioning recommendations';
COMMENT ON TABLE claim_performance IS 'Performance tracking for marketing claims';
