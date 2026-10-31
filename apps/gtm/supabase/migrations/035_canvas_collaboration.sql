-- ============================================================================
-- ChatCanvas Collaboration (Phase 4.2)
-- Real-time collaborative canvas with visual annotations
-- ============================================================================

CREATE TABLE canvases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Canvas identity
  name TEXT NOT NULL,
  description TEXT,
  
  -- Associated content
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Canvas state
  elements JSONB NOT NULL DEFAULT '[]', -- All canvas elements
  viewport JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}',
  
  -- Canvas settings
  background_color TEXT DEFAULT '#0f0f0f',
  grid_enabled BOOLEAN DEFAULT TRUE,
  snap_to_grid BOOLEAN DEFAULT TRUE,
  grid_size INT DEFAULT 20,
  
  -- Dimensions
  width INT DEFAULT 1920,
  height INT DEFAULT 1080,
  
  -- Access control
  is_public BOOLEAN DEFAULT FALSE,
  allow_comments BOOLEAN DEFAULT TRUE,
  allow_editing BOOLEAN DEFAULT TRUE, -- For shared access
  
  -- Version control
  version INT DEFAULT 1,
  
  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'archived'
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  last_edited_by UUID REFERENCES auth.users(id),
  last_edited_at TIMESTAMPTZ
);

CREATE INDEX idx_canvases_workspace ON canvases(workspace_id);
CREATE INDEX idx_canvases_campaign ON canvases(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_canvases_active ON canvases(workspace_id) WHERE status = 'active';

-- Canvas elements (denormalized for real-time sync efficiency)
-- This is a materialized view of elements for querying
CREATE TABLE canvas_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  
  -- Element identity
  element_id TEXT NOT NULL, -- Client-generated ID for real-time sync
  
  -- Element type
  type TEXT NOT NULL, -- 'text', 'image', 'shape', 'sticky', 'frame', 'connector', 'annotation', 'ai_block'
  
  -- Position and size
  x FLOAT NOT NULL DEFAULT 0,
  y FLOAT NOT NULL DEFAULT 0,
  width FLOAT,
  height FLOAT,
  rotation FLOAT DEFAULT 0,
  
  -- Layer ordering
  z_index INT DEFAULT 0,
  
  -- Content (varies by type)
  content JSONB DEFAULT '{}',
  -- For text: { text, fontSize, fontFamily, color, align }
  -- For image: { src, alt, fit }
  -- For shape: { shape, fill, stroke, strokeWidth }
  -- For sticky: { text, color }
  -- For annotation: { points, color, strokeWidth }
  -- For ai_block: { blockType, generatedContent }
  
  -- Styling
  style JSONB DEFAULT '{}',
  
  -- Grouping
  group_id TEXT, -- For grouped elements
  parent_id TEXT, -- For nested elements (frames)
  
  -- Locking
  is_locked BOOLEAN DEFAULT FALSE,
  locked_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(canvas_id, element_id)
);

CREATE INDEX idx_canvas_elements_canvas ON canvas_elements(canvas_id);
CREATE INDEX idx_canvas_elements_type ON canvas_elements(canvas_id, type);
CREATE INDEX idx_canvas_elements_group ON canvas_elements(group_id) WHERE group_id IS NOT NULL;

-- Canvas presence (who's viewing/editing)
CREATE TABLE canvas_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Cursor position
  cursor_x FLOAT,
  cursor_y FLOAT,
  
  -- Selected elements
  selected_elements TEXT[] DEFAULT '{}',
  
  -- User display info
  user_name TEXT,
  user_color TEXT, -- Assigned color for this user
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Session
  session_id TEXT,
  
  UNIQUE(canvas_id, user_id)
);

CREATE INDEX idx_canvas_presence_canvas ON canvas_presence(canvas_id) WHERE is_active = TRUE;

-- Canvas comments
CREATE TABLE canvas_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  
  -- Position on canvas
  x FLOAT NOT NULL,
  y FLOAT NOT NULL,
  
  -- Associated element (optional)
  element_id TEXT,
  
  -- Comment content
  content TEXT NOT NULL,
  
  -- Threading
  parent_comment_id UUID REFERENCES canvas_comments(id) ON DELETE CASCADE,
  thread_id UUID, -- Root comment of thread
  
  -- Author
  author_id UUID REFERENCES auth.users(id),
  author_name TEXT,
  
  -- Status
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_canvas_comments_canvas ON canvas_comments(canvas_id);
CREATE INDEX idx_canvas_comments_element ON canvas_comments(element_id) WHERE element_id IS NOT NULL;
CREATE INDEX idx_canvas_comments_thread ON canvas_comments(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_canvas_comments_unresolved ON canvas_comments(canvas_id) WHERE is_resolved = FALSE;

-- Canvas version history
CREATE TABLE canvas_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  
  -- Version info
  version_number INT NOT NULL,
  
  -- Snapshot
  elements_snapshot JSONB NOT NULL,
  
  -- Metadata
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(canvas_id, version_number)
);

CREATE INDEX idx_canvas_versions_canvas ON canvas_versions(canvas_id);

-- Function to create canvas version
CREATE OR REPLACE FUNCTION create_canvas_version(p_canvas_id UUID, p_description TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  v_canvas RECORD;
  v_new_version INT;
  v_version_id UUID;
BEGIN
  SELECT * INTO v_canvas FROM canvases WHERE id = p_canvas_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canvas not found: %', p_canvas_id;
  END IF;
  
  -- Get next version
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_new_version
  FROM canvas_versions WHERE canvas_id = p_canvas_id;
  
  -- Create version
  INSERT INTO canvas_versions (canvas_id, version_number, elements_snapshot, description, created_by)
  VALUES (p_canvas_id, v_new_version, v_canvas.elements, p_description, auth.uid())
  RETURNING id INTO v_version_id;
  
  -- Update canvas version
  UPDATE canvases SET version = v_new_version WHERE id = p_canvas_id;
  
  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
CREATE OR REPLACE FUNCTION update_canvases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_edited_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER canvases_updated_at
  BEFORE UPDATE ON canvases
  FOR EACH ROW
  EXECUTE FUNCTION update_canvases_updated_at();

CREATE OR REPLACE FUNCTION update_canvas_elements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Also update parent canvas
  UPDATE canvases SET updated_at = NOW() WHERE id = NEW.canvas_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER canvas_elements_updated_at
  BEFORE UPDATE ON canvas_elements
  FOR EACH ROW
  EXECUTE FUNCTION update_canvas_elements_updated_at();

-- RLS Policies
ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view canvases in their workspace"
  ON canvases FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ) OR is_public = TRUE
  );

CREATE POLICY "Users can create canvases in their workspace"
  ON canvases FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update canvases in their workspace"
  ON canvases FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete canvases in their workspace"
  ON canvases FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE canvas_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view elements in accessible canvases"
  ON canvas_elements FOR SELECT
  USING (
    canvas_id IN (
      SELECT id FROM canvases WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      ) OR is_public = TRUE
    )
  );

CREATE POLICY "Users can modify elements in their canvases"
  ON canvas_elements FOR ALL
  USING (
    canvas_id IN (
      SELECT id FROM canvases WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

ALTER TABLE canvas_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view presence in accessible canvases"
  ON canvas_presence FOR SELECT
  USING (
    canvas_id IN (
      SELECT id FROM canvases WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      ) OR is_public = TRUE
    )
  );

CREATE POLICY "Users can update their own presence"
  ON canvas_presence FOR ALL
  USING (user_id = auth.uid());

ALTER TABLE canvas_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments in accessible canvases"
  ON canvas_comments FOR SELECT
  USING (
    canvas_id IN (
      SELECT id FROM canvases WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      ) OR is_public = TRUE
    )
  );

CREATE POLICY "Users can add comments to accessible canvases"
  ON canvas_comments FOR INSERT
  WITH CHECK (
    canvas_id IN (
      SELECT id FROM canvases WHERE 
        (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
        OR (is_public = TRUE AND allow_comments = TRUE)
    )
  );

ALTER TABLE canvas_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions in their canvases"
  ON canvas_versions FOR SELECT
  USING (
    canvas_id IN (
      SELECT id FROM canvases WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );
