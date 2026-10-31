-- Migration: 045_newsletters.sql
-- Newsletter generation and storage

CREATE TABLE IF NOT EXISTS newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  
  -- Topic and targeting
  topic TEXT NOT NULL,
  audience TEXT,
  tone TEXT DEFAULT 'professional',
  goal TEXT DEFAULT 'engagement',
  
  -- Generated content
  subject_lines TEXT[],
  preheaders TEXT[],
  content JSONB NOT NULL,
  -- content structure:
  -- {
  --   headline: string,
  --   introduction: string,
  --   mainContent: string[],
  --   bulletPoints: string[],
  --   cta: { text: string, url: string },
  --   signoff: string
  -- }
  
  -- Design variants
  designs JSONB DEFAULT '[]',
  -- designs structure:
  -- [{
  --   id: string,
  --   style: 'minimal' | 'bold' | 'classic',
  --   subject: string,
  --   preheader: string,
  --   colorScheme: {...},
  --   typography: {...}
  -- }]
  
  -- Compliance
  claims TEXT[],
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'archived')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  
  -- Tracking
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS newsletters_workspace_idx ON newsletters(workspace_id);
CREATE INDEX IF NOT EXISTS newsletters_status_idx ON newsletters(status);
CREATE INDEX IF NOT EXISTS newsletters_created_at_idx ON newsletters(created_at DESC);

-- Enable RLS
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view newsletters in their workspace"
ON newsletters FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = newsletters.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert newsletters in their workspace"
ON newsletters FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = newsletters.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update newsletters in their workspace"
ON newsletters FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = newsletters.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete newsletters in their workspace"
ON newsletters FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = newsletters.workspace_id
    AND wm.user_id = auth.uid()
  )
);

-- Trigger to update updated_at
CREATE TRIGGER newsletters_updated_at
BEFORE UPDATE ON newsletters
FOR EACH ROW
EXECUTE FUNCTION update_project_pages_updated_at();
