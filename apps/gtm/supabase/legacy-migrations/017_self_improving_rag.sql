-- Self-Improving RAG: Learning Loop for Template Quality
-- Migration: 017_self_improving_rag.sql

-- Add quality tracking columns to design_templates
ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS quality_score FLOAT DEFAULT 0.5;
ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS times_used INT DEFAULT 0;
ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS times_accepted INT DEFAULT 0;
ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS times_edited INT DEFAULT 0;
ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS times_rejected INT DEFAULT 0;
ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS avg_edit_distance FLOAT DEFAULT 0;
ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'seed'; -- 'seed' | 'generated' | 'user'
ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS parent_generation_id UUID;
ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS components TEXT[] DEFAULT '{}';
ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS suitable_for TEXT[] DEFAULT '{}';
ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS aesthetic_tags TEXT[] DEFAULT '{}';
ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS section_order INT DEFAULT 0;

-- Generations tracking table - tracks every AI generation
CREATE TABLE IF NOT EXISTS generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  
  -- Request context
  request_type TEXT NOT NULL, -- 'landing_page' | 'section' | 'email' | 'ad_copy'
  request_prompt TEXT NOT NULL,
  section_type TEXT, -- For section requests: 'hero', 'features', etc.
  
  -- RAG context - which templates were retrieved
  retrieved_template_ids UUID[] DEFAULT '{}',
  retrieval_scores FLOAT[] DEFAULT '{}', -- Similarity scores for each retrieved template
  
  -- Output
  generated_html TEXT,
  final_html TEXT, -- After user edits
  
  -- Outcome tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'edited', 'rejected', 'deployed')),
  edit_distance INT, -- Levenshtein distance between generated and final
  acceptance_score FLOAT, -- 0.0 to 1.0 based on edits + outcome
  
  -- Timing
  generation_time_ms INT,
  model_used TEXT,
  tokens_used INT,
  cost_usd FLOAT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_generations_workspace ON generations(workspace_id);
CREATE INDEX idx_generations_campaign ON generations(campaign_id);
CREATE INDEX idx_generations_status ON generations(status);
CREATE INDEX idx_generations_request_type ON generations(request_type);
CREATE INDEX idx_generations_created ON generations(created_at DESC);

-- Section analytics - daily aggregates per template
CREATE TABLE IF NOT EXISTS section_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES design_templates(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Daily stats
  times_retrieved INT DEFAULT 0,
  times_selected INT DEFAULT 0, -- User chose this template from options
  times_accepted INT DEFAULT 0,
  times_edited INT DEFAULT 0,
  times_rejected INT DEFAULT 0,
  
  -- Quality metrics
  avg_edit_distance FLOAT,
  avg_generation_time_ms FLOAT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(template_id, date)
);

CREATE INDEX idx_section_analytics_template_date ON section_analytics(template_id, date DESC);

-- Learned sections - candidates for promotion to library
CREATE TABLE IF NOT EXISTS learned_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  
  -- What made this good
  acceptance_score FLOAT NOT NULL,
  user_feedback TEXT,
  
  -- Decision
  promoted_to_library BOOLEAN DEFAULT FALSE,
  promoted_at TIMESTAMPTZ,
  promoted_template_id UUID REFERENCES design_templates(id),
  
  -- Review status
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learned_sections_generation ON learned_sections(generation_id);
CREATE INDEX idx_learned_sections_status ON learned_sections(review_status);
CREATE INDEX idx_learned_sections_score ON learned_sections(acceptance_score DESC);

-- Function to update template quality scores based on generation outcomes
CREATE OR REPLACE FUNCTION update_template_quality_score(
  p_template_id UUID,
  p_outcome TEXT, -- 'accepted' | 'edited' | 'rejected'
  p_edit_distance INT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_current_score FLOAT;
  v_delta FLOAT;
  v_new_score FLOAT;
BEGIN
  -- Get current score
  SELECT quality_score INTO v_current_score
  FROM design_templates
  WHERE id = p_template_id;
  
  -- Calculate delta based on outcome
  CASE p_outcome
    WHEN 'accepted' THEN v_delta := 0.05;
    WHEN 'edited' THEN 
      -- Smaller boost for edited, scaled by edit distance
      IF p_edit_distance IS NOT NULL AND p_edit_distance < 500 THEN
        v_delta := 0.03;
      ELSE
        v_delta := 0.01;
      END IF;
    WHEN 'rejected' THEN v_delta := -0.03;
    ELSE v_delta := 0;
  END CASE;
  
  -- Calculate new score (clamped to 0-1)
  v_new_score := GREATEST(0, LEAST(1, v_current_score + v_delta));
  
  -- Update template
  UPDATE design_templates
  SET 
    quality_score = v_new_score,
    times_used = times_used + 1,
    times_accepted = CASE WHEN p_outcome = 'accepted' THEN times_accepted + 1 ELSE times_accepted END,
    times_edited = CASE WHEN p_outcome = 'edited' THEN times_edited + 1 ELSE times_edited END,
    times_rejected = CASE WHEN p_outcome = 'rejected' THEN times_rejected + 1 ELSE times_rejected END,
    avg_edit_distance = CASE 
      WHEN p_edit_distance IS NOT NULL THEN 
        (avg_edit_distance * times_used + p_edit_distance) / (times_used + 1)
      ELSE avg_edit_distance
    END,
    updated_at = NOW()
  WHERE id = p_template_id;
  
  -- Update daily analytics
  INSERT INTO section_analytics (template_id, date, times_accepted, times_edited, times_rejected, avg_edit_distance)
  VALUES (
    p_template_id, 
    CURRENT_DATE,
    CASE WHEN p_outcome = 'accepted' THEN 1 ELSE 0 END,
    CASE WHEN p_outcome = 'edited' THEN 1 ELSE 0 END,
    CASE WHEN p_outcome = 'rejected' THEN 1 ELSE 0 END,
    p_edit_distance
  )
  ON CONFLICT (template_id, date) DO UPDATE SET
    times_accepted = section_analytics.times_accepted + CASE WHEN p_outcome = 'accepted' THEN 1 ELSE 0 END,
    times_edited = section_analytics.times_edited + CASE WHEN p_outcome = 'edited' THEN 1 ELSE 0 END,
    times_rejected = section_analytics.times_rejected + CASE WHEN p_outcome = 'rejected' THEN 1 ELSE 0 END,
    avg_edit_distance = CASE 
      WHEN p_edit_distance IS NOT NULL THEN 
        (COALESCE(section_analytics.avg_edit_distance, 0) * (section_analytics.times_accepted + section_analytics.times_edited + section_analytics.times_rejected) + p_edit_distance) / 
        (section_analytics.times_accepted + section_analytics.times_edited + section_analytics.times_rejected + 1)
      ELSE section_analytics.avg_edit_distance
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to get high-quality templates with recent performance weighting
CREATE OR REPLACE FUNCTION search_templates_ranked(
  query_embedding vector(1536),
  category_filter TEXT DEFAULT NULL,
  theme_filter TEXT DEFAULT NULL,
  industry_filter TEXT[] DEFAULT NULL,
  top_k INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  section_id TEXT,
  template_name TEXT,
  category TEXT,
  visual_style JSONB,
  html TEXT,
  description TEXT,
  similarity FLOAT,
  quality_score FLOAT,
  final_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dt.id,
    dt.section_id,
    dt.template_name,
    dt.category,
    dt.visual_style,
    dt.html,
    dt.description,
    1 - (dt.embedding <=> query_embedding) AS similarity,
    dt.quality_score,
    -- Combined score: 70% similarity, 30% quality
    (0.7 * (1 - (dt.embedding <=> query_embedding))) + (0.3 * dt.quality_score) AS final_score
  FROM design_templates dt
  WHERE 
    dt.embedding IS NOT NULL
    AND (category_filter IS NULL OR dt.category = category_filter)
    AND (theme_filter IS NULL OR dt.visual_style->>'theme' = theme_filter)
    AND (industry_filter IS NULL OR dt.suitable_for && industry_filter)
  ORDER BY final_score DESC
  LIMIT top_k;
END;
$$ LANGUAGE plpgsql STABLE;

-- RLS policies
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE learned_sections ENABLE ROW LEVEL SECURITY;

-- Generations: users can see their workspace's generations
CREATE POLICY "workspace_members_view_generations" ON generations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = generations.workspace_id 
      AND workspace_members.user_id = auth.uid()::text
    )
  );

CREATE POLICY "workspace_members_insert_generations" ON generations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = generations.workspace_id 
      AND workspace_members.user_id = auth.uid()::text
    )
  );

CREATE POLICY "workspace_members_update_generations" ON generations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = generations.workspace_id 
      AND workspace_members.user_id = auth.uid()::text
    )
  );

-- Section analytics: readable by all authenticated users
CREATE POLICY "authenticated_read_analytics" ON section_analytics
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Learned sections: readable by all, modifiable by service role
CREATE POLICY "authenticated_read_learned" ON learned_sections
  FOR SELECT USING (auth.uid() IS NOT NULL);
