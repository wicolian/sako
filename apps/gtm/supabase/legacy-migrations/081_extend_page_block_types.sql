-- Extend page block type support to match the current editor and AI generators.
-- The app already emits modern section types like cta, stats, comparison, and logos.

ALTER TABLE page_blocks DROP CONSTRAINT IF EXISTS page_blocks_type_check;

ALTER TABLE page_blocks
ADD CONSTRAINT page_blocks_type_check
CHECK (
  type IN (
    'hero',
    'trust',
    'benefits',
    'features',
    'pricing',
    'faq',
    'footer',
    'footer_cta',
    'testimonials',
    'cta',
    'stats',
    'comparison',
    'logos',
    'about',
    'contact',
    'team',
    'gallery',
    'process',
    'custom'
  )
);
