import { supabase } from './supabase';

export interface TrainerType {
  id: string;
  name: string;
  description: string;
  sort_order: number;
}

export interface TrainerTrainerType {
  id: string;
  trainer_id: string;
  trainer_type_id: string;
  created_at: string;
  updated_at: string;
  trainer_types?: TrainerType;
}

export interface CourseType {
  id: string;
  name: string;
  code: string;
  trainer_type_id: string | null;
  trainer_type_name?: string;
}

export interface FutureBookingsCheck {
  booking_count: number;
  earliest_booking_date: string | null;
  latest_booking_date: string | null;
}

export async function getTrainerTypes(trainerId: string): Promise<TrainerType[]> {
  const { data, error } = await supabase
    .from('trainer_trainer_types')
    .select(`
      trainer_type_id,
      trainer_types (
        id,
        name,
        description,
        sort_order
      )
    `)
    .eq('trainer_id', trainerId)
    .order('trainer_types(sort_order)');

  if (error) {
    console.error('Error fetching trainer types:', error);
    throw error;
  }

  return (data || [])
    .map(item => item.trainer_types)
    .filter(Boolean) as TrainerType[];
}

export async function assignTrainerType(
  trainerId: string,
  trainerTypeId: string
): Promise<void> {
  const { error } = await supabase
    .from('trainer_trainer_types')
    .insert({
      trainer_id: trainerId,
      trainer_type_id: trainerTypeId
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error('This trainer type is already assigned to the trainer');
    }
    console.error('Error assigning trainer type:', error);
    throw error;
  }
}

export async function removeTrainerType(
  trainerId: string,
  trainerTypeId: string
): Promise<void> {
  const { error } = await supabase
    .from('trainer_trainer_types')
    .delete()
    .eq('trainer_id', trainerId)
    .eq('trainer_type_id', trainerTypeId);

  if (error) {
    console.error('Error removing trainer type:', error);
    throw error;
  }
}

export async function getTrainersForTrainerType(
  trainerTypeId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('trainer_trainer_types')
    .select('trainer_id')
    .eq('trainer_type_id', trainerTypeId);

  if (error) {
    console.error('Error fetching trainers for type:', error);
    throw error;
  }

  return (data || []).map(item => item.trainer_id);
}

export async function getAvailableCourseTypesForTrainer(
  trainerId: string
): Promise<CourseType[]> {
  const { data: qualifiedCourses, error: viewError } = await supabase
    .from('trainer_available_course_types')
    .select('*')
    .eq('trainer_id', trainerId);

  if (viewError) {
    console.error('Error fetching available course types:', viewError);
    throw viewError;
  }

  const { data: allCourses, error: coursesError } = await supabase
    .from('course_types')
    .select('id, name, code, trainer_type_id')
    .is('trainer_type_id', null)
    .eq('active', true);

  if (coursesError) {
    console.error('Error fetching courses without trainer type:', coursesError);
    throw coursesError;
  }

  const qualifiedList = (qualifiedCourses || []).map(item => ({
    id: item.course_type_id,
    name: item.course_type_name,
    code: item.course_type_code,
    trainer_type_id: item.trainer_type_id,
    trainer_type_name: item.trainer_type_name
  }));

  const universalList = (allCourses || []).map(item => ({
    id: item.id,
    name: item.name,
    code: item.code,
    trainer_type_id: item.trainer_type_id,
    trainer_type_name: undefined
  }));

  const courseIds = new Set(qualifiedList.map(c => c.id));
  const uniqueUniversal = universalList.filter(c => !courseIds.has(c.id));

  return [...qualifiedList, ...uniqueUniversal];
}

export async function validateTrainerForCourse(
  trainerId: string,
  courseTypeId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('is_trainer_qualified_for_course', {
      p_trainer_id: trainerId,
      p_course_type_id: courseTypeId
    });

  if (error) {
    console.error('Error validating trainer for course:', error);
    throw error;
  }

  return data === true;
}

export async function checkFutureBookingsForTrainerType(
  trainerId: string,
  trainerTypeId: string
): Promise<FutureBookingsCheck> {
  const { data, error } = await supabase
    .rpc('check_trainer_type_has_future_bookings', {
      p_trainer_id: trainerId,
      p_trainer_type_id: trainerTypeId
    });

  if (error) {
    console.error('Error checking future bookings:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return {
      booking_count: 0,
      earliest_booking_date: null,
      latest_booking_date: null
    };
  }

  return {
    booking_count: Number(data[0].booking_count) || 0,
    earliest_booking_date: data[0].earliest_booking_date,
    latest_booking_date: data[0].latest_booking_date
  };
}

export async function getAllTrainerTypesWithCounts(): Promise<Array<TrainerType & { trainer_count: number }>> {
  const { data: trainerTypes, error: typesError } = await supabase
    .from('trainer_types')
    .select('*')
    .order('sort_order');

  if (typesError) {
    console.error('Error fetching trainer types:', typesError);
    throw typesError;
  }

  const { data: counts, error: countsError } = await supabase
    .from('trainer_trainer_types')
    .select('trainer_type_id');

  if (countsError) {
    console.error('Error fetching trainer type counts:', countsError);
    throw countsError;
  }

  const countMap = (counts || []).reduce((acc, item) => {
    acc[item.trainer_type_id] = (acc[item.trainer_type_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (trainerTypes || []).map(type => ({
    ...type,
    trainer_count: countMap[type.id] || 0
  }));
}

export async function getTrainerTypesForMultipleTrainers(
  trainerIds: string[]
): Promise<Record<string, TrainerType[]>> {
  if (trainerIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('trainer_trainer_types')
    .select(`
      trainer_id,
      trainer_type_id,
      trainer_types (
        id,
        name,
        description,
        sort_order
      )
    `)
    .in('trainer_id', trainerIds)
    .order('trainer_types(sort_order)');

  if (error) {
    console.error('Error fetching trainer types for multiple trainers:', error);
    throw error;
  }

  const result: Record<string, TrainerType[]> = {};

  (data || []).forEach(item => {
    if (!result[item.trainer_id]) {
      result[item.trainer_id] = [];
    }
    if (item.trainer_types) {
      result[item.trainer_id].push(item.trainer_types as TrainerType);
    }
  });

  return result;
}
