/*
  # Update avatars bucket file size limit to 16MB

  1. Updates
    - Sets file_size_limit to 16MB (16777216 bytes) for avatars bucket
    - Allows users to upload larger profile images
*/

-- Update the avatars bucket to allow 16MB file uploads
UPDATE storage.buckets
SET file_size_limit = 16777216
WHERE id = 'avatars';
