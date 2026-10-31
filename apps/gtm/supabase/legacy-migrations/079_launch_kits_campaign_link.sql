CREATE TABLE IF NOT EXISTS launch_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id),
  brief JSONB NOT NULL,
  status TEXT DEFAULT 'generating',
  assets JSONB DEFAULT '{
    "landingPage": null,
    "ads": [],
    "emails": null,
    "socialPosts": [],
    "deck": null
  }',
  compliance JSONB DEFAULT '{
    "totalClaims": 0,
    "approved": 0,
    "needsReview": 0,
    "blocked": 0,
    "averageRiskScore": 0
  }',
  angles JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  exported_at TIMESTAMPTZ,
  CONSTRAINT launch_kits_status_check CHECK (status IN ('generating', 'review', 'approved', 'exported'))
);

ALTER TABLE launch_kits
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION update_launch_kits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS launch_kits_updated_at ON launch_kits;

CREATE TRIGGER launch_kits_updated_at
  BEFORE UPDATE ON launch_kits
  FOR EACH ROW
  EXECUTE FUNCTION update_launch_kits_updated_at();

CREATE INDEX IF NOT EXISTS launch_kits_workspace ON launch_kits(workspace_id);
CREATE INDEX IF NOT EXISTS launch_kits_brand ON launch_kits(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS launch_kits_status ON launch_kits(workspace_id, status);
CREATE INDEX IF NOT EXISTS launch_kits_created ON launch_kits(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS launch_kits_campaign_id_key
  ON launch_kits(campaign_id)
  WHERE campaign_id IS NOT NULL;

UPDATE campaigns
SET status = 'failed'
WHERE status IN ('partial', 'error');

ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS valid_status;

ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('draft', 'generating', 'ready', 'published', 'running', 'archived', 'failed'));
