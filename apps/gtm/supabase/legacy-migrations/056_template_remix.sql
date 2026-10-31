-- Template Remix and Paid Templates Migration
-- Attribution tracking and monetization for template marketplace

-- Add remix tracking columns to design_templates
ALTER TABLE design_templates 
ADD COLUMN IF NOT EXISTS original_template_id UUID REFERENCES design_templates(id),
ADD COLUMN IF NOT EXISTS remix_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_cents INTEGER, -- null = free
ADD COLUMN IF NOT EXISTS creator_payout_percent INTEGER DEFAULT 70;

-- Create index for remix relationships
CREATE INDEX IF NOT EXISTS idx_design_templates_original ON design_templates(original_template_id);
CREATE INDEX IF NOT EXISTS idx_design_templates_price ON design_templates(price_cents) WHERE price_cents IS NOT NULL;

-- Template purchases table
CREATE TABLE IF NOT EXISTS template_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES design_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_payment_id TEXT,
  stripe_checkout_session_id TEXT,
  amount_cents INTEGER NOT NULL,
  creator_payout_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'refunded'
  purchased_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(template_id, user_id) -- One purchase per user per template
);

CREATE INDEX IF NOT EXISTS idx_template_purchases_user ON template_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_template_purchases_template ON template_purchases(template_id);
CREATE INDEX IF NOT EXISTS idx_template_purchases_status ON template_purchases(status);

-- Creator earnings tracking
CREATE TABLE IF NOT EXISTS creator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES design_templates(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES template_purchases(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'paid'
  payout_id TEXT, -- Stripe payout ID when paid
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator ON creator_earnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_status ON creator_earnings(status);

-- Template remix tree view (for showing attribution chain)
CREATE OR REPLACE VIEW template_remix_tree AS
WITH RECURSIVE remix_chain AS (
  -- Base case: original templates
  SELECT 
    id,
    name,
    original_template_id,
    creator_id,
    remix_count,
    0 as depth,
    ARRAY[id] as path
  FROM design_templates
  WHERE original_template_id IS NULL
  
  UNION ALL
  
  -- Recursive case: remixes
  SELECT 
    t.id,
    t.name,
    t.original_template_id,
    t.creator_id,
    t.remix_count,
    rc.depth + 1,
    rc.path || t.id
  FROM design_templates t
  JOIN remix_chain rc ON t.original_template_id = rc.id
  WHERE NOT t.id = ANY(rc.path) -- Prevent cycles
)
SELECT * FROM remix_chain;

-- RLS Policies
ALTER TABLE template_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_earnings ENABLE ROW LEVEL SECURITY;

-- Purchases: Users can view their own purchases
CREATE POLICY "Users can view their own purchases" ON template_purchases
  FOR SELECT USING (user_id = auth.uid());

-- Purchases: System can insert (via service role)
CREATE POLICY "System can create purchases" ON template_purchases
  FOR INSERT WITH CHECK (true);

-- Earnings: Creators can view their own earnings
CREATE POLICY "Creators can view their earnings" ON creator_earnings
  FOR SELECT USING (creator_id = auth.uid());

-- Earnings: System can manage earnings (via service role)
CREATE POLICY "System can manage earnings" ON creator_earnings
  FOR ALL WITH CHECK (true);

-- Function to increment remix count when a template is remixed
CREATE OR REPLACE FUNCTION increment_template_remix_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.original_template_id IS NOT NULL THEN
    UPDATE design_templates 
    SET remix_count = remix_count + 1 
    WHERE id = NEW.original_template_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for remix count
DROP TRIGGER IF EXISTS template_remix_trigger ON design_templates;
CREATE TRIGGER template_remix_trigger
  AFTER INSERT ON design_templates
  FOR EACH ROW
  WHEN (NEW.original_template_id IS NOT NULL)
  EXECUTE FUNCTION increment_template_remix_count();

-- Function to check if user has purchased a template
CREATE OR REPLACE FUNCTION user_has_purchased_template(
  p_user_id UUID,
  p_template_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM template_purchases 
    WHERE user_id = p_user_id 
    AND template_id = p_template_id 
    AND status = 'completed'
  );
END;
$$ LANGUAGE plpgsql;
