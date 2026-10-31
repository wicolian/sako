-- Asset Comments Migration
-- Inline commenting on canvas assets with threads and @mentions

-- Comments table
CREATE TABLE IF NOT EXISTS asset_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL,
  parent_id UUID REFERENCES asset_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  position JSONB, -- {x, y} for inline placement on asset
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_asset_comments_project ON asset_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_asset_comments_asset ON asset_comments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_comments_parent ON asset_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_asset_comments_user ON asset_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_comments_workspace ON asset_comments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_asset_comments_resolved ON asset_comments(resolved) WHERE resolved = false;

-- Comment reactions table (for likes, etc.)
CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES asset_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction TEXT NOT NULL, -- 'like', 'heart', 'thumbsup', etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id);

-- Comment notifications table
CREATE TABLE IF NOT EXISTS comment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES asset_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- Who should receive the notification
  type TEXT NOT NULL, -- 'mention', 'reply', 'resolve'
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comment_notifications_user ON comment_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_notifications_unread ON comment_notifications(user_id, read) WHERE read = false;

-- RLS Policies
ALTER TABLE asset_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_notifications ENABLE ROW LEVEL SECURITY;

-- Comments: Users can see comments in their workspace
CREATE POLICY "Users can view comments in their workspace" ON asset_comments
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Comments: Users can create comments in their workspace
CREATE POLICY "Users can create comments in their workspace" ON asset_comments
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Comments: Users can update their own comments
CREATE POLICY "Users can update their own comments" ON asset_comments
  FOR UPDATE USING (user_id = auth.uid());

-- Comments: Users can delete their own comments
CREATE POLICY "Users can delete their own comments" ON asset_comments
  FOR DELETE USING (user_id = auth.uid());

-- Reactions: Users can view reactions in their workspace
CREATE POLICY "Users can view reactions" ON comment_reactions
  FOR SELECT USING (
    comment_id IN (
      SELECT id FROM asset_comments WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Reactions: Users can add reactions
CREATE POLICY "Users can add reactions" ON comment_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Reactions: Users can remove their own reactions
CREATE POLICY "Users can remove their own reactions" ON comment_reactions
  FOR DELETE USING (user_id = auth.uid());

-- Notifications: Users can view their own notifications
CREATE POLICY "Users can view their own notifications" ON comment_notifications
  FOR SELECT USING (user_id = auth.uid());

-- Notifications: System can create notifications (via service role)
CREATE POLICY "System can create notifications" ON comment_notifications
  FOR INSERT WITH CHECK (true);

-- Notifications: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" ON comment_notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_asset_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER asset_comments_updated_at
  BEFORE UPDATE ON asset_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_comments_updated_at();
