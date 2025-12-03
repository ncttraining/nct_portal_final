/*
  # Create Certificate Storage Bucket

  1. Storage Setup
    - Create 'certificates' storage bucket for certificate backgrounds and PDFs
    - Set as public bucket for easy access
    - Configure file size limits and allowed MIME types

  2. Security Policies
    - Allow authenticated users to upload files
    - Allow authenticated users to update/delete files
    - Allow public read access to all files
    - Restrict file types to images and PDFs
*/

-- Create the certificates storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificates',
  'certificates',
  true,
  10485760, -- 10MB limit
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
  ];

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload certificate files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'certificates');

-- Policy: Allow authenticated users to update files
CREATE POLICY "Authenticated users can update certificate files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'certificates')
WITH CHECK (bucket_id = 'certificates');

-- Policy: Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete certificate files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'certificates');

-- Policy: Allow public read access to all certificate files
CREATE POLICY "Public read access to certificate files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'certificates');

-- Policy: Allow anonymous users to read certificate files
CREATE POLICY "Anonymous read access to certificate files"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'certificates');
