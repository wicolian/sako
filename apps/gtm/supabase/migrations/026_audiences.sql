-- ============================================================================
-- Audiences Feature (Phase 1.5)
-- Structured customer segment profiles for targeted messaging
-- "One brand, many voices" - Jasper-style audience management
-- ============================================================================

CREATE TABLE audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Core identity
  name TEXT NOT NULL, -- "Enterprise CTO", "SMB Marketing Manager"
  title TEXT, -- Job title: "Chief Technology Officer"
  description TEXT, -- Detailed description of this persona
  
  -- Demographics
  seniority TEXT, -- 'C-Level', 'VP', 'Director', 'Manager', 'IC', 'Entry'
  department TEXT, -- 'Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'
  company_size TEXT, -- 'Enterprise', 'Mid-Market', 'SMB', 'Startup'
  industry TEXT,
  
  -- Psychology & Behavior
  pain_points TEXT[] DEFAULT '{}',
  goals TEXT[] DEFAULT '{}',
  buying_triggers TEXT[] DEFAULT '{}',
  objections TEXT[] DEFAULT '{}',
  decision_criteria TEXT[] DEFAULT '{}',
  
  -- Communication style
  language_style TEXT DEFAULT 'professional', -- 'technical', 'business', 'casual', 'formal', 'friendly'
  jargon_level TEXT DEFAULT 'moderate', -- 'none', 'light', 'moderate', 'heavy'
  formality_level TEXT DEFAULT 'professional', -- 'casual', 'professional', 'formal', 'executive'
  
  -- Tone adjustments (JSONB for flexibility)
  tone_adjustments JSONB DEFAULT '{}', -- {"urgency": "low", "emotion": "moderate", "data_driven": true}
  
  -- Content preferences
  preferred_content_types TEXT[] DEFAULT '{}', -- ['case_study', 'whitepaper', 'demo', 'roi_calculator']
  preferred_channels TEXT[] DEFAULT '{}', -- ['email', 'linkedin', 'webinar', 'direct_mail']
  
  -- Additional context
  demographic_notes TEXT,
  competitive_context TEXT, -- What alternatives are they considering
  success_metrics TEXT, -- What does success look like for them
  
  -- Status
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one primary audience per workspace
CREATE UNIQUE INDEX idx_audiences_workspace_primary 
  ON audiences(workspace_id) 
  WHERE is_primary = TRUE;

-- General indexes
CREATE INDEX idx_audiences_workspace ON audiences(workspace_id);
CREATE INDEX idx_audiences_active ON audiences(workspace_id) WHERE is_active = TRUE;

-- Campaign-Audience relationship (campaigns can target specific audiences)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience_id UUID REFERENCES audiences(id) ON DELETE SET NULL;
CREATE INDEX idx_campaigns_audience ON campaigns(audience_id) WHERE audience_id IS NOT NULL;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_audiences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audiences_updated_at
  BEFORE UPDATE ON audiences
  FOR EACH ROW
  EXECUTE FUNCTION update_audiences_updated_at();

-- RLS Policies
ALTER TABLE audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audiences in their workspace"
  ON audiences FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create audiences in their workspace"
  ON audiences FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update audiences in their workspace"
  ON audiences FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete audiences in their workspace"
  ON audiences FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );
