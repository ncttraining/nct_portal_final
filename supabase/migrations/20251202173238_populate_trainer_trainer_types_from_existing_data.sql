/*
  # Populate Trainer-Trainer Types Junction Table

  1. Purpose
    - Analyze existing bookings to determine which trainer types each trainer has used
    - Populate the trainer_trainer_types junction table with these assignments
    - Maintain historical data integrity while setting up the new system

  2. Process
    - For each trainer, find all unique trainer types from their historical bookings
    - Insert records into trainer_trainer_types for each unique combination
    - Handle trainers without bookings (leave them without assignments for manual setup)
    - Prevent duplicate entries using ON CONFLICT

  3. Notes
    - This migration only affects the junction table
    - Historical bookings remain unchanged
    - Trainers without bookings will need manual trainer type assignment
*/

-- Populate trainer_trainer_types from existing booking data
INSERT INTO trainer_trainer_types (trainer_id, trainer_type_id, created_at, updated_at)
SELECT DISTINCT
  b.trainer_id,
  ct.trainer_type_id,
  now() as created_at,
  now() as updated_at
FROM bookings b
JOIN course_types ct ON b.course_type_id = ct.id
WHERE b.trainer_id IS NOT NULL
  AND ct.trainer_type_id IS NOT NULL
ON CONFLICT (trainer_id, trainer_type_id) DO NOTHING;
