-- Add canonical render fields to website_designs.
--
-- render_html   – the exact HTML artifact produced by generateLandingPage().
--                 For campaign-linked designs this is the source of truth for
--                 preview, export, publish, and deploy.  Empty string for
--                 freeform designs whose preview is always re-rendered from
--                 sections.
--
-- render_manifest – JSON bag holding generation metadata (archetype, direction,
--                   template references, claims, flags).  Consumers should treat
--                   unknown keys as opaque.
--
-- editor_mode   – 'freeform'   : the generic WebsiteSection section editor
--                 'controlled' : campaign builder (controlled-edit shell,
--                                changes regenerate render_html rather than
--                                patching sections directly)

ALTER TABLE website_designs
  ADD COLUMN IF NOT EXISTS render_html text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS render_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS editor_mode text NOT NULL DEFAULT 'freeform'
    CONSTRAINT website_designs_editor_mode_check
    CHECK (editor_mode IN ('freeform', 'controlled'));

COMMENT ON COLUMN website_designs.render_html IS
  'Canonical HTML artifact from generateLandingPage(). Authoritative for campaign-linked designs.';

COMMENT ON COLUMN website_designs.render_manifest IS
  'Generation metadata: archetype, designDirection, templateRefs, claims, isLegacyBackfill, generatedAt.';

COMMENT ON COLUMN website_designs.editor_mode IS
  '''freeform'' = generic section editor; ''controlled'' = campaign builder where edits trigger regeneration.';
