-- Production Memory - Self-improving content system
-- Phase 5 of the Sako Composer execution plan

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Memory items table
CREATE TABLE IF NOT EXISTS memory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  
  -- Content
  content_type TEXT NOT NULL, -- claim, headline, paragraph, email, ad, social
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL, -- For deduplication
  
  -- Embeddings for semantic search
  embedding vector(1536), -- OpenAI text-embedding-3-large dimension
  
  -- Context
  context JSONB DEFAULT '{}', -- campaign_id, brand_id, audience, etc.
  
  -- Feedback signals
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  feedback_score INTEGER DEFAULT 0, -- -100 to 100
  feedback_reasons JSONB DEFAULT '[]',
  
  -- Performance metrics (if available)
  performance JSONB DEFAULT '{}', -- clicks, conversions, engagement, etc.
  
  -- Source tracking
  source_type TEXT DEFAULT 'generated', -- generated, imported, human
  source_id TEXT, -- Reference to kit_id, claim_id, etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_content_type CHECK (content_type IN ('claim', 'headline', 'paragraph', 'email', 'ad', 'social', 'other')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS memory_items_workspace ON memory_items(workspace_id);
CREATE INDEX IF NOT EXISTS memory_items_content_type ON memory_items(workspace_id, content_type);
CREATE INDEX IF NOT EXISTS memory_items_status ON memory_items(workspace_id, status);
CREATE INDEX IF NOT EXISTS memory_items_content_hash ON memory_items(content_hash);
CREATE INDEX IF NOT EXISTS memory_items_created_at ON memory_items(created_at DESC);

-- Vector index for semantic search (IVFFlat for performance)
CREATE INDEX IF NOT EXISTS memory_items_embedding_idx 
  ON memory_items 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS Policies
ALTER TABLE memory_items ENABLE ROW LEVEL SECURITY;

-- Workspace members can view memory
CREATE POLICY memory_items_select ON memory_items
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Workspace members can create memory items
CREATE POLICY memory_items_insert ON memory_items
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Workspace members can update memory items
CREATE POLICY memory_items_update ON memory_items
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Service role can do anything
CREATE POLICY memory_items_service ON memory_items
  FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_memory_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_items_updated_at
  BEFORE UPDATE ON memory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_items_updated_at();

-- Function to search memory by embedding similarity
CREATE OR REPLACE FUNCTION search_memory_by_embedding(
  p_workspace_id UUID,
  p_embedding vector(1536),
  p_content_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  content_type TEXT,
  status TEXT,
  feedback_score INTEGER,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.content_type,
    m.status,
    m.feedback_score,
    1 - (m.embedding <=> p_embedding) AS similarity
  FROM memory_items m
  WHERE 
    m.workspace_id = p_workspace_id
    AND m.embedding IS NOT NULL
    AND (p_content_type IS NULL OR m.content_type = p_content_type)
  ORDER BY m.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get memory statistics
CREATE OR REPLACE FUNCTION get_memory_stats(p_workspace_id UUID)
RETURNS TABLE (
  total_items BIGINT,
  approved_items BIGINT,
  rejected_items BIGINT,
  avg_feedback_score FLOAT,
  items_by_type JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_items,
    COUNT(*) FILTER (WHERE status = 'approved')::BIGINT AS approved_items,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT AS rejected_items,
    AVG(feedback_score)::FLOAT AS avg_feedback_score,
    jsonb_object_agg(content_type, type_count) AS items_by_type
  FROM (
    SELECT 
      status,
      feedback_score,
      content_type,
      COUNT(*) AS type_count
    FROM memory_items
    WHERE workspace_id = p_workspace_id
    GROUP BY status, feedback_score, content_type
  ) sub
  GROUP BY TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE memory_items IS 'Production memory for self-improving content generation';
COMMENT ON COLUMN memory_items.embedding IS '1536-dimensional vector from text-embedding-3-large';
COMMENT ON COLUMN memory_items.feedback_score IS 'Score from -100 (rejected) to 100 (highly approved)';
COMMENT ON COLUMN memory_items.performance IS 'Performance metrics like clicks, conversions, engagement';
