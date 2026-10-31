-- Campaign Assets Migration (Jan 2026)
-- Multi-asset campaign support: landing pages, social posts, decks, emails, videos

-- Campaign assets table
CREATE TABLE campaign_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Asset type and format
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'landing_page', 'social_post', 'deck', 'email', 
    'video_script', 'voiceover', 'video', 'ad_creative', 
    'one_pager', 'talk_track'
  )),
  format TEXT, -- linkedin, twitter, instagram, facebook, 16:9, 9:16, 1:1, pptx, etc.
  
  -- Content
  content JSONB NOT NULL DEFAULT '{}', -- Asset-specific structured content
  html TEXT, -- Rendered HTML if applicable
  markdown TEXT, -- Markdown content if applicable
  
  -- Media
  media_url TEXT, -- URL to generated media (video, audio, images)
  thumbnail_url TEXT, -- Preview thumbnail
  
  -- Validation
  claims_validated BOOLEAN DEFAULT false,
  claim_ids UUID[] DEFAULT '{}', -- Claims used in this asset
  compliance_score INTEGER,
  
  -- Status and versioning
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewing', 'approved', 'published', 'archived')),
  version INTEGER DEFAULT 1,
  parent_asset_id UUID REFERENCES campaign_assets(id), -- For versioning
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  generated_by TEXT, -- AI model used
  generation_prompt TEXT, -- Original prompt
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_campaign_assets_campaign ON campaign_assets(campaign_id);
CREATE INDEX idx_campaign_assets_workspace ON campaign_assets(workspace_id);
CREATE INDEX idx_campaign_assets_type ON campaign_assets(asset_type);
CREATE INDEX idx_campaign_assets_status ON campaign_assets(status);
CREATE INDEX idx_campaign_assets_created ON campaign_assets(created_at DESC);

-- Enable RLS
ALTER TABLE campaign_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view assets in their workspace" ON campaign_assets
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create assets in their workspace" ON campaign_assets
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update assets in their workspace" ON campaign_assets
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete assets in their workspace" ON campaign_assets
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Social post variants table (for A/B testing)
CREATE TABLE social_post_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES campaign_assets(id) ON DELETE CASCADE,
  
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'twitter', 'facebook', 'instagram', 'tiktok')),
  variant_label TEXT DEFAULT 'A', -- A, B, C for variants
  
  -- Content
  content TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  character_count INTEGER,
  
  -- Media
  image_prompt TEXT, -- AI prompt for image generation
  image_url TEXT, -- Generated or uploaded image
  image_sizes TEXT[] DEFAULT '{}', -- e.g., ['1200x628', '1080x1080']
  
  -- Thread support (for Twitter/X)
  is_thread BOOLEAN DEFAULT false,
  thread_parts TEXT[] DEFAULT '{}',
  
  -- Performance (after publishing)
  impressions INTEGER DEFAULT 0,
  engagements INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_social_variants_asset ON social_post_variants(asset_id);
CREATE INDEX idx_social_variants_platform ON social_post_variants(platform);

ALTER TABLE social_post_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage social variants through parent asset" ON social_post_variants
  FOR ALL USING (
    asset_id IN (
      SELECT id FROM campaign_assets WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Deck slides table
CREATE TABLE deck_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES campaign_assets(id) ON DELETE CASCADE,
  
  slide_order INTEGER NOT NULL,
  slide_type TEXT NOT NULL CHECK (slide_type IN (
    'title', 'problem', 'solution', 'features', 'proof', 
    'comparison', 'pricing', 'cta', 'quote', 'stats', 'blank'
  )),
  
  -- Content
  headline TEXT,
  subheadline TEXT,
  bullets TEXT[] DEFAULT '{}',
  speaker_notes TEXT,
  
  -- Visual
  layout TEXT DEFAULT 'default', -- title, bullets, split, image, comparison
  visual_suggestion TEXT, -- AI suggestion for imagery
  image_url TEXT,
  
  -- Claims on this slide
  claim_ids UUID[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deck_slides_asset ON deck_slides(asset_id);
CREATE INDEX idx_deck_slides_order ON deck_slides(asset_id, slide_order);

ALTER TABLE deck_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage slides through parent asset" ON deck_slides
  FOR ALL USING (
    asset_id IN (
      SELECT id FROM campaign_assets WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Video scripts table
CREATE TABLE video_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES campaign_assets(id) ON DELETE CASCADE,
  
  format TEXT NOT NULL CHECK (format IN ('16:9', '9:16', '1:1')),
  style TEXT DEFAULT 'explainer' CHECK (style IN ('explainer', 'testimonial', 'product', 'brand', 'announcement')),
  total_duration INTEGER, -- seconds
  
  -- Full script
  voiceover_text TEXT, -- Complete narration
  music_mood TEXT, -- Background music suggestion
  
  -- Metadata
  estimated_cost DECIMAL(10,2), -- Estimated production cost
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_scripts_asset ON video_scripts(asset_id);

ALTER TABLE video_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage scripts through parent asset" ON video_scripts
  FOR ALL USING (
    asset_id IN (
      SELECT id FROM campaign_assets WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Video scenes table
CREATE TABLE video_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID REFERENCES video_scripts(id) ON DELETE CASCADE,
  
  scene_order INTEGER NOT NULL,
  duration INTEGER NOT NULL, -- seconds
  
  -- Content
  narration TEXT NOT NULL, -- What's spoken
  visual_direction TEXT, -- What's shown
  text_overlay TEXT, -- On-screen text
  
  -- B-roll
  broll_keywords TEXT[] DEFAULT '{}', -- Stock footage search terms
  broll_url TEXT, -- Selected footage URL
  
  -- Transition
  transition TEXT DEFAULT 'cut' CHECK (transition IN ('cut', 'fade', 'slide', 'zoom', 'wipe')),
  
  -- Claims
  claim_ids UUID[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_scenes_script ON video_scenes(script_id);
CREATE INDEX idx_video_scenes_order ON video_scenes(script_id, scene_order);

ALTER TABLE video_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage scenes through parent script" ON video_scenes
  FOR ALL USING (
    script_id IN (
      SELECT vs.id FROM video_scripts vs
      JOIN campaign_assets ca ON vs.asset_id = ca.id
      WHERE ca.workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Voiceovers table
CREATE TABLE voiceovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID REFERENCES video_scripts(id) ON DELETE CASCADE,
  
  -- Voice settings
  provider TEXT DEFAULT 'elevenlabs' CHECK (provider IN ('elevenlabs', 'playht', 'openai', 'google')),
  voice_id TEXT NOT NULL,
  voice_name TEXT,
  
  -- Audio
  audio_url TEXT NOT NULL, -- Supabase Storage URL
  duration INTEGER, -- seconds
  
  -- Settings used
  speed DECIMAL(3,2) DEFAULT 1.0,
  stability DECIMAL(3,2),
  similarity_boost DECIMAL(3,2),
  
  -- Cost tracking
  character_count INTEGER,
  cost DECIMAL(10,4),
  
  -- Per-scene segments
  segments JSONB DEFAULT '[]', -- [{sceneId, audioUrl, startTime, duration}]
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voiceovers_script ON voiceovers(script_id);

ALTER TABLE voiceovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage voiceovers through parent script" ON voiceovers
  FOR ALL USING (
    script_id IN (
      SELECT vs.id FROM video_scripts vs
      JOIN campaign_assets ca ON vs.asset_id = ca.id
      WHERE ca.workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Assembled videos table
CREATE TABLE assembled_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID REFERENCES video_scripts(id) ON DELETE CASCADE,
  voiceover_id UUID REFERENCES voiceovers(id),
  
  -- Assembly settings
  template_id TEXT, -- Video template used
  include_captions BOOLEAN DEFAULT true,
  
  -- Output
  video_url TEXT, -- Final video URL
  thumbnail_url TEXT,
  format TEXT NOT NULL CHECK (format IN ('16:9', '9:16', '1:1')),
  resolution TEXT DEFAULT '1080p',
  duration INTEGER, -- seconds
  file_size BIGINT, -- bytes
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'rendering', 'complete', 'failed')),
  error_message TEXT,
  render_progress INTEGER DEFAULT 0, -- 0-100
  
  -- Cost
  render_cost DECIMAL(10,4),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_assembled_videos_script ON assembled_videos(script_id);
CREATE INDEX idx_assembled_videos_status ON assembled_videos(status);

ALTER TABLE assembled_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage videos through parent script" ON assembled_videos
  FOR ALL USING (
    script_id IN (
      SELECT vs.id FROM video_scripts vs
      JOIN campaign_assets ca ON vs.asset_id = ca.id
      WHERE ca.workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers
CREATE TRIGGER update_campaign_assets_updated_at
  BEFORE UPDATE ON campaign_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE campaign_assets IS 'Multi-asset campaign content: landing pages, social posts, decks, videos, etc.';
COMMENT ON TABLE social_post_variants IS 'Platform-specific social post variants with A/B testing support';
COMMENT ON TABLE deck_slides IS 'Individual slides for sales deck assets';
COMMENT ON TABLE video_scripts IS 'Video script metadata and full voiceover text';
COMMENT ON TABLE video_scenes IS 'Individual scenes within a video script';
COMMENT ON TABLE voiceovers IS 'Generated voiceover audio files';
COMMENT ON TABLE assembled_videos IS 'Final rendered video files';
