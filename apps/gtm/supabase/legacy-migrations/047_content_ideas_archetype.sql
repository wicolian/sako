-- Migration: 047_content_ideas_archetype.sql
-- Add archetype support to content_ideas

-- Add archetype_id column to content_ideas
ALTER TABLE content_ideas 
ADD COLUMN IF NOT EXISTS archetype_id TEXT;

-- Add source type for archetype
-- Note: The source column should already exist with these values
-- This adds 'archetype' as a valid source
ALTER TABLE content_ideas 
DROP CONSTRAINT IF EXISTS content_ideas_source_check;

ALTER TABLE content_ideas
ADD CONSTRAINT content_ideas_source_check 
CHECK (source IN ('background', 'manual', 'competitor', 'trend', 'archetype'));

-- Create index for archetype filtering
CREATE INDEX IF NOT EXISTS content_ideas_archetype_idx ON content_ideas(archetype_id);

-- Create index for combined filtering
CREATE INDEX IF NOT EXISTS content_ideas_workspace_archetype_idx 
ON content_ideas(workspace_id, archetype_id) 
WHERE status = 'new';
