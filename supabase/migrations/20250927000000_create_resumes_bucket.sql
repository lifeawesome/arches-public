-- Create storage bucket for user resumes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false, -- Private bucket - resumes should not be publicly accessible
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS is already enabled on storage.objects by default in Supabase

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON storage.objects;

-- Allow authenticated users to upload resumes
CREATE POLICY "Users can upload their own resumes" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'resumes' 
    AND auth.role() = 'authenticated'
  );

-- Allow users to view their own resumes
CREATE POLICY "Users can view their own resumes" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'resumes' 
    AND auth.role() = 'authenticated'
  );

-- Allow users to update their own resumes
CREATE POLICY "Users can update their own resumes" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'resumes' 
    AND auth.role() = 'authenticated'
  );

-- Allow users to delete their own resumes
CREATE POLICY "Users can delete their own resumes" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'resumes' 
    AND auth.role() = 'authenticated'
  );
