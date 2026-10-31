-- Compliance Reports for /gate
-- Stores shareable validation reports

CREATE TABLE IF NOT EXISTS compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  
  -- Report data
  original_text TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT 'generic',
  results JSONB NOT NULL DEFAULT '[]',
  summary JSONB NOT NULL DEFAULT '{}',
  
  -- Scores
  compliance_score INTEGER NOT NULL DEFAULT 0,
  average_risk_score INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  ip_hash TEXT, -- Hashed IP for rate limiting lookup
  user_agent TEXT,
  
  -- Sharing
  is_public BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days')
);

-- Indexes
CREATE INDEX IF NOT EXISTS compliance_reports_token ON compliance_reports(token);
CREATE INDEX IF NOT EXISTS compliance_reports_created_at ON compliance_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS compliance_reports_expires ON compliance_reports(expires_at) WHERE expires_at > now();

-- RLS Policies (public access for viewing, no auth required)
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can view public reports
CREATE POLICY compliance_reports_public_read ON compliance_reports
  FOR SELECT
  USING (is_public = true AND expires_at > now());

-- Service role can do anything
CREATE POLICY compliance_reports_service ON compliance_reports
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_report_views(report_token TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE compliance_reports
  SET view_count = view_count + 1
  WHERE token = report_token
    AND is_public = true
    AND expires_at > now();
END;
$$;

-- Cleanup old reports (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM compliance_reports
  WHERE expires_at < now();
END;
$$;

COMMENT ON TABLE compliance_reports IS 'Stores shareable validation reports from /gate';
