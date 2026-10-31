-- ============================================================================
-- Share Links with Analytics (Phase 6.3)
-- Enhanced share links with view tracking and analytics
-- ============================================================================

-- Extend existing share_tokens table if it exists, or create new one
CREATE TABLE IF NOT EXISTS share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Token
  token TEXT NOT NULL UNIQUE,
  
  -- Access control
  expires_at TIMESTAMPTZ,
  password_hash TEXT, -- Optional password protection
  allowed_emails TEXT[] DEFAULT '{}', -- Restrict to specific emails
  max_views INT, -- Optional view limit
  
  -- Tracking settings
  view_tracking BOOLEAN DEFAULT TRUE,
  collect_email BOOLEAN DEFAULT FALSE, -- Prompt for email on view
  
  -- Content settings
  show_claims BOOLEAN DEFAULT TRUE,
  show_evidence BOOLEAN DEFAULT TRUE,
  show_analytics BOOLEAN DEFAULT FALSE,
  allow_comments BOOLEAN DEFAULT FALSE,
  
  -- Branding
  custom_title TEXT,
  custom_message TEXT,
  hide_sako_branding BOOLEAN DEFAULT FALSE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  last_viewed_at TIMESTAMPTZ
);

-- Add columns if table exists
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS view_tracking BOOLEAN DEFAULT TRUE;
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS allowed_emails TEXT[] DEFAULT '{}';
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS max_views INT;
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS collect_email BOOLEAN DEFAULT FALSE;
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS show_claims BOOLEAN DEFAULT TRUE;
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS show_evidence BOOLEAN DEFAULT TRUE;
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS show_analytics BOOLEAN DEFAULT FALSE;
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT FALSE;
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS custom_title TEXT;
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS custom_message TEXT;
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS hide_sako_branding BOOLEAN DEFAULT FALSE;
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

-- Share view tracking
CREATE TABLE share_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token_id UUID NOT NULL REFERENCES share_tokens(id) ON DELETE CASCADE,
  
  -- Viewer info
  viewer_ip TEXT,
  viewer_user_agent TEXT,
  viewer_email TEXT, -- If collected
  
  -- Session info
  session_id TEXT, -- Track unique sessions
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  
  -- Engagement metrics
  view_duration_seconds INT,
  scroll_depth_percent INT,
  sections_viewed TEXT[] DEFAULT '{}',
  
  -- Device info
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  
  -- Timestamps
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  last_interaction_at TIMESTAMPTZ
);

CREATE INDEX idx_share_views_token ON share_views(share_token_id);
CREATE INDEX idx_share_views_session ON share_views(session_id);
CREATE INDEX idx_share_views_time ON share_views(share_token_id, viewed_at);

-- Share link comments (if enabled)
CREATE TABLE share_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token_id UUID NOT NULL REFERENCES share_tokens(id) ON DELETE CASCADE,
  
  -- Comment content
  content TEXT NOT NULL,
  section_id TEXT, -- Which section the comment is on
  
  -- Commenter info
  commenter_name TEXT,
  commenter_email TEXT,
  
  -- Status
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  
  -- Threading
  parent_comment_id UUID REFERENCES share_comments(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_share_comments_token ON share_comments(share_token_id);
CREATE INDEX idx_share_comments_section ON share_comments(share_token_id, section_id);

-- Function to update last_viewed_at and check view limits
CREATE OR REPLACE FUNCTION record_share_view(
  p_token TEXT,
  p_viewer_ip TEXT DEFAULT NULL,
  p_viewer_email TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_share_token RECORD;
  v_view_count INT;
BEGIN
  -- Get share token
  SELECT * INTO v_share_token FROM share_tokens WHERE token = p_token;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Token not found', 'allowed', FALSE);
  END IF;
  
  -- Check if active
  IF NOT v_share_token.is_active THEN
    RETURN jsonb_build_object('error', 'Link is no longer active', 'allowed', FALSE);
  END IF;
  
  -- Check expiration
  IF v_share_token.expires_at IS NOT NULL AND v_share_token.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'Link has expired', 'allowed', FALSE);
  END IF;
  
  -- Check view limit
  IF v_share_token.max_views IS NOT NULL THEN
    SELECT COUNT(*) INTO v_view_count FROM share_views WHERE share_token_id = v_share_token.id;
    IF v_view_count >= v_share_token.max_views THEN
      RETURN jsonb_build_object('error', 'View limit reached', 'allowed', FALSE);
    END IF;
  END IF;
  
  -- Check email restriction
  IF array_length(v_share_token.allowed_emails, 1) > 0 THEN
    IF p_viewer_email IS NULL OR NOT (p_viewer_email = ANY(v_share_token.allowed_emails)) THEN
      RETURN jsonb_build_object('error', 'Access restricted', 'allowed', FALSE, 'requires_email', TRUE);
    END IF;
  END IF;
  
  -- Record view if tracking enabled
  IF v_share_token.view_tracking THEN
    INSERT INTO share_views (share_token_id, viewer_ip, viewer_email, session_id)
    VALUES (v_share_token.id, p_viewer_ip, p_viewer_email, p_session_id);
  END IF;
  
  -- Update last viewed
  UPDATE share_tokens SET last_viewed_at = NOW() WHERE id = v_share_token.id;
  
  RETURN jsonb_build_object(
    'allowed', TRUE,
    'campaign_id', v_share_token.campaign_id,
    'settings', jsonb_build_object(
      'show_claims', v_share_token.show_claims,
      'show_evidence', v_share_token.show_evidence,
      'show_analytics', v_share_token.show_analytics,
      'allow_comments', v_share_token.allow_comments,
      'custom_title', v_share_token.custom_title,
      'custom_message', v_share_token.custom_message,
      'hide_branding', v_share_token.hide_sako_branding,
      'collect_email', v_share_token.collect_email
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view share tokens in their workspace"
  ON share_tokens FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create share tokens in their workspace"
  ON share_tokens FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update share tokens in their workspace"
  ON share_tokens FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete share tokens in their workspace"
  ON share_tokens FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE share_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analytics for their share tokens"
  ON share_views FOR SELECT
  USING (
    share_token_id IN (
      SELECT id FROM share_tokens WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

ALTER TABLE share_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments on shares they can access"
  ON share_comments FOR SELECT
  USING (TRUE); -- Public for shared links

CREATE POLICY "Anyone can add comments if allowed"
  ON share_comments FOR INSERT
  WITH CHECK (
    share_token_id IN (SELECT id FROM share_tokens WHERE allow_comments = TRUE AND is_active = TRUE)
  );
