-- ============================================================================
-- Template Marketplace (Phase 6.2)
-- Browse, purchase, and share campaign templates
-- ============================================================================

CREATE TABLE marketplace_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Creator info
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL, -- Creator's workspace (NULL for Sako official)
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_name TEXT,
  is_official BOOLEAN DEFAULT FALSE, -- Sako official templates
  
  -- Template content
  title TEXT NOT NULL,
  description TEXT,
  long_description TEXT, -- Rich markdown description
  
  -- Categorization
  category TEXT NOT NULL, -- 'landing_page', 'email_sequence', 'ad_campaign', 'social_kit', 'full_campaign'
  subcategory TEXT,
  industry TEXT, -- 'saas', 'ecommerce', 'healthcare', 'finance', etc.
  use_case TEXT, -- 'product_launch', 'lead_gen', 'brand_awareness', etc.
  tags TEXT[] DEFAULT '{}',
  
  -- Template data
  template_data JSONB NOT NULL, -- The actual template structure
  preview_data JSONB, -- Sample filled data for preview
  
  -- Visual assets
  preview_url TEXT,
  thumbnail_url TEXT,
  gallery_images TEXT[] DEFAULT '{}',
  video_preview_url TEXT,
  
  -- Pricing
  price_cents INT DEFAULT 0, -- 0 = free
  currency TEXT DEFAULT 'USD',
  is_free BOOLEAN GENERATED ALWAYS AS (price_cents = 0) STORED,
  
  -- Quality indicators
  is_verified BOOLEAN DEFAULT FALSE, -- Reviewed by Sako team
  is_featured BOOLEAN DEFAULT FALSE,
  quality_score INT, -- 0-100 internal quality score
  
  -- Usage stats
  usage_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  
  -- Ratings
  rating_avg DECIMAL(3,2),
  rating_count INT DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'pending_review', 'approved', 'rejected', 'archived'
  rejection_reason TEXT,
  
  -- Requirements
  required_integrations TEXT[] DEFAULT '{}', -- e.g., ['hubspot', 'webflow']
  minimum_plan TEXT, -- 'free', 'pro', 'enterprise'
  
  -- Timestamps
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_marketplace_templates_category ON marketplace_templates(category, status);
CREATE INDEX idx_marketplace_templates_industry ON marketplace_templates(industry) WHERE industry IS NOT NULL;
CREATE INDEX idx_marketplace_templates_featured ON marketplace_templates(is_featured, published_at DESC) WHERE status = 'approved';
CREATE INDEX idx_marketplace_templates_free ON marketplace_templates(is_free, usage_count DESC) WHERE status = 'approved';
CREATE INDEX idx_marketplace_templates_rating ON marketplace_templates(rating_avg DESC NULLS LAST) WHERE status = 'approved';
CREATE INDEX idx_marketplace_templates_tags ON marketplace_templates USING GIN(tags);
CREATE INDEX idx_marketplace_templates_status ON marketplace_templates(status);

-- Template purchases/acquisitions
CREATE TABLE template_acquisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  
  -- Purchase details
  price_paid_cents INT DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  payment_intent_id TEXT, -- Stripe payment intent
  
  -- Status
  status TEXT DEFAULT 'completed', -- 'completed', 'refunded'
  
  -- Timestamps
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(workspace_id, template_id)
);

CREATE INDEX idx_template_acquisitions_workspace ON template_acquisitions(workspace_id);
CREATE INDEX idx_template_acquisitions_template ON template_acquisitions(template_id);

-- Template ratings and reviews
CREATE TABLE template_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  
  -- Rating
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  
  -- Review content
  title TEXT,
  content TEXT,
  
  -- Helpful votes
  helpful_count INT DEFAULT 0,
  
  -- Status
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  is_visible BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(template_id, workspace_id)
);

CREATE INDEX idx_template_reviews_template ON template_reviews(template_id);
CREATE INDEX idx_template_reviews_rating ON template_reviews(template_id, rating);

-- Function to update template rating average
CREATE OR REPLACE FUNCTION update_template_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_templates
  SET 
    rating_avg = (SELECT AVG(rating)::DECIMAL(3,2) FROM template_reviews WHERE template_id = NEW.template_id AND is_visible = TRUE),
    rating_count = (SELECT COUNT(*) FROM template_reviews WHERE template_id = NEW.template_id AND is_visible = TRUE)
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER template_review_rating_update
  AFTER INSERT OR UPDATE ON template_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_template_rating();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_marketplace_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER marketplace_templates_updated_at
  BEFORE UPDATE ON marketplace_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_marketplace_templates_updated_at();

-- RLS Policies
ALTER TABLE marketplace_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved templates
CREATE POLICY "Anyone can view approved marketplace templates"
  ON marketplace_templates FOR SELECT
  USING (status = 'approved' OR workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- Creators can manage their own templates
CREATE POLICY "Creators can manage their templates"
  ON marketplace_templates FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

ALTER TABLE template_acquisitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their acquisitions"
  ON template_acquisitions FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can acquire templates"
  ON template_acquisitions FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE template_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible reviews"
  ON template_reviews FOR SELECT
  USING (is_visible = TRUE);

CREATE POLICY "Users can create reviews for acquired templates"
  ON template_reviews FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own reviews"
  ON template_reviews FOR UPDATE
  USING (user_id = auth.uid());
