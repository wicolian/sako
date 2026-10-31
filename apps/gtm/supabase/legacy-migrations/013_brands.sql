-- Brand Management System
-- Stores brand assets, guidelines, and design tokens for campaign generation

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Basic Info
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  website_url TEXT,
  
  -- Logo Assets
  logo_primary_url TEXT,
  logo_primary_dark_url TEXT,
  logo_icon_url TEXT,
  favicon_url TEXT,
  
  -- Color Palette
  primary_color TEXT NOT NULL DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#8b5cf6',
  accent_color TEXT,
  background_color TEXT DEFAULT '#0f0f0f',
  text_color TEXT DEFAULT '#ffffff',
  
  -- Extended Colors
  color_palette JSONB DEFAULT '[]', -- Array of {name, hex, usage}
  gradients JSONB DEFAULT '[]', -- Array of gradient definitions
  
  -- Typography
  font_family TEXT DEFAULT 'Inter',
  font_heading TEXT,
  font_mono TEXT,
  font_weights JSONB DEFAULT '["400", "500", "600", "700"]',
  font_cdn_url TEXT, -- Google Fonts or custom CDN
  
  -- Brand Voice & Messaging
  voice TEXT, -- e.g., "Professional, friendly, authoritative"
  tone_attributes JSONB DEFAULT '[]', -- Array of tone descriptors
  key_messages JSONB DEFAULT '[]', -- Array of core messages
  value_propositions JSONB DEFAULT '[]',
  boilerplate TEXT, -- Standard company description
  
  -- Visual Style
  visual_style JSONB DEFAULT '{}', -- {theme, corners, shadows, animations}
  icon_style TEXT DEFAULT 'lucide', -- lucide, heroicons, custom
  image_style TEXT, -- e.g., "Abstract, geometric, photography"
  
  -- Brand Guidelines
  guidelines_url TEXT, -- Link to full brand guide PDF
  dos JSONB DEFAULT '[]', -- Brand dos
  donts JSONB DEFAULT '[]', -- Brand don'ts
  
  -- Social
  social_links JSONB DEFAULT '{}', -- {twitter, linkedin, etc.}
  
  -- Metadata
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure only one default brand per workspace
CREATE UNIQUE INDEX idx_brands_default_workspace 
ON brands(workspace_id) 
WHERE is_default = true;

-- Index for workspace lookups
CREATE INDEX idx_brands_workspace ON brands(workspace_id);

-- Enable RLS
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view brands in their workspace" ON brands
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create brands in their workspace" ON brands
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update brands in their workspace" ON brands
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete brands in their workspace" ON brands
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Brand Assets Table (for multiple logo versions, etc.)
CREATE TABLE IF NOT EXISTS brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'logo', 'icon', 'pattern', 'image', 'font'
  format TEXT, -- 'svg', 'png', 'woff2', etc.
  url TEXT NOT NULL,
  
  -- Asset metadata
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  
  -- Usage context
  usage TEXT, -- 'primary', 'dark-mode', 'social', 'favicon'
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_brand_assets_brand ON brand_assets(brand_id);

ALTER TABLE brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage brand assets in their workspace" ON brand_assets
  FOR ALL
  USING (
    brand_id IN (
      SELECT b.id FROM brands b
      JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

-- Function to get default brand for workspace
CREATE OR REPLACE FUNCTION get_default_brand(p_workspace_id UUID)
RETURNS brands AS $$
BEGIN
  RETURN (
    SELECT * FROM brands 
    WHERE workspace_id = p_workspace_id 
    AND is_default = true
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_brand_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_brand_timestamp();
