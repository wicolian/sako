-- Fix workspace_members role check constraint to include 'owner' role
-- The original constraint only allowed: admin, reviewer, member
-- The workspace creation API uses 'owner' for the workspace creator

-- Drop the old constraint
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;

-- Add the corrected constraint including 'owner'
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('owner', 'admin', 'reviewer', 'member'));

-- Update is_workspace_admin function to include owner as admin
CREATE OR REPLACE FUNCTION is_workspace_admin(p_workspace_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
    AND user_id = auth.uid()
    AND role IN ('admin', 'owner')
  );
$$;
