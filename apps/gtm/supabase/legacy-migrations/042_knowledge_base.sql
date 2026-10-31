-- ============================================================================
-- Knowledge Base (Jasper IQ Knowledge)
-- Semantic search enabled knowledge repository
-- ============================================================================

-- Knowledge items table
CREATE TABLE IF NOT EXISTS knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Item identity
  title TEXT NOT NULL,
  description TEXT,
  
  -- Content
  content TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('document', 'url', 'manual', 'data')),
  
  -- Source information
  source_url TEXT,
  file_path TEXT, -- Supabase storage path
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  
  -- Vector embedding for semantic search
  embedding vector(1536),
  
  -- Chunking info (for large documents)
  chunk_index INTEGER DEFAULT 0,
  parent_id UUID REFERENCES knowledge_items(id) ON DELETE CASCADE, -- For chunks
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('processing', 'active', 'error', 'archived')),
  error_message TEXT,
  
  -- Usage tracking
  reference_count INTEGER DEFAULT 0,
  last_referenced_at TIMESTAMPTZ,
  
  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_knowledge_items_workspace ON knowledge_items(workspace_id);
CREATE INDEX idx_knowledge_items_type ON knowledge_items(workspace_id, content_type);
CREATE INDEX idx_knowledge_items_status ON knowledge_items(workspace_id, status);
CREATE INDEX idx_knowledge_items_tags ON knowledge_items USING GIN (tags);
CREATE INDEX idx_knowledge_items_parent ON knowledge_items(parent_id) WHERE parent_id IS NOT NULL;

-- Vector similarity search index (requires pgvector extension)
CREATE INDEX IF NOT EXISTS knowledge_items_embedding_idx 
  ON knowledge_items 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Knowledge collections (folders/categories)
CREATE TABLE IF NOT EXISTS knowledge_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📁',
  color TEXT DEFAULT '#6366f1',
  
  -- Hierarchy
  parent_id UUID REFERENCES knowledge_collections(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_knowledge_collections_workspace ON knowledge_collections(workspace_id);
CREATE INDEX idx_knowledge_collections_parent ON knowledge_collections(parent_id) WHERE parent_id IS NOT NULL;

-- Collection membership
CREATE TABLE IF NOT EXISTS knowledge_collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(collection_id, item_id)
);

CREATE INDEX idx_knowledge_collection_items_collection ON knowledge_collection_items(collection_id);
CREATE INDEX idx_knowledge_collection_items_item ON knowledge_collection_items(item_id);

-- Semantic search function
CREATE OR REPLACE FUNCTION search_knowledge(
  p_workspace_id UUID,
  p_query_embedding vector(1536),
  p_match_threshold FLOAT DEFAULT 0.7,
  p_match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  content_type TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ki.id,
    ki.title,
    ki.content,
    ki.content_type,
    1 - (ki.embedding <=> p_query_embedding) as similarity
  FROM knowledge_items ki
  WHERE ki.workspace_id = p_workspace_id
    AND ki.status = 'active'
    AND ki.embedding IS NOT NULL
    AND 1 - (ki.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY ki.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to increment reference count
CREATE OR REPLACE FUNCTION increment_knowledge_reference(p_item_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE knowledge_items 
  SET reference_count = reference_count + 1, last_referenced_at = NOW()
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE OR REPLACE FUNCTION update_knowledge_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_items_updated_at
  BEFORE UPDATE ON knowledge_items
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_items_updated_at();

-- RLS Policies
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view knowledge in their workspace"
  ON knowledge_items FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create knowledge in their workspace"
  ON knowledge_items FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update knowledge in their workspace"
  ON knowledge_items FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete knowledge in their workspace"
  ON knowledge_items FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE knowledge_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage collections in their workspace"
  ON knowledge_collections FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE knowledge_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage collection items in their workspace"
  ON knowledge_collection_items FOR ALL
  USING (
    collection_id IN (
      SELECT id FROM knowledge_collections WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );
