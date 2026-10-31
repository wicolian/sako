-- ============================================================================
-- Projects & Project Context (Jasper Canvas Style)
-- Hierarchical context: Workspace Default → Project Settings → Asset Override
-- ============================================================================

-- Projects table (grouping for canvas assets)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Project identity
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- emoji or icon identifier
  color TEXT DEFAULT '#6366f1', -- project accent color
  
  -- Associated canvas
  canvas_id UUID REFERENCES canvases(id) ON DELETE SET NULL,
  
  -- Project context settings
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  audience_id UUID REFERENCES audiences(id) ON DELETE SET NULL,
  
  -- Campaign goals and context
  campaign_goals TEXT,
  tone_override TEXT,
  keywords_include TEXT[] DEFAULT '{}',
  keywords_avoid TEXT[] DEFAULT '{}',
  
  -- Additional context
  custom_instructions TEXT,
  
  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'archived'
  
  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_workspace ON projects(workspace_id);
CREATE INDEX idx_projects_canvas ON projects(canvas_id) WHERE canvas_id IS NOT NULL;
CREATE INDEX idx_projects_status ON projects(workspace_id, status);

-- Project assets (campaign assets within a project)
CREATE TABLE IF NOT EXISTS project_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Asset identity
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'landing_page', 'email', 'social_post', 'ad_creative', 'video_script', 'sales_deck'
  
  -- Canvas position (for infinite canvas view)
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  width FLOAT DEFAULT 300,
  height FLOAT DEFAULT 200,
  
  -- Content
  content JSONB DEFAULT '{}', -- Asset-specific content
  html TEXT, -- Generated HTML if applicable
  
  -- Asset-specific context overrides (optional)
  brand_id_override UUID REFERENCES brands(id) ON DELETE SET NULL,
  audience_id_override UUID REFERENCES audiences(id) ON DELETE SET NULL,
  tone_override TEXT,
  custom_instructions TEXT,
  
  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'review', 'approved', 'published'
  
  -- Connections to other assets (for flow visualization)
  connected_to UUID[] DEFAULT '{}',
  
  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_assets_project ON project_assets(project_id);
CREATE INDEX idx_project_assets_type ON project_assets(project_id, type);
CREATE INDEX idx_project_assets_status ON project_assets(project_id, status);

-- Project members (for access control beyond workspace)
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'editor', -- 'owner', 'editor', 'viewer', 'commenter'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_user ON project_members(user_id);

-- Triggers
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

CREATE TRIGGER project_assets_updated_at
  BEFORE UPDATE ON project_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

-- RLS Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects in their workspace"
  ON projects FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create projects in their workspace"
  ON projects FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update projects in their workspace"
  ON projects FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete projects in their workspace"
  ON projects FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE project_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assets in their projects"
  ON project_assets FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can modify assets in their projects"
  ON project_assets FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members in their projects"
  ON project_members FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );
