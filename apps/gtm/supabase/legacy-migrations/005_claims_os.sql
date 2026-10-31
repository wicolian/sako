-- ClaimsOS V1: Enterprise Claims Governance
-- This migration adds the claims management system with policies, approvals, and audit trail

-- ============================================================================
-- WORKSPACE MEMBERS TABLE (for auth)
-- ============================================================================

CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'reviewer', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, workspace_id)
);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);

-- ============================================================================
-- POLICIES TABLE - Versioned workspace policy configuration
-- ============================================================================

CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  mode TEXT NOT NULL DEFAULT 'standard' CHECK (mode IN ('standard', 'strict')),
  
  -- Policy rules stored as JSONB for flexibility
  forbidden_terms JSONB DEFAULT '[]',
  -- Format: [{"term": "guaranteed", "regex": false}, {"term": "risk-?free", "regex": true}]
  
  regulated_categories JSONB DEFAULT '{"security": true, "health": true, "finance": true, "legal": true}',
  -- Categories that require higher evidence tiers
  
  superlative_rules JSONB DEFAULT '{"block_without_proof": ["best", "#1", "only", "fastest", "leading", "top"], "require_evidence_tier": "A"}',
  -- Rules for handling superlatives and absolutes
  
  evidence_requirements JSONB DEFAULT '{"performance": "B", "security": "A", "pricing": "C", "compliance": "A", "generic": "C"}',
  -- Required evidence tier by claim category
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  
  UNIQUE(workspace_id, version)
);

CREATE INDEX idx_policies_workspace ON policies(workspace_id);
CREATE INDEX idx_policies_version ON policies(workspace_id, version DESC);

-- ============================================================================
-- CLAIMS TABLE - Workspace-level governed claims
-- ============================================================================

CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Claim content
  text TEXT NOT NULL,
  original_text TEXT, -- Store original if rewritten
  
  -- Classification
  claim_type TEXT NOT NULL DEFAULT 'soft' CHECK (claim_type IN ('hard', 'soft', 'unverified')),
  category TEXT NOT NULL DEFAULT 'generic' CHECK (category IN ('performance', 'security', 'pricing', 'compliance', 'generic')),
  
  -- Validation state
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'needs_proof', 'blocked', 'ready_review', 'approved', 'rejected')),
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  reason_codes JSONB DEFAULT '[]',
  -- Format: ["SUPERLATIVE_NO_PROOF", "FORBIDDEN_TERM"]
  
  -- Evidence requirements
  required_evidence_tier TEXT CHECK (required_evidence_tier IN ('A', 'B', 'C')),
  
  -- Rewrite suggestions from AI
  suggested_rewrites JSONB DEFAULT '[]',
  -- Format: ["Compliant version 1", "Compliant version 2"]
  
  -- Policy tracking
  policy_version INTEGER,
  
  -- Ownership
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claims_workspace ON claims(workspace_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_category ON claims(category);
CREATE INDEX idx_claims_type ON claims(claim_type);
CREATE INDEX idx_claims_created_by ON claims(created_by);

-- ============================================================================
-- CLAIM EVIDENCE LINKS - M:M with relevance notes
-- ============================================================================

CREATE TABLE claim_evidence_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  relevance_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  UNIQUE(claim_id, evidence_id)
);

CREATE INDEX idx_claim_evidence_claim ON claim_evidence_links(claim_id);
CREATE INDEX idx_claim_evidence_evidence ON claim_evidence_links(evidence_id);

-- ============================================================================
-- APPROVALS TABLE - Reviewer decisions with comments
-- ============================================================================

CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'needs_changes')),
  comment TEXT,
  policy_version INTEGER, -- Track which policy version was in effect
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approvals_claim ON approvals(claim_id);
CREATE INDEX idx_approvals_reviewer ON approvals(reviewer_id);
CREATE INDEX idx_approvals_decision ON approvals(decision);

-- ============================================================================
-- AUDIT LOG - Append-only change tracking
-- ============================================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- What changed
  entity_type TEXT NOT NULL CHECK (entity_type IN ('claim', 'evidence', 'policy', 'approval', 'claim_pack')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'approve', 'reject', 'link', 'unlink', 'export')),
  
  -- Change details
  before_state JSONB,
  after_state JSONB,
  
  -- Who and when
  actor_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log should never be updated or deleted
ALTER TABLE audit_log SET (autovacuum_enabled = true);

CREATE INDEX idx_audit_workspace ON audit_log(workspace_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ============================================================================
-- CLAIM PACKS - Exported claim bundles
-- ============================================================================

CREATE TABLE claim_packs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Claims included in this pack
  claim_ids JSONB NOT NULL DEFAULT '[]',
  
  -- Export options
  export_format TEXT DEFAULT 'json' CHECK (export_format IN ('json', 'markdown', 'pdf')),
  
  -- Sharing
  share_token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  
  -- Storage
  file_path TEXT, -- Path in Supabase Storage if exported
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claim_packs_workspace ON claim_packs(workspace_id);
CREATE INDEX idx_claim_packs_share_token ON claim_packs(share_token) WHERE share_token IS NOT NULL;

-- ============================================================================
-- SCHEMA CHANGES TO EXISTING TABLES
-- ============================================================================

-- Add tier to evidence for claim requirements
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IN ('A', 'B', 'C')) DEFAULT 'C';
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('third_party_report', 'customer_contract', 'audited_metric', 'case_study', 'testimonial', 'internal_doc', 'screenshot', 'anecdote', 'other'));

-- Add claim_id to messages for optional linking to approved claims
ALTER TABLE messages ADD COLUMN IF NOT EXISTS claim_id UUID REFERENCES claims(id) ON DELETE SET NULL;

-- Add industry and brand_voice to workspace_settings for AI context
ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS brand_voice TEXT;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_workspace_members_updated_at BEFORE UPDATE ON workspace_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claim_packs_updated_at BEFORE UPDATE ON claim_packs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Create default policy for demo workspace
INSERT INTO policies (workspace_id, version, mode, forbidden_terms, regulated_categories, superlative_rules, evidence_requirements)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  1,
  'standard',
  '[
    {"term": "guaranteed", "regex": false},
    {"term": "risk-free", "regex": false},
    {"term": "100% safe", "regex": false},
    {"term": "no risk", "regex": false},
    {"term": "HIPAA compliant", "regex": false},
    {"term": "SOC ?2", "regex": true}
  ]'::jsonb,
  '{"security": true, "health": true, "finance": true, "legal": true}'::jsonb,
  '{
    "block_without_proof": ["best", "#1", "only", "fastest", "leading", "top", "first", "number one", "industry-leading"],
    "require_evidence_tier": "A"
  }'::jsonb,
  '{"performance": "B", "security": "A", "pricing": "C", "compliance": "A", "generic": "C"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_evidence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_packs ENABLE ROW LEVEL SECURITY;

-- Workspace members: users can see their own memberships
CREATE POLICY "Users can view own memberships" ON workspace_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage memberships" ON workspace_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
    )
  );

-- Policies: workspace members can view, admins can modify
CREATE POLICY "Workspace members can view policies" ON policies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = policies.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage policies" ON policies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = policies.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
    )
  );

-- Claims: workspace members can view and create, reviewers/admins can approve
CREATE POLICY "Workspace members can view claims" ON claims
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = claims.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can create claims" ON claims
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = claims.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can update own claims" ON claims
  FOR UPDATE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = claims.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('admin', 'reviewer')
    )
  );

-- Claim evidence links: workspace members can manage
CREATE POLICY "Workspace members can manage evidence links" ON claim_evidence_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM claims c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = claim_evidence_links.claim_id
      AND wm.user_id = auth.uid()
    )
  );

-- Approvals: reviewers and admins can create
CREATE POLICY "Reviewers can view approvals" ON approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM claims c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = approvals.claim_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Reviewers can create approvals" ON approvals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM claims c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = approvals.claim_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('admin', 'reviewer')
    )
  );

-- Audit log: workspace members can view, system can insert
CREATE POLICY "Workspace members can view audit log" ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = audit_log.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Claim packs: workspace members can view and create
CREATE POLICY "Workspace members can manage claim packs" ON claim_packs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = claim_packs.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Public access to shared claim packs (by share_token)
CREATE POLICY "Public can view shared claim packs" ON claim_packs
  FOR SELECT USING (
    share_token IS NOT NULL 
    AND (expires_at IS NULL OR expires_at > NOW())
  );
