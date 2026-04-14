-- Create storage bucket for pathway cover images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pathway-images',
  'pathway-images',
  true, -- Public bucket so images can be viewed without authentication
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS is already enabled on storage.objects by default in Supabase

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Public pathway images access" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload pathway images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update pathway images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete pathway images" ON storage.objects;

-- Allow anyone to view pathway images (public bucket)
CREATE POLICY "Public pathway images access" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'pathway-images');

-- Allow authenticated users to upload pathway images (admin check can be added later)
CREATE POLICY "Admins can upload pathway images" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'pathway-images' 
    AND auth.role() = 'authenticated'
  );

-- Allow users to update pathway images
CREATE POLICY "Admins can update pathway images" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'pathway-images' 
    AND auth.role() = 'authenticated'
  );

-- Allow users to delete pathway images
CREATE POLICY "Admins can delete pathway images" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'pathway-images' 
    AND auth.role() = 'authenticated'
  );

