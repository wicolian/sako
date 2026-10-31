-- Snippets Migration
-- Save and reuse code snippets (effects, animations, patterns)

-- Snippets table
CREATE TABLE IF NOT EXISTS snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom', -- 'animation', 'effect', 'layout', 'style', 'interactive', 'custom'
  code TEXT NOT NULL, -- HTML/CSS/JS content
  language TEXT DEFAULT 'html', -- 'html', 'css', 'javascript', 'mixed'
  preview_html TEXT, -- Rendered preview HTML
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_snippets_workspace ON snippets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_snippets_category ON snippets(category);
CREATE INDEX IF NOT EXISTS idx_snippets_public ON snippets(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_snippets_created_by ON snippets(created_by);
CREATE INDEX IF NOT EXISTS idx_snippets_tags ON snippets USING gin(tags);

-- Full text search
CREATE INDEX IF NOT EXISTS idx_snippets_search ON snippets 
  USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));

-- Snippet favorites (bookmarks)
CREATE TABLE IF NOT EXISTS snippet_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snippet_id UUID NOT NULL REFERENCES snippets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(snippet_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_snippet_favorites_user ON snippet_favorites(user_id);

-- RLS Policies
ALTER TABLE snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE snippet_favorites ENABLE ROW LEVEL SECURITY;

-- Snippets: View own workspace snippets or public snippets
CREATE POLICY "Users can view workspace or public snippets" ON snippets
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    OR is_public = true
  );

-- Snippets: Create in own workspace
CREATE POLICY "Users can create snippets in their workspace" ON snippets
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Snippets: Update own snippets
CREATE POLICY "Users can update their own snippets" ON snippets
  FOR UPDATE USING (created_by = auth.uid());

-- Snippets: Delete own snippets
CREATE POLICY "Users can delete their own snippets" ON snippets
  FOR DELETE USING (created_by = auth.uid());

-- Favorites: Users can manage their own favorites
CREATE POLICY "Users can view their favorites" ON snippet_favorites
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can add favorites" ON snippet_favorites
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their favorites" ON snippet_favorites
  FOR DELETE USING (user_id = auth.uid());

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_snippets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER snippets_updated_at
  BEFORE UPDATE ON snippets
  FOR EACH ROW
  EXECUTE FUNCTION update_snippets_updated_at();

-- Increment usage count function
CREATE OR REPLACE FUNCTION increment_snippet_usage(snippet_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE snippets SET usage_count = usage_count + 1 WHERE id = snippet_id;
END;
$$ LANGUAGE plpgsql;

-- Insert default snippets
INSERT INTO snippets (workspace_id, name, description, category, code, language, tags, is_public, created_by)
SELECT 
  w.id,
  'Fade In Animation',
  'Smooth fade-in animation for elements',
  'animation',
  '.fade-in {
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}',
  'css',
  ARRAY['animation', 'fade', 'transition'],
  false,
  (SELECT user_id FROM workspace_members WHERE workspace_id = w.id LIMIT 1)
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM snippets WHERE workspace_id = w.id AND name = 'Fade In Animation')
ON CONFLICT DO NOTHING;
