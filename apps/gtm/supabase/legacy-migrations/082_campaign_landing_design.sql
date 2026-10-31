-- Add landing_design_id to campaigns to link each campaign to its canonical
-- website_designs record for the landing-page builder.
--
-- Self-heal note:
-- Some remote projects report migration 051 as applied while the underlying
-- website_designs table is missing from the schema cache. Recreate the minimal
-- table shape and policies here before linking campaigns to it.

DO $$
BEGIN
  IF to_regclass('public.website_designs') IS NULL THEN
    CREATE TABLE public.website_designs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
      brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
      project_id uuid,
      name text NOT NULL,
      description text,
      sections jsonb DEFAULT '[]'::jsonb,
      global_styles jsonb DEFAULT '{}'::jsonb,
      seo_meta jsonb DEFAULT '{}'::jsonb,
      status text DEFAULT 'draft',
      published_url text,
      published_at timestamptz,
      subdomain text UNIQUE,
      custom_domain text UNIQUE,
      version integer DEFAULT 1,
      last_edited_by uuid REFERENCES auth.users(id),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE INDEX idx_website_designs_workspace ON public.website_designs(workspace_id);
    CREATE INDEX idx_website_designs_brand ON public.website_designs(brand_id);
    CREATE INDEX idx_website_designs_status ON public.website_designs(status);
    CREATE INDEX idx_website_designs_subdomain ON public.website_designs(subdomain);

    ALTER TABLE public.website_designs ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Workspace members can view designs"
      ON public.website_designs FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = website_designs.workspace_id
            AND wm.user_id = auth.uid()
        )
      );

    CREATE POLICY "Workspace members can create designs"
      ON public.website_designs FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = website_designs.workspace_id
            AND wm.user_id = auth.uid()
        )
      );

    CREATE POLICY "Workspace members can update designs"
      ON public.website_designs FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = website_designs.workspace_id
            AND wm.user_id = auth.uid()
        )
      );

    CREATE POLICY "Workspace admins can delete designs"
      ON public.website_designs FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = website_designs.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.increment_design_version()
RETURNS trigger AS $fn$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_design_version ON public.website_designs;
CREATE TRIGGER trigger_increment_design_version
  BEFORE UPDATE OF sections, global_styles ON public.website_designs
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_design_version();

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS landing_design_id uuid REFERENCES public.website_designs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_landing_design_id
  ON public.campaigns(landing_design_id);

COMMENT ON COLUMN public.campaigns.landing_design_id IS
  'Canonical link to the website_designs record that represents this campaign''s landing page. Legacy page_blocks remain read-only compatibility data.';
