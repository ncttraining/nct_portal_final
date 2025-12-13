-- Add theme preference column to users table
-- Stores user's preferred theme: 'light' or 'dark'
-- Default is 'dark' as that's the current design

ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'dark' CHECK (theme_preference IN ('light', 'dark'));
