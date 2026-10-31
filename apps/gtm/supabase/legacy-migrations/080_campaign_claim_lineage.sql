-- ============================================================================
-- 080: Campaign claim lineage
-- ============================================================================
-- First-class claim linkage between campaigns, asset documents, and messages.
-- Replaces heuristic text matching on campaign pages.
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_claim_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  asset_document_id uuid REFERENCES asset_documents(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'asset_document' CHECK (source IN ('asset_document', 'message', 'import', 'manual')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_claim_links_workspace ON campaign_claim_links(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_claim_links_campaign ON campaign_claim_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_claim_links_claim ON campaign_claim_links(claim_id);
CREATE INDEX IF NOT EXISTS idx_campaign_claim_links_asset_document ON campaign_claim_links(asset_document_id);
CREATE INDEX IF NOT EXISTS idx_campaign_claim_links_message ON campaign_claim_links(message_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_claim_links_unique_asset
  ON campaign_claim_links(claim_id, asset_document_id)
  WHERE asset_document_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_claim_links_unique_message
  ON campaign_claim_links(claim_id, message_id)
  WHERE message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_claim_links_unique_campaign_source
  ON campaign_claim_links(claim_id, campaign_id, source)
  WHERE asset_document_id IS NULL AND message_id IS NULL;

ALTER TABLE campaign_claim_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view claim lineage in their workspace"
  ON campaign_claim_links FOR SELECT
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert claim lineage in their workspace"
  ON campaign_claim_links FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can update claim lineage in their workspace"
  ON campaign_claim_links FOR UPDATE
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete claim lineage in their workspace"
  ON campaign_claim_links FOR DELETE
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));
