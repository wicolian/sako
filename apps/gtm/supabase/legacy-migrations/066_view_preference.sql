-- Migration 066: Add default_view preference to workspace_settings
-- Allows users to choose between "agent" (chat-first) and "advanced" (full sidebar) views

-- Add default_view column to workspace_settings
ALTER TABLE workspace_settings 
ADD COLUMN IF NOT EXISTS default_view text DEFAULT 'agent'
CHECK (default_view IN ('agent', 'advanced'));

-- Comment for documentation
COMMENT ON COLUMN workspace_settings.default_view IS 
  'User interface preference: agent = chat-first simplified view, advanced = full sidebar with all features';
