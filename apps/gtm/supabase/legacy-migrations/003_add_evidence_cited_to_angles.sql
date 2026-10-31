-- Add evidence_cited column to angles table
ALTER TABLE angles ADD COLUMN IF NOT EXISTS evidence_cited TEXT[] DEFAULT '{}';
