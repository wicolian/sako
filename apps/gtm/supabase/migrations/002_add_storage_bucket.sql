-- Create storage bucket for exports
INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to exports bucket
CREATE POLICY "Public read access for exports"
ON storage.objects FOR SELECT
USING (bucket_id = 'exports');

-- Allow service role to upload to exports bucket
CREATE POLICY "Service role can upload to exports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exports');
