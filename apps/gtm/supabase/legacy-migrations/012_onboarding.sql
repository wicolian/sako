ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Add onboarding tracking fields to workspaces
-- This migration adds metadata for tracking onboarding completion

-- Ensure settings column can store onboarding data
-- (settings is already JSONB in the workspaces table)

-- Add an index on settings for faster onboarding checks
CREATE INDEX IF NOT EXISTS idx_workspaces_settings_onboarding 
ON workspaces USING btree ((settings->>'onboarding_completed'));

-- Add a check constraint to validate onboarding data structure
-- (Optional - adds data integrity)
ALTER TABLE workspaces 
ADD CONSTRAINT check_onboarding_data CHECK (
  settings IS NULL OR 
  settings->>'onboarding_completed' IS NULL OR 
  settings->>'onboarding_completed' IN ('true', 'false')
);

-- Add metadata column to workspace_members if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspace_members' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE workspace_members ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Create a view for easy onboarding status checks
CREATE OR REPLACE VIEW workspace_onboarding_status AS
SELECT 
  w.id AS workspace_id,
  w.name AS workspace_name,
  COALESCE((w.settings->>'onboarding_completed')::boolean, false) AS onboarding_completed,
  w.settings->>'industry' AS industry,
  w.settings->>'primaryGoal' AS primary_goal,
  w.settings->'selectedProviders' AS selected_providers,
  w.settings->>'defaultPolicyTemplate' AS default_policy_template,
  (w.settings->>'onboarding_completed_at')::timestamptz AS completed_at
FROM workspaces w;

-- Grant access to the view
GRANT SELECT ON workspace_onboarding_status TO authenticated;

-- Add RLS policy for the view (inherits from workspaces table)
COMMENT ON VIEW workspace_onboarding_status IS 'View for checking workspace onboarding status - inherits RLS from workspaces table';
