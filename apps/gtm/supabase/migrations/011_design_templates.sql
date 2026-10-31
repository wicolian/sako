-- Design Templates: Template RAG with pgvector
-- Migration: 011_design_templates.sql

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Design templates table for RAG
CREATE TABLE design_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id TEXT UNIQUE NOT NULL,
  template_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('hero', 'features', 'pricing', 'testimonials', 'faq', 'cta', 'footer', 'logos', 'stats', 'team', 'gallery', 'contact', 'about', 'process', 'comparison')),
  
  -- Industry tags for filtering
  industry TEXT[] DEFAULT '{}',
  
  -- Visual style metadata
  visual_style JSONB DEFAULT '{}'::jsonb,
  -- Example: {"theme": "dark", "layout": "centered", "density": "spacious", "motion": "subtle"}
  
  -- Design tokens extracted from HTML
  design_tokens JSONB DEFAULT '{}'::jsonb,
  -- Example: {"primaryColors": ["#9ae83e"], "fontFamilies": ["Inter"], "borderRadius": "lg"}
  
  -- The actual HTML content
  html TEXT NOT NULL,
  
  -- Semantic description for embedding
  description TEXT NOT NULL,
  
  -- Vector embedding for similarity search (text-embedding-3-small = 1536 dimensions)
  embedding vector(1536),
  
  -- Source tracking
  source_file TEXT,
  source_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_design_templates_category ON design_templates(category);
CREATE INDEX idx_design_templates_industry ON design_templates USING GIN(industry);
CREATE INDEX idx_design_templates_visual_style ON design_templates USING GIN(visual_style);

-- Create HNSW index for fast similarity search
CREATE INDEX idx_design_templates_embedding ON design_templates 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Hybrid search function: combines semantic + metadata filtering
CREATE OR REPLACE FUNCTION search_templates(
  query_embedding vector(1536),
  category_filter TEXT DEFAULT NULL,
  theme_filter TEXT DEFAULT NULL,
  layout_filter TEXT DEFAULT NULL,
  industry_filter TEXT[] DEFAULT NULL,
  top_k INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  section_id TEXT,
  template_name TEXT,
  category TEXT,
  industry TEXT[],
  visual_style JSONB,
  design_tokens JSONB,
  html TEXT,
  description TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dt.id,
    dt.section_id,
    dt.template_name,
    dt.category,
    dt.industry,
    dt.visual_style,
    dt.design_tokens,
    dt.html,
    dt.description,
    1 - (dt.embedding <=> query_embedding) AS similarity
  FROM design_templates dt
  WHERE 
    (category_filter IS NULL OR dt.category = category_filter)
    AND (theme_filter IS NULL OR dt.visual_style->>'theme' = theme_filter)
    AND (layout_filter IS NULL OR dt.visual_style->>'layout' = layout_filter)
    AND (industry_filter IS NULL OR dt.industry && industry_filter)
  ORDER BY dt.embedding <=> query_embedding
  LIMIT top_k;
END;
$$ LANGUAGE plpgsql STABLE;

-- RLS policies
ALTER TABLE design_templates ENABLE ROW LEVEL SECURITY;

-- Templates are readable by all authenticated users
CREATE POLICY "authenticated_users_can_read_templates" ON design_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can modify templates (future: template marketplace)
CREATE POLICY "only_service_role_can_modify_templates" ON design_templates
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
