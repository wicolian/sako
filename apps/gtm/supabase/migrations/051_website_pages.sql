-- Website Pages and Designs Migration
-- Phase 3: Aura-style website builder

-- Website designs table
CREATE TABLE IF NOT EXISTS website_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  
  -- Design content (stored as JSONB)
  sections JSONB DEFAULT '[]',
  global_styles JSONB DEFAULT '{}',
  
  -- SEO
  seo_meta JSONB DEFAULT '{}',
  
  -- Publishing
  status TEXT DEFAULT 'draft', -- draft, published
  published_url TEXT,
  published_at TIMESTAMPTZ,
  subdomain TEXT UNIQUE,
  custom_domain TEXT UNIQUE,
  
  -- Version tracking
  version INTEGER DEFAULT 1,
  last_edited_by UUID REFERENCES auth.users(id),
  
  -- Meta
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Website pages table (for multi-page support)
CREATE TABLE IF NOT EXISTS website_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID NOT NULL REFERENCES website_designs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Page info
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  is_home BOOLEAN DEFAULT false,
  
  -- Content
  sections JSONB DEFAULT '[]',
  seo_meta JSONB DEFAULT '{}',
  
  -- Page settings
  page_transitions JSONB DEFAULT '{}', -- entry/exit animations
  
  -- Sorting
  sort_order INTEGER DEFAULT 0,
  
  -- Meta
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique slug per design
  UNIQUE(design_id, slug)
);

-- Snippets table
CREATE TABLE IF NOT EXISTS snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL for global snippets
  
  -- Snippet info
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- animation, interaction, layout, effect
  category TEXT, -- button, card, hover, scroll, etc.
  
  -- Code
  html TEXT,
  css TEXT,
  js TEXT,
  
  -- Preview
  thumbnail_url TEXT,
  preview_url TEXT,
  
  -- Usage
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  
  -- Meta
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User saved snippets (bookmarks)
CREATE TABLE IF NOT EXISTS user_snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snippet_id UUID NOT NULL REFERENCES snippets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, snippet_id)
);

-- Page transitions presets
CREATE TABLE IF NOT EXISTS page_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- fade, slide, scale, blur, push, wipe, instant
  direction TEXT, -- left, right, up, down
  duration INTEGER DEFAULT 300, -- milliseconds
  easing TEXT DEFAULT 'ease-in-out',
  css_enter TEXT,
  css_exit TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default page transitions
INSERT INTO page_transitions (name, type, direction, duration, easing, is_default) VALUES
  ('Fade', 'fade', NULL, 300, 'ease-in-out', true),
  ('Slide Left', 'slide', 'left', 400, 'ease-out', false),
  ('Slide Right', 'slide', 'right', 400, 'ease-out', false),
  ('Slide Up', 'slide', 'up', 400, 'ease-out', false),
  ('Slide Down', 'slide', 'down', 400, 'ease-out', false),
  ('Scale', 'scale', NULL, 300, 'ease-in-out', false),
  ('Blur', 'blur', NULL, 400, 'ease-in-out', false),
  ('Push Left', 'push', 'left', 500, 'ease-in-out', false),
  ('Push Right', 'push', 'right', 500, 'ease-in-out', false),
  ('Wipe Left', 'wipe', 'left', 600, 'ease-in-out', false),
  ('Wipe Right', 'wipe', 'right', 600, 'ease-in-out', false),
  ('Instant', 'instant', NULL, 0, 'linear', false)
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_website_designs_workspace ON website_designs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_website_designs_brand ON website_designs(brand_id);
CREATE INDEX IF NOT EXISTS idx_website_designs_status ON website_designs(status);
CREATE INDEX IF NOT EXISTS idx_website_designs_subdomain ON website_designs(subdomain);

CREATE INDEX IF NOT EXISTS idx_website_pages_design ON website_pages(design_id);
CREATE INDEX IF NOT EXISTS idx_website_pages_slug ON website_pages(slug);
CREATE INDEX IF NOT EXISTS idx_website_pages_home ON website_pages(is_home);

CREATE INDEX IF NOT EXISTS idx_snippets_workspace ON snippets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_snippets_type ON snippets(type);
CREATE INDEX IF NOT EXISTS idx_snippets_public ON snippets(is_public);

-- RLS Policies
ALTER TABLE website_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_snippets ENABLE ROW LEVEL SECURITY;

-- Designs: workspace members
CREATE POLICY "Workspace members can view designs"
  ON website_designs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = website_designs.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can create designs"
  ON website_designs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = website_designs.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can update designs"
  ON website_designs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = website_designs.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can delete designs"
  ON website_designs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = website_designs.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

-- Pages: same as designs
CREATE POLICY "Workspace members can manage pages"
  ON website_pages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = website_pages.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Snippets: public or workspace
CREATE POLICY "Users can view snippets"
  ON snippets FOR SELECT
  USING (
    is_public = true OR
    workspace_id IS NULL OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = snippets.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can create snippets"
  ON snippets FOR INSERT
  WITH CHECK (
    workspace_id IS NULL OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = snippets.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- User snippets: own only
CREATE POLICY "Users can manage own saved snippets"
  ON user_snippets FOR ALL
  USING (user_id = auth.uid());

-- Function to update design version
CREATE OR REPLACE FUNCTION increment_design_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for version increment
DROP TRIGGER IF EXISTS trigger_increment_design_version ON website_designs;
CREATE TRIGGER trigger_increment_design_version
  BEFORE UPDATE OF sections, global_styles ON website_designs
  FOR EACH ROW
  EXECUTE FUNCTION increment_design_version();
