-- Affiliate Program System Migration
-- Phase 2.1: Full affiliate/referral system for partner distribution

-- Affiliates table
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  commission_rate DECIMAL(4,2) DEFAULT 0.50, -- 50% default
  commission_cap_months INTEGER DEFAULT 12, -- Cap at 12 months
  status TEXT DEFAULT 'pending', -- pending, active, suspended, terminated
  tier TEXT DEFAULT 'standard', -- standard, premium, vip
  
  -- Payout configuration
  payout_method TEXT, -- paypal, stripe, wire, crypto
  payout_details JSONB DEFAULT '{}', -- Encrypted payment details
  payout_minimum DECIMAL(10,2) DEFAULT 50.00,
  
  -- Profile
  company_name TEXT,
  website TEXT,
  social_profiles JSONB DEFAULT '{}',
  promotional_methods TEXT[],
  
  -- Stats (denormalized for performance)
  total_referrals INTEGER DEFAULT 0,
  active_referrals INTEGER DEFAULT 0,
  total_earnings DECIMAL(12,2) DEFAULT 0,
  pending_earnings DECIMAL(12,2) DEFAULT 0,
  paid_earnings DECIMAL(12,2) DEFAULT 0,
  
  -- Metadata
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Affiliate referrals table
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id), -- NULL until signup
  referred_email TEXT,
  
  -- Tracking
  referral_code TEXT NOT NULL,
  landing_page TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  ip_address TEXT,
  user_agent TEXT,
  
  -- Cookie tracking
  cookie_id TEXT UNIQUE,
  cookie_created_at TIMESTAMPTZ DEFAULT now(),
  cookie_expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  
  -- Conversion tracking
  status TEXT DEFAULT 'clicked', -- clicked, signed_up, subscribed, churned
  signed_up_at TIMESTAMPTZ,
  subscribed_at TIMESTAMPTZ,
  churned_at TIMESTAMPTZ,
  
  -- Subscription info (from Stripe)
  subscription_id TEXT,
  subscription_plan TEXT,
  subscription_amount DECIMAL(10,2),
  subscription_interval TEXT, -- monthly, yearly
  
  -- Commission tracking
  commission_rate DECIMAL(4,2), -- Rate at time of referral
  commission_months_remaining INTEGER,
  total_commission_paid DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Affiliate payouts table
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Amount breakdown
  gross_amount DECIMAL(10,2) NOT NULL,
  fees DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2) NOT NULL,
  
  -- Referrals included
  referral_count INTEGER DEFAULT 0,
  referral_ids UUID[] DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  
  -- Payment details
  payout_method TEXT,
  payout_reference TEXT, -- Transaction ID from payment processor
  paid_at TIMESTAMPTZ,
  failed_reason TEXT,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Affiliate commission log (detailed per-period tracking)
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES affiliate_referrals(id) ON DELETE CASCADE,
  payout_id UUID REFERENCES affiliate_payouts(id),
  
  -- Period
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  
  -- Amount
  subscription_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(4,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, cleared, paid, voided
  cleared_at TIMESTAMPTZ,
  
  -- Stripe details
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Affiliate creative assets table
CREATE TABLE IF NOT EXISTS affiliate_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- banner, logo, email_template, social_post
  category TEXT, -- product, seasonal, promotional
  
  -- Files
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  dimensions TEXT, -- e.g., "300x250"
  file_size INTEGER,
  
  -- Metadata
  instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  download_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliates_user ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);
CREATE INDEX IF NOT EXISTS idx_referrals_affiliate ON affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_cookie ON affiliate_referrals(cookie_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON affiliate_referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_user ON affiliate_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_affiliate ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON affiliate_payouts(status);
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_referral ON affiliate_commissions(referral_id);
CREATE INDEX IF NOT EXISTS idx_commissions_payout ON affiliate_commissions(payout_id);

-- RLS Policies
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_assets ENABLE ROW LEVEL SECURITY;

-- Affiliates: users can view/edit their own
CREATE POLICY "Users can view own affiliate"
  ON affiliates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own affiliate"
  ON affiliates FOR UPDATE
  USING (auth.uid() = user_id);

-- Referrals: affiliates can view their own
CREATE POLICY "Affiliates can view own referrals"
  ON affiliate_referrals FOR SELECT
  USING (
    affiliate_id IN (
      SELECT id FROM affiliates WHERE user_id = auth.uid()
    )
  );

-- Payouts: affiliates can view their own
CREATE POLICY "Affiliates can view own payouts"
  ON affiliate_payouts FOR SELECT
  USING (
    affiliate_id IN (
      SELECT id FROM affiliates WHERE user_id = auth.uid()
    )
  );

-- Commissions: affiliates can view their own
CREATE POLICY "Affiliates can view own commissions"
  ON affiliate_commissions FOR SELECT
  USING (
    affiliate_id IN (
      SELECT id FROM affiliates WHERE user_id = auth.uid()
    )
  );

-- Assets: public read
CREATE POLICY "Anyone can view active assets"
  ON affiliate_assets FOR SELECT
  USING (is_active = true);

-- Function to generate unique affiliate code
CREATE OR REPLACE FUNCTION generate_affiliate_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to update affiliate stats
CREATE OR REPLACE FUNCTION update_affiliate_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update referral counts
  UPDATE affiliates
  SET 
    total_referrals = (
      SELECT COUNT(*) FROM affiliate_referrals 
      WHERE affiliate_id = NEW.affiliate_id
    ),
    active_referrals = (
      SELECT COUNT(*) FROM affiliate_referrals 
      WHERE affiliate_id = NEW.affiliate_id 
      AND status = 'subscribed'
    ),
    updated_at = now()
  WHERE id = NEW.affiliate_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stats on referral changes
DROP TRIGGER IF EXISTS trigger_update_affiliate_stats ON affiliate_referrals;
CREATE TRIGGER trigger_update_affiliate_stats
  AFTER INSERT OR UPDATE ON affiliate_referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliate_stats();

-- Function to update earnings after commission
CREATE OR REPLACE FUNCTION update_affiliate_earnings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    UPDATE affiliates
    SET 
      pending_earnings = pending_earnings + NEW.commission_amount,
      total_earnings = total_earnings + NEW.commission_amount,
      updated_at = now()
    WHERE id = NEW.affiliate_id;
  ELSIF NEW.status = 'paid' AND OLD.status = 'cleared' THEN
    UPDATE affiliates
    SET 
      pending_earnings = pending_earnings - NEW.commission_amount,
      paid_earnings = paid_earnings + NEW.commission_amount,
      updated_at = now()
    WHERE id = NEW.affiliate_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for earnings updates
DROP TRIGGER IF EXISTS trigger_update_affiliate_earnings ON affiliate_commissions;
CREATE TRIGGER trigger_update_affiliate_earnings
  AFTER INSERT OR UPDATE ON affiliate_commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliate_earnings();
