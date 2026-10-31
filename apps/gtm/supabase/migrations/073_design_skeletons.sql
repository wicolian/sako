-- ============================================================================
-- 073: Design Skeletons for Template-as-DNA Pipeline
-- ============================================================================
-- Adds skeleton data to design_templates for structural assembly.
-- ============================================================================

-- Add skeleton columns to existing design_templates table
ALTER TABLE design_templates
  ADD COLUMN IF NOT EXISTS design_skeleton jsonb,
  ADD COLUMN IF NOT EXISTS skeleton_css text,
  ADD COLUMN IF NOT EXISTS skeleton_html text,
  ADD COLUMN IF NOT EXISTS complexity_score integer CHECK (complexity_score BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS aesthetic_signature vector(384);

-- Index for similarity search on aesthetic signatures
CREATE INDEX IF NOT EXISTS idx_design_templates_aesthetic
  ON design_templates USING ivfflat (aesthetic_signature vector_cosine_ops)
  WITH (lists = 20);

-- Index for complexity-based filtering
CREATE INDEX IF NOT EXISTS idx_design_templates_complexity
  ON design_templates(complexity_score)
  WHERE complexity_score IS NOT NULL;
