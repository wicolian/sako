-- A/B Testing Framework
-- Migration: 019_ab_testing.sql

-- ===========================================
-- EXPERIMENTS
-- ===========================================

CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Experiment details
  name TEXT NOT NULL,
  description TEXT,
  hypothesis TEXT, -- What we're testing
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'archived')),
  
  -- Traffic allocation
  traffic_percentage INT DEFAULT 100 CHECK (traffic_percentage BETWEEN 1 AND 100),
  
  -- Goal configuration
  primary_metric TEXT NOT NULL, -- 'conversion_rate' | 'click_through_rate' | 'bounce_rate' | 'time_on_page'
  secondary_metrics TEXT[] DEFAULT '{}',
  
  -- Statistical settings
  confidence_level FLOAT DEFAULT 0.95, -- 95% confidence
  minimum_sample_size INT DEFAULT 100,
  
  -- Timing
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Results
  winner_variant_id UUID,
  final_confidence FLOAT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL
);

CREATE INDEX idx_experiments_workspace ON experiments(workspace_id);
CREATE INDEX idx_experiments_campaign ON experiments(campaign_id);
CREATE INDEX idx_experiments_status ON experiments(status);

-- ===========================================
-- VARIANTS
-- ===========================================

CREATE TABLE IF NOT EXISTS experiment_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  
  -- Variant details
  name TEXT NOT NULL, -- 'Control', 'Variant A', 'Variant B'
  is_control BOOLEAN DEFAULT FALSE,
  
  -- Traffic split (percentage of experiment traffic)
  traffic_weight INT DEFAULT 50 CHECK (traffic_weight BETWEEN 0 AND 100),
  
  -- Content - what's different in this variant
  content_type TEXT NOT NULL, -- 'headline' | 'cta' | 'hero' | 'full_page' | 'copy'
  content_changes JSONB NOT NULL DEFAULT '{}',
  -- Example: {"headline": "New headline text", "cta_text": "Get Started Free"}
  
  -- Generated HTML for this variant (if full_page or section)
  html TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_variants_experiment ON experiment_variants(experiment_id);

-- ===========================================
-- VISITOR ASSIGNMENTS
-- ===========================================

CREATE TABLE IF NOT EXISTS experiment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
  
  -- Visitor identification (anonymous ID or user ID)
  visitor_id TEXT NOT NULL,
  user_id TEXT, -- If authenticated
  
  -- Session tracking
  session_id TEXT,
  
  -- Metadata
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  ip_hash TEXT, -- Hashed IP for fraud detection
  user_agent TEXT,
  
  UNIQUE(experiment_id, visitor_id)
);

CREATE INDEX idx_assignments_experiment ON experiment_assignments(experiment_id);
CREATE INDEX idx_assignments_variant ON experiment_assignments(variant_id);
CREATE INDEX idx_assignments_visitor ON experiment_assignments(visitor_id);

-- ===========================================
-- EVENTS & CONVERSIONS
-- ===========================================

CREATE TABLE IF NOT EXISTS experiment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES experiment_assignments(id) ON DELETE SET NULL,
  
  -- Event details
  event_type TEXT NOT NULL, -- 'page_view' | 'click' | 'conversion' | 'bounce' | 'scroll_depth'
  event_name TEXT, -- Custom event name
  
  -- Conversion tracking
  is_conversion BOOLEAN DEFAULT FALSE,
  conversion_value FLOAT, -- Revenue or value associated
  
  -- Page interaction metrics
  time_on_page_ms INT,
  scroll_depth_percent INT,
  
  -- Element tracking
  element_id TEXT,
  element_type TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exp_events_experiment ON experiment_events(experiment_id);
CREATE INDEX idx_exp_events_variant ON experiment_events(variant_id);
CREATE INDEX idx_exp_events_type ON experiment_events(event_type);
CREATE INDEX idx_exp_events_conversion ON experiment_events(experiment_id, is_conversion) WHERE is_conversion = TRUE;
CREATE INDEX idx_exp_events_created ON experiment_events(created_at DESC);

-- ===========================================
-- DAILY METRICS ROLLUP
-- ===========================================

CREATE TABLE IF NOT EXISTS experiment_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Traffic
  visitors INT DEFAULT 0,
  sessions INT DEFAULT 0,
  page_views INT DEFAULT 0,
  
  -- Engagement
  total_time_on_page_ms BIGINT DEFAULT 0,
  avg_time_on_page_ms INT DEFAULT 0,
  avg_scroll_depth INT DEFAULT 0,
  bounces INT DEFAULT 0,
  
  -- Conversions
  conversions INT DEFAULT 0,
  conversion_value FLOAT DEFAULT 0,
  
  -- Calculated rates (stored for performance)
  conversion_rate FLOAT,
  bounce_rate FLOAT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(experiment_id, variant_id, date)
);

CREATE INDEX idx_exp_metrics_experiment ON experiment_metrics(experiment_id);
CREATE INDEX idx_exp_metrics_variant ON experiment_metrics(variant_id);
CREATE INDEX idx_exp_metrics_date ON experiment_metrics(date DESC);

-- ===========================================
-- STATISTICAL RESULTS
-- ===========================================

CREATE TABLE IF NOT EXISTS experiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  
  -- Comparison
  control_variant_id UUID NOT NULL REFERENCES experiment_variants(id),
  test_variant_id UUID NOT NULL REFERENCES experiment_variants(id),
  
  -- Primary metric results
  metric_name TEXT NOT NULL,
  control_value FLOAT NOT NULL,
  test_value FLOAT NOT NULL,
  relative_uplift FLOAT, -- (test - control) / control
  absolute_difference FLOAT, -- test - control
  
  -- Statistical significance
  p_value FLOAT,
  confidence_level FLOAT,
  is_significant BOOLEAN,
  
  -- Sample sizes
  control_sample_size INT,
  test_sample_size INT,
  
  -- Calculated at
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exp_results_experiment ON experiment_results(experiment_id);

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

-- Assign visitor to experiment variant (deterministic based on visitor_id)
CREATE OR REPLACE FUNCTION assign_experiment_variant(
  p_experiment_id UUID,
  p_visitor_id TEXT,
  p_user_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_existing_assignment UUID;
  v_variant_id UUID;
  v_total_weight INT;
  v_random_weight INT;
  v_cumulative_weight INT := 0;
BEGIN
  -- Check for existing assignment
  SELECT variant_id INTO v_existing_assignment
  FROM experiment_assignments
  WHERE experiment_id = p_experiment_id AND visitor_id = p_visitor_id;
  
  IF v_existing_assignment IS NOT NULL THEN
    RETURN v_existing_assignment;
  END IF;
  
  -- Get total weight
  SELECT COALESCE(SUM(traffic_weight), 0) INTO v_total_weight
  FROM experiment_variants
  WHERE experiment_id = p_experiment_id;
  
  IF v_total_weight = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Deterministic random based on visitor_id (consistent assignment)
  v_random_weight := abs(hashtext(p_visitor_id || p_experiment_id::text)) % v_total_weight;
  
  -- Select variant based on weight
  FOR v_variant_id IN
    SELECT id FROM experiment_variants 
    WHERE experiment_id = p_experiment_id
    ORDER BY created_at
  LOOP
    SELECT v_cumulative_weight + traffic_weight INTO v_cumulative_weight
    FROM experiment_variants WHERE id = v_variant_id;
    
    IF v_random_weight < v_cumulative_weight THEN
      -- Create assignment
      INSERT INTO experiment_assignments (experiment_id, variant_id, visitor_id, user_id)
      VALUES (p_experiment_id, v_variant_id, p_visitor_id, p_user_id)
      ON CONFLICT (experiment_id, visitor_id) DO NOTHING;
      
      RETURN v_variant_id;
    END IF;
  END LOOP;
  
  RETURN v_variant_id;
END;
$$ LANGUAGE plpgsql;

-- Calculate experiment metrics for a date
CREATE OR REPLACE FUNCTION calculate_experiment_metrics(
  p_experiment_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS VOID AS $$
BEGIN
  INSERT INTO experiment_metrics (
    experiment_id, variant_id, date,
    visitors, sessions, page_views,
    total_time_on_page_ms, avg_time_on_page_ms, avg_scroll_depth, bounces,
    conversions, conversion_value, conversion_rate, bounce_rate
  )
  SELECT 
    e.experiment_id,
    e.variant_id,
    p_date,
    COUNT(DISTINCT ea.visitor_id) as visitors,
    COUNT(DISTINCT e.metadata->>'session_id') as sessions,
    COUNT(*) FILTER (WHERE e.event_type = 'page_view') as page_views,
    COALESCE(SUM(e.time_on_page_ms), 0) as total_time_on_page_ms,
    COALESCE(AVG(e.time_on_page_ms)::INT, 0) as avg_time_on_page_ms,
    COALESCE(AVG(e.scroll_depth_percent)::INT, 0) as avg_scroll_depth,
    COUNT(*) FILTER (WHERE e.event_type = 'bounce') as bounces,
    COUNT(*) FILTER (WHERE e.is_conversion = TRUE) as conversions,
    COALESCE(SUM(e.conversion_value), 0) as conversion_value,
    CASE 
      WHEN COUNT(DISTINCT ea.visitor_id) > 0 
      THEN COUNT(*) FILTER (WHERE e.is_conversion = TRUE)::FLOAT / COUNT(DISTINCT ea.visitor_id)
      ELSE 0 
    END as conversion_rate,
    CASE 
      WHEN COUNT(*) FILTER (WHERE e.event_type = 'page_view') > 0 
      THEN COUNT(*) FILTER (WHERE e.event_type = 'bounce')::FLOAT / COUNT(*) FILTER (WHERE e.event_type = 'page_view')
      ELSE 0 
    END as bounce_rate
  FROM experiment_events e
  LEFT JOIN experiment_assignments ea ON e.assignment_id = ea.id
  WHERE e.experiment_id = p_experiment_id
    AND e.created_at::DATE = p_date
  GROUP BY e.experiment_id, e.variant_id
  ON CONFLICT (experiment_id, variant_id, date) DO UPDATE SET
    visitors = EXCLUDED.visitors,
    sessions = EXCLUDED.sessions,
    page_views = EXCLUDED.page_views,
    total_time_on_page_ms = EXCLUDED.total_time_on_page_ms,
    avg_time_on_page_ms = EXCLUDED.avg_time_on_page_ms,
    avg_scroll_depth = EXCLUDED.avg_scroll_depth,
    bounces = EXCLUDED.bounces,
    conversions = EXCLUDED.conversions,
    conversion_value = EXCLUDED.conversion_value,
    conversion_rate = EXCLUDED.conversion_rate,
    bounce_rate = EXCLUDED.bounce_rate,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- RLS POLICIES
-- ===========================================

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_results ENABLE ROW LEVEL SECURITY;

-- Experiments: workspace members can view, editors+ can manage
CREATE POLICY "members_view_experiments" ON experiments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = experiments.workspace_id 
      AND workspace_members.user_id = auth.uid()::text
    )
  );

CREATE POLICY "editors_manage_experiments" ON experiments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = experiments.workspace_id 
      AND workspace_members.user_id = auth.uid()::text
      AND workspace_members.role IN ('owner', 'admin', 'editor')
    )
  );

-- Variants follow experiment access
CREATE POLICY "members_view_variants" ON experiment_variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments e
      JOIN workspace_members wm ON wm.workspace_id = e.workspace_id
      WHERE e.id = experiment_variants.experiment_id
      AND wm.user_id = auth.uid()::text
    )
  );

-- Events can be inserted by anyone (for tracking), viewed by members
CREATE POLICY "anyone_insert_events" ON experiment_events
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "members_view_events" ON experiment_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments e
      JOIN workspace_members wm ON wm.workspace_id = e.workspace_id
      WHERE e.id = experiment_events.experiment_id
      AND wm.user_id = auth.uid()::text
    )
  );

-- Metrics viewable by members
CREATE POLICY "members_view_metrics" ON experiment_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments e
      JOIN workspace_members wm ON wm.workspace_id = e.workspace_id
      WHERE e.id = experiment_metrics.experiment_id
      AND wm.user_id = auth.uid()::text
    )
  );

-- Results viewable by members
CREATE POLICY "members_view_results" ON experiment_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments e
      JOIN workspace_members wm ON wm.workspace_id = e.workspace_id
      WHERE e.id = experiment_results.experiment_id
      AND wm.user_id = auth.uid()::text
    )
  );
