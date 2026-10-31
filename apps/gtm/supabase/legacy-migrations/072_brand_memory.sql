-- ============================================================================
-- 072: Brand Memory
-- ============================================================================
-- Persistent brand knowledge with confidence scoring and provenance tracking.
-- Supports URL import, manual creation, and reverse-import learning.
-- ============================================================================

CREATE TABLE IF NOT EXISTS brand_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Tokens with confidence
  colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{value, format: 'oklch', role: 'primary', confidence: 0.95, source: 'meta-theme'}]

  fonts jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{family, weight, role: 'body', confidence: 0.8, source: 'computed-style'}]

  spacing jsonb DEFAULT '{}'::jsonb,
  -- {base: 8, scale: [8,16,24,32,48,64], source: 'css-analysis'}

  components jsonb DEFAULT '[]'::jsonb,
  -- [{type: 'button', style: 'rounded-full', colors: {...}}]

  -- Voice
  tone jsonb DEFAULT '{}'::jsonb,
  -- {formality: 0.7, energy: 0.5, humor: 0.2}

  banned_terms text[] DEFAULT '{}',
  preferred_terms text[] DEFAULT '{}',
  key_messages text[] DEFAULT '{}',

  -- Logos/Assets
  logo_urls text[] DEFAULT '{}',
  icon_urls text[] DEFAULT '{}',

  -- Provenance
  sources jsonb DEFAULT '[]'::jsonb,
  -- [{type: 'url_import', url, date, confidence}]

  version integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_memory_brand ON brand_memory(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_memory_workspace ON brand_memory(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_memory_unique ON brand_memory(brand_id, workspace_id);

-- RLS
ALTER TABLE brand_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view brand memory in their workspace"
  ON brand_memory FOR SELECT
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert brand memory in their workspace"
  ON brand_memory FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can update brand memory in their workspace"
  ON brand_memory FOR UPDATE
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER trg_brand_memory_updated_at
  BEFORE UPDATE ON brand_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_documents_updated_at();
