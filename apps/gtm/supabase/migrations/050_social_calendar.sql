-- Social Content Calendar Migration
-- Phase 2.3: Social content calendar with 3-month generation

-- Social calendars table
CREATE TABLE IF NOT EXISTS social_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  
  -- Date range
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Configuration
  platforms TEXT[] DEFAULT '{}',
  content_pillars JSONB DEFAULT '[]',
  posting_frequency JSONB DEFAULT '{}',
  optimal_times JSONB DEFAULT '{}',
  
  -- Posts stored as JSONB array
  posts JSONB DEFAULT '[]',
  
  -- Stats
  total_posts INTEGER DEFAULT 0,
  scheduled_posts INTEGER DEFAULT 0,
  published_posts INTEGER DEFAULT 0,
  
  -- Meta
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual posts table for more granular control
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID REFERENCES social_calendars(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  
  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  platform TEXT NOT NULL,
  
  -- Content
  content_type TEXT NOT NULL, -- image, video, carousel, story, reel, text
  theme TEXT,
  caption TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  call_to_action TEXT,
  visual_direction TEXT,
  
  -- Media
  media_urls TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  
  -- Publishing
  status TEXT DEFAULT 'draft', -- draft, scheduled, publishing, published, failed
  published_at TIMESTAMPTZ,
  publish_error TEXT,
  external_post_id TEXT, -- ID from the platform after publishing
  external_post_url TEXT,
  
  -- Engagement metrics (updated after publishing)
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  
  -- Meta
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_social_calendars_workspace ON social_calendars(workspace_id);
CREATE INDEX IF NOT EXISTS idx_social_calendars_brand ON social_calendars(brand_id);
CREATE INDEX IF NOT EXISTS idx_social_calendars_dates ON social_calendars(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_social_posts_calendar ON social_posts(calendar_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_workspace ON social_posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_schedule ON social_posts(scheduled_date, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);

-- RLS Policies
ALTER TABLE social_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

-- Calendars: workspace members can view
CREATE POLICY "Workspace members can view calendars"
  ON social_calendars FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = social_calendars.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Calendars: workspace members can create
CREATE POLICY "Workspace members can create calendars"
  ON social_calendars FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = social_calendars.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Calendars: workspace members can update
CREATE POLICY "Workspace members can update calendars"
  ON social_calendars FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = social_calendars.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Calendars: workspace admins can delete
CREATE POLICY "Workspace admins can delete calendars"
  ON social_calendars FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = social_calendars.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

-- Posts: same policies
CREATE POLICY "Workspace members can view posts"
  ON social_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = social_posts.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can create posts"
  ON social_posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = social_posts.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can update posts"
  ON social_posts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = social_posts.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can delete posts"
  ON social_posts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = social_posts.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

-- Function to update calendar stats
CREATE OR REPLACE FUNCTION update_calendar_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE social_calendars
  SET 
    total_posts = (
      SELECT COUNT(*) FROM social_posts 
      WHERE calendar_id = COALESCE(NEW.calendar_id, OLD.calendar_id)
    ),
    scheduled_posts = (
      SELECT COUNT(*) FROM social_posts 
      WHERE calendar_id = COALESCE(NEW.calendar_id, OLD.calendar_id)
      AND status = 'scheduled'
    ),
    published_posts = (
      SELECT COUNT(*) FROM social_posts 
      WHERE calendar_id = COALESCE(NEW.calendar_id, OLD.calendar_id)
      AND status = 'published'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.calendar_id, OLD.calendar_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for calendar stats
DROP TRIGGER IF EXISTS trigger_update_calendar_stats ON social_posts;
CREATE TRIGGER trigger_update_calendar_stats
  AFTER INSERT OR UPDATE OR DELETE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_stats();
