-- Add footer_cta to allowed page_blocks types
-- Also add testimonials type for future use

ALTER TABLE page_blocks DROP CONSTRAINT IF EXISTS page_blocks_type_check;

ALTER TABLE page_blocks 
ADD CONSTRAINT page_blocks_type_check 
CHECK (type IN ('hero', 'trust', 'benefits', 'features', 'pricing', 'faq', 'footer', 'footer_cta', 'testimonials', 'custom'));
