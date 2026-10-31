-- ============================================================================
-- Public Campaign Gallery (Phase 4.3)
-- Community gallery for inspiration and shared campaigns
-- ============================================================================

CREATE TABLE public_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source campaign
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Public display info
  title TEXT NOT NULL,
  description TEXT,
  long_description TEXT,
  
  -- Creator info (opt-in display)
  creator_name TEXT,
  creator_company TEXT,
  creator_website TEXT,
  show_creator BOOLEAN DEFAULT TRUE,
  
  -- Categorization
  industry TEXT,
  campaign_type TEXT, -- 'product_launch', 'lead_gen', 'brand_awareness', etc.
  content_types TEXT[] DEFAULT '{}', -- ['landing_page', 'email', 'social']
  tags TEXT[] DEFAULT '{}',
  
  -- Visual assets
  thumbnail_url TEXT,
  preview_images TEXT[] DEFAULT '{}',
  
  -- Metrics (curated, not raw)
  results_summary TEXT, -- "2x conversion improvement"
  key_learnings TEXT[] DEFAULT '{}',
  
  -- Engagement
  is_featured BOOLEAN DEFAULT FALSE,
  feature_order INT,
  usage_count INT DEFAULT 0, -- How many times used as inspiration
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  
  -- Ratings
  rating_avg DECIMAL(3,2),
  rating_count INT DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'archived'
  rejection_reason TEXT,
  
  -- Moderation
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Timestamps
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_public_campaigns_featured ON public_campaigns(is_featured, feature_order) WHERE status = 'approved';
CREATE INDEX idx_public_campaigns_industry ON public_campaigns(industry) WHERE status = 'approved';
CREATE INDEX idx_public_campaigns_type ON public_campaigns(campaign_type) WHERE status = 'approved';
CREATE INDEX idx_public_campaigns_popular ON public_campaigns(view_count DESC) WHERE status = 'approved';
CREATE INDEX idx_public_campaigns_tags ON public_campaigns USING GIN(tags);
CREATE INDEX idx_public_campaigns_status ON public_campaigns(status);
CREATE INDEX idx_public_campaigns_workspace ON public_campaigns(workspace_id);

-- User interactions with gallery
CREATE TABLE gallery_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_campaign_id UUID NOT NULL REFERENCES public_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  
  -- Interaction type
  interaction_type TEXT NOT NULL, -- 'view', 'like', 'save', 'use', 'share'
  
  -- Context
  source TEXT, -- 'browse', 'search', 'featured', 'similar'
  session_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate likes/saves
  UNIQUE(public_campaign_id, workspace_id, interaction_type)
);

CREATE INDEX idx_gallery_interactions_campaign ON gallery_interactions(public_campaign_id);
CREATE INDEX idx_gallery_interactions_workspace ON gallery_interactions(workspace_id);
CREATE INDEX idx_gallery_interactions_type ON gallery_interactions(public_campaign_id, interaction_type);

-- Gallery collections (curated lists)
CREATE TABLE gallery_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Collection info
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  
  -- Visual
  cover_image_url TEXT,
  
  -- Curator
  curated_by UUID REFERENCES auth.users(id),
  is_official BOOLEAN DEFAULT FALSE, -- Sako official collection
  
  -- Status
  is_published BOOLEAN DEFAULT FALSE,
  
  -- Ordering
  display_order INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gallery_collections_published ON gallery_collections(is_published, display_order);

-- Collection items
CREATE TABLE gallery_collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES gallery_collections(id) ON DELETE CASCADE,
  public_campaign_id UUID NOT NULL REFERENCES public_campaigns(id) ON DELETE CASCADE,
  
  -- Ordering
  display_order INT DEFAULT 0,
  
  -- Curator notes
  curator_note TEXT,
  
  -- Timestamps
  added_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(collection_id, public_campaign_id)
);

CREATE INDEX idx_gallery_collection_items_collection ON gallery_collection_items(collection_id, display_order);

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_gallery_view(p_campaign_id UUID, p_workspace_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Update view count
  UPDATE public_campaigns SET view_count = view_count + 1 WHERE id = p_campaign_id;
  
  -- Record interaction (ignore if already viewed today)
  INSERT INTO gallery_interactions (public_campaign_id, workspace_id, interaction_type)
  VALUES (p_campaign_id, p_workspace_id, 'view')
  ON CONFLICT (public_campaign_id, workspace_id, interaction_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to toggle like
CREATE OR REPLACE FUNCTION toggle_gallery_like(p_campaign_id UUID, p_workspace_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM gallery_interactions 
    WHERE public_campaign_id = p_campaign_id 
    AND workspace_id = p_workspace_id 
    AND interaction_type = 'like'
  ) INTO v_exists;
  
  IF v_exists THEN
    DELETE FROM gallery_interactions 
    WHERE public_campaign_id = p_campaign_id 
    AND workspace_id = p_workspace_id 
    AND interaction_type = 'like';
    
    UPDATE public_campaigns SET like_count = like_count - 1 WHERE id = p_campaign_id;
    RETURN FALSE;
  ELSE
    INSERT INTO gallery_interactions (public_campaign_id, workspace_id, interaction_type)
    VALUES (p_campaign_id, p_workspace_id, 'like');
    
    UPDATE public_campaigns SET like_count = like_count + 1 WHERE id = p_campaign_id;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE OR REPLACE FUNCTION update_public_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER public_campaigns_updated_at
  BEFORE UPDATE ON public_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_public_campaigns_updated_at();

-- RLS Policies
ALTER TABLE public_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved public campaigns"
  ON public_campaigns FOR SELECT
  USING (status = 'approved' OR workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can submit their campaigns"
  ON public_campaigns FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their submissions"
  ON public_campaigns FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE gallery_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can record interactions"
  ON gallery_interactions FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE gallery_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published collections"
  ON gallery_collections FOR SELECT
  USING (is_published = TRUE);

ALTER TABLE gallery_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view collection items"
  ON gallery_collection_items FOR SELECT
  USING (
    collection_id IN (SELECT id FROM gallery_collections WHERE is_published = TRUE)
  );
