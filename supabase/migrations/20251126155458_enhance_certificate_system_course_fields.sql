/*
  # Enhance Certificate System with Course-Specific Fields

  1. Modifications to Existing Tables
    - Add `required_fields` to `course_types` - JSON array of field definitions needed when issuing certificates
    - Add `certificate_field_mappings` to `course_types` - Maps course fields to template fields
    - Add `course_specific_data` to `certificates` - Stores course-specific field values

  2. New Functionality
    - Support for dynamic course-specific fields per course type
    - Store course field data with each certificate
    - Flexible validity period management (already exists in course_types.certificate_validity_months)

  3. Notes
    - required_fields format: [{"name": "field_name", "label": "Field Label", "type": "text", "required": true, "options": []}]
    - course_specific_data format: {"field_name": "value", "another_field": "value"}
    - Validity periods already configured in course_types table
*/

-- Add required_fields to course_types for course-specific field definitions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_types' AND column_name = 'required_fields'
  ) THEN
    ALTER TABLE course_types ADD COLUMN required_fields jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add certificate_field_mappings to course_types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_types' AND column_name = 'certificate_field_mappings'
  ) THEN
    ALTER TABLE course_types ADD COLUMN certificate_field_mappings jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add course_specific_data to certificates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'certificates' AND column_name = 'course_specific_data'
  ) THEN
    ALTER TABLE certificates ADD COLUMN course_specific_data jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Update Forklift Training with example required fields
UPDATE course_types 
SET required_fields = '[
  {
    "name": "equipment_types",
    "label": "Equipment Types Trained",
    "type": "text",
    "required": true,
    "placeholder": "e.g., Counterbalance, Reach Truck"
  },
  {
    "name": "license_category",
    "label": "License Category",
    "type": "dropdown",
    "required": true,
    "options": ["B1", "B2", "B3", "B4", "B5", "B6", "B7"]
  }
]'::jsonb
WHERE code = 'FLT';

-- Update First Aid with example required fields
UPDATE course_types 
SET required_fields = '[
  {
    "name": "qualification_level",
    "label": "Qualification Level",
    "type": "dropdown",
    "required": true,
    "options": ["Emergency First Aid at Work", "First Aid at Work", "Paediatric First Aid"]
  },
  {
    "name": "assessment_result",
    "label": "Assessment Result",
    "type": "dropdown",
    "required": true,
    "options": ["Pass", "Pass with Merit", "Pass with Distinction"]
  }
]'::jsonb
WHERE code = 'FA';

-- Update Mental Health First Aid with example required fields
UPDATE course_types 
SET required_fields = '[
  {
    "name": "specialization",
    "label": "Specialization Area",
    "type": "dropdown",
    "required": false,
    "options": ["Adult", "Youth", "Workplace", "General"]
  }
]'::jsonb
WHERE code = 'MHFA';

-- Update CPC with example required fields
UPDATE course_types 
SET required_fields = '[
  {
    "name": "module_numbers",
    "label": "Module Numbers Completed",
    "type": "text",
    "required": true,
    "placeholder": "e.g., Module 1, Module 2"
  },
  {
    "name": "hours_completed",
    "label": "Hours Completed",
    "type": "number",
    "required": true,
    "placeholder": "7"
  }
]'::jsonb
WHERE code = 'CPC';

-- Update Manual Handling with example required fields
UPDATE course_types 
SET required_fields = '[
  {
    "name": "equipment_categories",
    "label": "Equipment Categories Covered",
    "type": "text",
    "required": false,
    "placeholder": "e.g., Pallet trucks, lifting aids"
  }
]'::jsonb
WHERE code = 'MH';

-- Create index for course_specific_data searching
CREATE INDEX IF NOT EXISTS idx_certificates_course_specific_data ON certificates USING gin(course_specific_data);
