-- Newsletter Templates Migration
-- Store and manage newsletter design templates

-- Newsletter templates table
CREATE TABLE IF NOT EXISTS newsletter_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom', -- 'product', 'announcement', 'promotional', 'educational', 'seasonal', 'welcome', 'digest', 'custom'
  thumbnail_url TEXT,
  subject_template TEXT,
  preheader_template TEXT,
  sections JSONB NOT NULL DEFAULT '[]', -- Array of section configs
  color_scheme JSONB NOT NULL DEFAULT '{}',
  typography JSONB NOT NULL DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_newsletter_templates_workspace ON newsletter_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_templates_category ON newsletter_templates(category);
CREATE INDEX IF NOT EXISTS idx_newsletter_templates_public ON newsletter_templates(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_newsletter_templates_featured ON newsletter_templates(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_newsletter_templates_tags ON newsletter_templates USING gin(tags);

-- Full text search on name and description
CREATE INDEX IF NOT EXISTS idx_newsletter_templates_search ON newsletter_templates
  USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));

-- Saved newsletters (user's generated newsletters)
CREATE TABLE IF NOT EXISTS saved_newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  template_id UUID REFERENCES newsletter_templates(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preheader TEXT,
  content JSONB NOT NULL, -- Full newsletter content including sections
  html_content TEXT, -- Rendered HTML
  status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'sent'
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  recipient_count INTEGER,
  open_rate DECIMAL(5,2),
  click_rate DECIMAL(5,2),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_newsletters_workspace ON saved_newsletters(workspace_id);
CREATE INDEX IF NOT EXISTS idx_saved_newsletters_status ON saved_newsletters(status);
CREATE INDEX IF NOT EXISTS idx_saved_newsletters_campaign ON saved_newsletters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_saved_newsletters_scheduled ON saved_newsletters(scheduled_at) WHERE status = 'scheduled';

-- Newsletter A/B tests
CREATE TABLE IF NOT EXISTS newsletter_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  newsletter_id UUID NOT NULL REFERENCES saved_newsletters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variant_a JSONB NOT NULL, -- Subject, preheader, or content variant
  variant_b JSONB NOT NULL,
  test_type TEXT NOT NULL, -- 'subject', 'preheader', 'content', 'design'
  sample_size_percent INTEGER DEFAULT 20, -- % of audience for test
  winner_metric TEXT DEFAULT 'open_rate', -- 'open_rate', 'click_rate'
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed'
  winner TEXT, -- 'a' or 'b'
  variant_a_stats JSONB DEFAULT '{}',
  variant_b_stats JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_ab_tests_newsletter ON newsletter_ab_tests(newsletter_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_ab_tests_status ON newsletter_ab_tests(status);

-- RLS Policies
ALTER TABLE newsletter_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_ab_tests ENABLE ROW LEVEL SECURITY;

-- Newsletter templates: View workspace or public
CREATE POLICY "Users can view newsletter templates" ON newsletter_templates
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    OR is_public = true
  );

-- Newsletter templates: Create in workspace
CREATE POLICY "Users can create newsletter templates" ON newsletter_templates
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Newsletter templates: Update own
CREATE POLICY "Users can update their newsletter templates" ON newsletter_templates
  FOR UPDATE USING (created_by = auth.uid());

-- Newsletter templates: Delete own
CREATE POLICY "Users can delete their newsletter templates" ON newsletter_templates
  FOR DELETE USING (created_by = auth.uid());

-- Saved newsletters: Workspace access
CREATE POLICY "Users can view saved newsletters in workspace" ON saved_newsletters
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create saved newsletters" ON saved_newsletters
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update saved newsletters in workspace" ON saved_newsletters
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their saved newsletters" ON saved_newsletters
  FOR DELETE USING (created_by = auth.uid());

-- Newsletter A/B tests: Workspace access
CREATE POLICY "Users can view newsletter ab tests" ON newsletter_ab_tests
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage newsletter ab tests" ON newsletter_ab_tests
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_newsletter_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER newsletter_templates_updated_at
  BEFORE UPDATE ON newsletter_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_newsletter_templates_updated_at();

CREATE OR REPLACE FUNCTION update_saved_newsletters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saved_newsletters_updated_at
  BEFORE UPDATE ON saved_newsletters
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_newsletters_updated_at();

-- Increment template usage
CREATE OR REPLACE FUNCTION increment_newsletter_template_usage(template_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE newsletter_templates SET usage_count = usage_count + 1 WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;
