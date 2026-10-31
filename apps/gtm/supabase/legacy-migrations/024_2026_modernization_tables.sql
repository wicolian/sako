-- 2026 Modernization Tables
-- Adds support for:
-- 1. AI Wallet (credit-based billing)
-- 2. HITL Approval Workflows
-- 3. Agent Run Tracking

-- ============================================================================
-- AI WALLET TABLES
-- ============================================================================

-- Workspace wallets for credit-based AI billing
CREATE TABLE IF NOT EXISTS workspace_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0, -- Balance in cents
  low_balance_threshold integer NOT NULL DEFAULT 500, -- $5 default
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

-- Wallet transactions for audit trail
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('credit', 'debit', 'refund', 'bonus')),
  amount integer NOT NULL, -- Amount in cents
  model text,
  tokens integer,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_workspace 
  ON wallet_transactions(workspace_id, created_at DESC);

-- RPC function for atomic wallet debit
CREATE OR REPLACE FUNCTION debit_wallet(
  p_workspace_id uuid,
  p_amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
  v_new_balance integer;
BEGIN
  -- Get current balance with row lock
  SELECT balance INTO v_balance
  FROM workspace_wallets
  WHERE workspace_id = p_workspace_id
  FOR UPDATE;
  
  -- Check if wallet exists
  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Check sufficient balance
  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Debit
  v_new_balance := v_balance - p_amount;
  
  UPDATE workspace_wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE workspace_id = p_workspace_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'previous_balance', v_balance,
    'new_balance', v_new_balance
  );
END;
$$;

-- ============================================================================
-- HITL APPROVAL TABLES
-- ============================================================================

-- Approval requests for human-in-the-loop workflows
CREATE TABLE IF NOT EXISTS approval_requests (
  id text PRIMARY KEY, -- Format: apr-uuid
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_run_id text,
  type text NOT NULL CHECK (type IN (
    'claim_review', 
    'deployment', 
    'high_value_action', 
    'policy_override', 
    'data_access'
  )),
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  description text,
  context jsonb NOT NULL DEFAULT '{}',
  required_approvers text[] NOT NULL DEFAULT '{}',
  min_approvals integer NOT NULL DEFAULT 1,
  approvals jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 
    'approved', 
    'rejected', 
    'expired', 
    'escalated'
  )),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  resolved_at timestamptz,
  metadata jsonb DEFAULT '{}'
);

-- Indexes for approval queries
CREATE INDEX IF NOT EXISTS idx_approval_requests_workspace 
  ON approval_requests(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status 
  ON approval_requests(status, expires_at);

-- ============================================================================
-- AGENT RUN TRACKING
-- ============================================================================

-- Track agent executions for observability
CREATE TABLE IF NOT EXISTS agent_runs (
  id text PRIMARY KEY, -- Format: run-uuid
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  agent_version text,
  status text NOT NULL DEFAULT 'running' CHECK (status IN (
    'running', 
    'completed', 
    'failed', 
    'waiting_approval',
    'cancelled'
  )),
  input jsonb NOT NULL,
  output jsonb,
  steps jsonb NOT NULL DEFAULT '[]',
  total_tokens integer DEFAULT 0,
  total_cost_cents integer DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}'
);

-- Index for run queries
CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace 
  ON agent_runs(workspace_id, started_at DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE workspace_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

-- Wallet policies (workspace members can view, only system can modify)
CREATE POLICY wallet_select ON workspace_wallets
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY wallet_transactions_select ON wallet_transactions
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Approval policies (workspace members can view and submit decisions)
CREATE POLICY approval_select ON approval_requests
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY approval_update ON approval_requests
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Agent run policies
CREATE POLICY agent_runs_select ON agent_runs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
