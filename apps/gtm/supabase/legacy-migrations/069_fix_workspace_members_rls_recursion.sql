-- Fix infinite recursion in workspace_members RLS policy
-- The "Admins can manage memberships" policy queried workspace_members from within
-- a workspace_members policy, causing recursion. Use SECURITY DEFINER function instead.

-- Helper: check if current user is admin of a workspace (bypasses RLS)
CREATE OR REPLACE FUNCTION is_workspace_admin(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
    AND user_id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Admins can manage memberships" ON workspace_members;

-- Recreate using the helper (no recursion)
CREATE POLICY "Admins can manage memberships" ON workspace_members
  FOR ALL
  USING (is_workspace_admin(workspace_id));
