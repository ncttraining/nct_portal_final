/*
  # Add display order to trainers

  1. Changes
    - Add `display_order` column to `trainers` table
    - Initialize existing trainers with sequential order
    - Add index for efficient ordering queries

  2. Notes
    - Allows trainers to be manually reordered
    - Lower numbers appear first
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trainers' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE trainers ADD COLUMN display_order integer DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS trainers_display_order_idx ON trainers(display_order);

UPDATE trainers
SET display_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) as row_num
  FROM trainers
) AS subquery
WHERE trainers.id = subquery.id AND trainers.display_order = 0;
