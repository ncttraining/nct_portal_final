/*
  # Create Trainer Insurance Storage Bucket and Policies

  ## Overview
  This migration ensures the trainer-insurance storage bucket exists with proper
  RLS policies for secure document storage.

  ## Changes Made

  1. **Storage Bucket**
    - Creates or updates `trainer-insurance` bucket
    - Configures as private bucket
    - Sets file size limit to 10MB
    - Restricts to PDF, JPG, JPEG, PNG formats

  2. **Storage Policies**
    - Admins can upload files to any trainer's insurance folder
    - Admins can read all insurance documents
    - Trainers can read their own insurance documents (future implementation)
    - Public access is denied for security

  ## Security Notes
  - All files stored privately by default
  - Only authenticated admin users can upload
  - Insurance documents protected by RLS
*/

-- Insert bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trainer-insurance',
  'trainer-insurance',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can upload insurance documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all insurance documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update insurance documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete insurance documents" ON storage.objects;
DROP POLICY IF EXISTS "Trainers can read own insurance documents" ON storage.objects;

-- Policy: Admins can upload insurance documents
CREATE POLICY "Admins can upload insurance documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trainer-insurance' AND
  (storage.foldername(name))[1] = 'insurance' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Policy: Admins can read all insurance documents
CREATE POLICY "Admins can read all insurance documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trainer-insurance' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Policy: Admins can update insurance documents
CREATE POLICY "Admins can update insurance documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trainer-insurance' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'trainer-insurance' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Policy: Admins can delete insurance documents
CREATE POLICY "Admins can delete insurance documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'trainer-insurance' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Policy: Trainers can read their own insurance documents (future feature)
CREATE POLICY "Trainers can read own insurance documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trainer-insurance' AND
  EXISTS (
    SELECT 1 FROM public.trainers t
    INNER JOIN public.users u ON t.user_id = u.id
    WHERE u.id = auth.uid()
    AND u.is_trainer = true
    AND storage.filename(name) LIKE t.id::text || '%'
  )
);
