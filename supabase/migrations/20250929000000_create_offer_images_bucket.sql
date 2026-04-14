-- Create storage bucket for offer images
INSERT INTO storage.buckets (id, name, public)
VALUES ('offer-images', 'offer-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own offer images
CREATE POLICY "Users can upload offer images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'offer-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own offer images
CREATE POLICY "Users can update own offer images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'offer-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own offer images
CREATE POLICY "Users can delete own offer images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'offer-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to offer images
CREATE POLICY "Public can view offer images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'offer-images');

