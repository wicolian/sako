-- Add settings column to workspaces table
-- This column stores workspace configuration including onboarding status

-- Add settings column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspaces' AND column_name = 'settings'
  ) THEN
    ALTER TABLE workspaces ADD COLUMN settings JSONB DEFAULT '{}';
  END IF;
END $$;

-- Add index for onboarding status lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_settings_gin ON workspaces USING gin(settings);
