-- ============================================================================
-- AI Generated Images (Phase 2.1)
-- Store and track AI-generated images for campaigns
-- ============================================================================

CREATE TABLE generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  
  -- Generation inputs
  prompt TEXT NOT NULL,
  enhanced_prompt TEXT, -- Prompt with brand context injected
  negative_prompt TEXT, -- What to avoid
  
  -- Style settings
  style TEXT, -- 'photography', 'illustration', '3d', 'flat_design', 'abstract'
  dimensions TEXT, -- '1200x628', '1080x1080', '1920x1080', etc.
  aspect_ratio TEXT, -- '16:9', '1:1', '4:5', '9:16'
  
  -- Model info
  model TEXT DEFAULT 'google/gemini-3-pro-image',
  model_version TEXT,
  
  -- Storage
  storage_path TEXT NOT NULL,
  public_url TEXT,
  thumbnail_url TEXT,
  file_size_bytes INT,
  mime_type TEXT DEFAULT 'image/png',
  
  -- Metadata
  generation_params JSONB DEFAULT '{}', -- seed, steps, cfg_scale, etc.
  brand_colors_used TEXT[],
  tags TEXT[] DEFAULT '{}',
  
  -- Usage tracking
  used_in_campaigns UUID[] DEFAULT '{}',
  download_count INT DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'completed', -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_generated_images_workspace ON generated_images(workspace_id);
CREATE INDEX idx_generated_images_campaign ON generated_images(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_generated_images_brand ON generated_images(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX idx_generated_images_style ON generated_images(style);
CREATE INDEX idx_generated_images_status ON generated_images(status);
CREATE INDEX idx_generated_images_tags ON generated_images USING GIN(tags);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_generated_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generated_images_updated_at
  BEFORE UPDATE ON generated_images
  FOR EACH ROW
  EXECUTE FUNCTION update_generated_images_updated_at();

-- RLS Policies
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view images in their workspace"
  ON generated_images FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create images in their workspace"
  ON generated_images FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update images in their workspace"
  ON generated_images FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete images in their workspace"
  ON generated_images FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Brand Visual Guidelines Extension (Phase 2.3)
-- ============================================================================

-- Add visual guideline columns to brands table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS visual_style TEXT; -- 'modern_minimalist', 'bold_corporate', 'playful', 'elegant'
ALTER TABLE brands ADD COLUMN IF NOT EXISTS image_style TEXT; -- 'photography', 'illustration', '3d', 'flat_design'
ALTER TABLE brands ADD COLUMN IF NOT EXISTS color_usage_rules JSONB DEFAULT '{}'; -- { primary: "headers", secondary: "accents" }
ALTER TABLE brands ADD COLUMN IF NOT EXISTS forbidden_imagery TEXT[] DEFAULT '{}';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS mood_keywords TEXT[] DEFAULT '{}';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_usage_rules JSONB DEFAULT '{}';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS typography_rules JSONB DEFAULT '{}';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS image_examples TEXT[] DEFAULT '{}'; -- URLs to example images
ALTER TABLE brands ADD COLUMN IF NOT EXISTS style_references TEXT[] DEFAULT '{}'; -- Reference images/mood board

-- Create index for visual style searches
CREATE INDEX IF NOT EXISTS idx_brands_visual_style ON brands(visual_style) WHERE visual_style IS NOT NULL;
