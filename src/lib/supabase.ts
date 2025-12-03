import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ihamryqtzkepskhryslm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloYW1yeXF0emtlcHNraHJ5c2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMjMwOTIsImV4cCI6MjA3OTY5OTA5Mn0.vCD5jO13VxHSK0YbEbvF6ULymFfdSgMdFxmUNZGCqZ8';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function loadAttributesForType(trainerTypeId: string) {
  const { data, error } = await supabase
    .from('trainer_type_attributes')
    .select('*')
    .eq('trainer_type_id', trainerTypeId)
    .order('sort_order');

  if (error) {
    console.error('Error loading attributes:', error);
    return [];
  }

  return data as TrainerAttribute[];
}

export async function loadOptionsForAttribute(attributeId: string) {
  const { data, error } = await supabase
    .from('trainer_attribute_options')
    .select('*')
    .eq('attribute_id', attributeId)
    .order('category, sort_order');

  if (error) {
    console.error('Error loading options:', error);
    return [];
  }

  return data as AttributeOption[];
}

export async function loadAttributeValues(trainerId: string) {
  const { data, error } = await supabase
    .from('trainer_attribute_values')
    .select('*')
    .eq('trainer_id', trainerId);

  if (error) {
    console.error('Error loading attribute values:', error);
    return [];
  }

  return data as AttributeValue[];
}

export async function saveAttributeValues(
  trainerId: string,
  attributes: TrainerAttribute[],
  values: Record<string, any>
) {
  const valuesToSave = attributes.map((attr) => {
    const value = values[attr.name];

    return {
      trainer_id: trainerId,
      attribute_id: attr.id,
      value_text: attr.field_type === 'text' ? (value || null) : null,
      value_date: attr.field_type === 'date' ? (value || null) : null,
      value_number: attr.field_type === 'number' ? (value ? parseFloat(value) : null) : null,
      value_array: attr.field_type === 'multiselect' ? (value || []) : null,
    };
  });

  await supabase
    .from('trainer_attribute_values')
    .delete()
    .eq('trainer_id', trainerId);

  const { error } = await supabase
    .from('trainer_attribute_values')
    .insert(valuesToSave);

  if (error) {
    console.error('Error saving attribute values:', error);
    throw error;
  }
}

export type Trainer = {
  id: string;
  name: string;
  trainer_type_id: string | null;
  address1: string;
  address2: string;
  town: string;
  postcode: string;
  telephone: string;
  email: string;
  day_rate: number | null;
  rtitb_number: string;
  rtitb_expiry: string | null;
  insurance_expiry: string | null;
  insurance_file_name: string;
  insurance_url: string;
  latitude: number | null;
  longitude: number | null;
  truck_types: string[];
  created_at: string;
  updated_at: string;
};

export type TrainerAttribute = {
  id: string;
  trainer_type_id: string;
  name: string;
  label: string;
  field_type: 'text' | 'date' | 'number' | 'multiselect' | 'file';
  is_required: boolean;
  sort_order: number;
};

export type AttributeOption = {
  id: string;
  attribute_id: string;
  category: string;
  code: string;
  label: string;
  sort_order: number;
};

export type AttributeValue = {
  id: string;
  trainer_id: string;
  attribute_id: string;
  value_text: string | null;
  value_date: string | null;
  value_number: number | null;
  value_array: string[] | null;
};
