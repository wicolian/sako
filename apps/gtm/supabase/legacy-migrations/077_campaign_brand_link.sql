ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_brand
ON campaigns(brand_id)
WHERE brand_id IS NOT NULL;
