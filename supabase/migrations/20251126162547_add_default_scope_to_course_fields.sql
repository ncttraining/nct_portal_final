/*
  # Add Default Scope to Existing Course Type Fields

  1. Purpose
    - Updates all existing course type fields to include a 'scope' property
    - Defaults to 'candidate' scope for backward compatibility
    - Admins can later change specific fields to 'course' scope as needed

  2. Changes
    - Iterates through course_types.required_fields JSONB array
    - Adds {"scope": "candidate"} to each field definition that doesn't have it

  3. Examples of Field Scopes
    - Course-level: Equipment types, venue, training materials used (same for all)
    - Candidate-level: Individual scores, assessment results, personal notes
*/

-- Update all course types to add scope field to their required_fields
DO $$
DECLARE
  course_record RECORD;
  updated_fields JSONB;
  field_item JSONB;
  new_fields JSONB := '[]'::jsonb;
BEGIN
  FOR course_record IN 
    SELECT id, required_fields 
    FROM course_types 
    WHERE required_fields IS NOT NULL AND required_fields != '[]'::jsonb
  LOOP
    new_fields := '[]'::jsonb;
    
    FOR field_item IN SELECT * FROM jsonb_array_elements(course_record.required_fields)
    LOOP
      IF NOT (field_item ? 'scope') THEN
        field_item := field_item || jsonb_build_object('scope', 'candidate');
      END IF;
      
      new_fields := new_fields || jsonb_build_array(field_item);
    END LOOP;
    
    UPDATE course_types
    SET required_fields = new_fields,
        updated_at = now()
    WHERE id = course_record.id;
  END LOOP;
END $$;
