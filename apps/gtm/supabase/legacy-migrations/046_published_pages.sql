-- Migration: 046_published_pages.sql
-- Published pages for subdomain hosting

CREATE TABLE IF NOT EXISTS published_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  page_id UUID REFERENCES project_pages(id) ON DELETE SET NULL,
  
  -- URL
  slug TEXT NOT NULL UNIQUE,
  custom_domain TEXT,
  
  -- Content
  title TEXT NOT NULL,
  description TEXT,
  html TEXT NOT NULL,
  css TEXT,
  og_image TEXT,
  
  -- Security
  is_password_protected BOOLEAN DEFAULT false,
  password_hash TEXT,
  
  -- Analytics
  analytics_enabled BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired')),
  published_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS published_pages_workspace_idx ON published_pages(workspace_id);
CREATE INDEX IF NOT EXISTS published_pages_slug_idx ON published_pages(slug);
CREATE INDEX IF NOT EXISTS published_pages_status_idx ON published_pages(status);

-- Enable RLS
ALTER TABLE published_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workspace members
CREATE POLICY "Users can view published pages in their workspace"
ON published_pages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = published_pages.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert published pages in their workspace"
ON published_pages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = published_pages.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update published pages in their workspace"
ON published_pages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = published_pages.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete published pages in their workspace"
ON published_pages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = published_pages.workspace_id
    AND wm.user_id = auth.uid()
  )
);

-- Public access policy for viewing published pages by slug
CREATE POLICY "Anyone can view active published pages by slug"
ON published_pages FOR SELECT
USING (status = 'active');

-- Page view events for analytics
CREATE TABLE IF NOT EXISTS page_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  published_page_id UUID NOT NULL REFERENCES published_pages(id) ON DELETE CASCADE,
  referrer TEXT,
  user_agent TEXT,
  country TEXT,
  device_type TEXT,
  viewed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_view_events_page_idx ON page_view_events(published_page_id);
CREATE INDEX IF NOT EXISTS page_view_events_viewed_at_idx ON page_view_events(viewed_at DESC);

-- Enable RLS for page view events
ALTER TABLE page_view_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view page events for their published pages"
ON page_view_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM published_pages pp
    JOIN workspace_members wm ON wm.workspace_id = pp.workspace_id
    WHERE pp.id = page_view_events.published_page_id
    AND wm.user_id = auth.uid()
  )
);

-- Allow inserting view events without auth (for tracking)
CREATE POLICY "Anyone can insert page view events"
ON page_view_events FOR INSERT
WITH CHECK (true);

-- Function to increment page view count
CREATE OR REPLACE FUNCTION increment_page_view(page_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE published_pages
  SET view_count = view_count + 1,
      last_viewed_at = now()
  WHERE id = page_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE TRIGGER published_pages_updated_at
BEFORE UPDATE ON published_pages
FOR EACH ROW
EXECUTE FUNCTION update_project_pages_updated_at();
