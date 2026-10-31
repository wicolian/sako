-- ============================================================================
-- Migration: Billing System
-- 
-- Full subscription management schema:
-- - Subscriptions table
-- - Cancellation feedback
-- - Share links for published sites
-- ============================================================================

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete', 'trialing', 'unpaid'))
);

-- Unique constraint: one subscription per workspace
CREATE UNIQUE INDEX idx_subscriptions_workspace ON subscriptions(workspace_id) WHERE status != 'canceled';

-- Index for Stripe lookups
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_customer ON subscriptions(stripe_customer_id);

-- Cancellation feedback for analytics
CREATE TABLE IF NOT EXISTS cancellation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_reason CHECK (reason IN (
    'too_expensive',
    'missing_features',
    'switched_competitor',
    'not_using',
    'temporary_pause',
    'other'
  ))
);

CREATE INDEX idx_cancellation_feedback_workspace ON cancellation_feedback(workspace_id);
CREATE INDEX idx_cancellation_feedback_reason ON cancellation_feedback(reason);

-- Published sites table
CREATE TABLE IF NOT EXISTS published_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID NOT NULL REFERENCES website_designs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  subdomain TEXT NOT NULL UNIQUE,
  custom_domain TEXT UNIQUE,
  full_url TEXT NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending',
  ssl_status TEXT NOT NULL DEFAULT 'pending',
  
  is_password_protected BOOLEAN DEFAULT FALSE,
  password_hash TEXT,
  
  version INTEGER DEFAULT 1,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  
  view_count INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'provisioning', 'active', 'error')),
  CONSTRAINT valid_ssl_status CHECK (ssl_status IN ('pending', 'provisioning', 'active', 'error'))
);

CREATE INDEX idx_published_sites_design ON published_sites(design_id);
CREATE INDEX idx_published_sites_workspace ON published_sites(workspace_id);
CREATE INDEX idx_published_sites_subdomain ON published_sites(subdomain);

-- Share links for private site sharing
CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES published_sites(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  max_views INTEGER,
  view_count INTEGER DEFAULT 0,
  is_password_protected BOOLEAN DEFAULT FALSE,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_share_links_site ON share_links(site_id);
CREATE INDEX idx_share_links_code ON share_links(code);

-- Templates table for marketplace
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  thumbnail_url TEXT,
  preview_url TEXT,
  
  tier TEXT NOT NULL DEFAULT 'free',
  price INTEGER, -- In cents for paid templates
  
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_name TEXT,
  creator_avatar TEXT,
  
  structure JSONB NOT NULL DEFAULT '{}',
  
  usage_count INTEGER DEFAULT 0,
  rating NUMERIC(2,1),
  review_count INTEGER DEFAULT 0,
  
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_new BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_tier CHECK (tier IN ('free', 'pro', 'paid'))
);

CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_tier ON templates(tier);
CREATE INDEX idx_templates_creator ON templates(creator_id);
CREATE INDEX idx_templates_featured ON templates(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_templates_public ON templates(is_public) WHERE is_public = TRUE;

-- Template purchases for paid templates
CREATE TABLE IF NOT EXISTS template_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_intent_id TEXT,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(template_id, user_id)
);

CREATE INDEX idx_template_purchases_user ON template_purchases(user_id);
CREATE INDEX idx_template_purchases_template ON template_purchases(template_id);

-- Function to increment site views
CREATE OR REPLACE FUNCTION increment_site_views(site_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE published_sites
  SET view_count = view_count + 1
  WHERE id = site_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment template usage
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE templates
  SET usage_count = usage_count + 1
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment snippet usage
CREATE OR REPLACE FUNCTION increment_snippet_usage(snippet_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE snippets
  SET usage_count = usage_count + 1
  WHERE id = snippet_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_purchases ENABLE ROW LEVEL SECURITY;

-- Subscriptions: workspace members can view, owners can manage
CREATE POLICY "Workspace members can view subscriptions"
  ON subscriptions FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owners can manage subscriptions"
  ON subscriptions FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Cancellation feedback: owners can insert
CREATE POLICY "Workspace owners can submit cancellation feedback"
  ON cancellation_feedback FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Published sites: workspace members can view and manage
CREATE POLICY "Workspace members can view published sites"
  ON published_sites FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can manage published sites"
  ON published_sites FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

-- Share links: site owners can manage
CREATE POLICY "Site owners can manage share links"
  ON share_links FOR ALL
  USING (
    site_id IN (
      SELECT ps.id FROM published_sites ps
      JOIN workspace_members wm ON ps.workspace_id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

-- Templates: public templates visible to all, creators can manage their own
CREATE POLICY "Anyone can view public templates"
  ON templates FOR SELECT
  USING (is_public = TRUE);

CREATE POLICY "Creators can manage their templates"
  ON templates FOR ALL
  USING (creator_id = auth.uid());

-- Template purchases: users can view their own
CREATE POLICY "Users can view their template purchases"
  ON template_purchases FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their template purchases"
  ON template_purchases FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Add subdomain column to website_designs if not exists
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_designs' AND column_name = 'subdomain'
  ) THEN
    ALTER TABLE website_designs ADD COLUMN subdomain TEXT UNIQUE;
    ALTER TABLE website_designs ADD COLUMN custom_domain TEXT UNIQUE;
    ALTER TABLE website_designs ADD COLUMN published_url TEXT;
    ALTER TABLE website_designs ADD COLUMN published_at TIMESTAMPTZ;
  END IF;
END $$;
