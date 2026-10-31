-- Migration: 043_project_pages.sql
-- Multi-page website support for projects

-- Add multipage flag and default transition to projects
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS is_multipage BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS default_transition TEXT DEFAULT 'fade';

-- Create project_pages table
CREATE TABLE IF NOT EXISTS project_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL DEFAULT '',
  is_home BOOLEAN DEFAULT false,
  blocks JSONB DEFAULT '[]',
  seo_title TEXT,
  seo_description TEXT,
  og_image TEXT,
  transition TEXT DEFAULT 'fade',
  "order" INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create unique constraint for slug within a project
CREATE UNIQUE INDEX IF NOT EXISTS project_pages_project_slug_idx 
ON project_pages(project_id, slug);

-- Create index for ordering
CREATE INDEX IF NOT EXISTS project_pages_project_order_idx 
ON project_pages(project_id, "order");

-- Ensure only one home page per project
CREATE UNIQUE INDEX IF NOT EXISTS project_pages_home_idx 
ON project_pages(project_id) WHERE is_home = true;

-- Enable RLS
ALTER TABLE project_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view pages in their workspace projects"
ON project_pages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = project_pages.project_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert pages in their workspace projects"
ON project_pages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = project_pages.project_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update pages in their workspace projects"
ON project_pages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = project_pages.project_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete pages in their workspace projects"
ON project_pages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = project_pages.project_id
    AND wm.user_id = auth.uid()
  )
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_project_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_pages_updated_at
BEFORE UPDATE ON project_pages
FOR EACH ROW
EXECUTE FUNCTION update_project_pages_updated_at();
