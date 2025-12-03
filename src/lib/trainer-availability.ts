import { supabase } from './supabase';

export interface TrainerUnavailability {
  id: string;
  trainer_id: string;
  unavailable_date: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export async function markDateUnavailable(
  trainerId: string,
  date: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('trainer_unavailability')
      .insert({
        trainer_id: trainerId,
        unavailable_date: date,
        reason: reason || null,
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'This date is already marked as unavailable' };
      }
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error marking date unavailable:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark date unavailable',
    };
  }
}

export async function removeDateUnavailability(
  unavailabilityId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('trainer_unavailability')
      .delete()
      .eq('id', unavailabilityId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error removing unavailability:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove unavailability',
    };
  }
}

export async function getTrainerUnavailability(
  trainerId: string,
  startDate: string,
  endDate: string
): Promise<TrainerUnavailability[]> {
  try {
    const { data, error } = await supabase
      .from('trainer_unavailability')
      .select('*')
      .eq('trainer_id', trainerId)
      .gte('unavailable_date', startDate)
      .lte('unavailable_date', endDate)
      .order('unavailable_date', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching unavailability:', error);
    return [];
  }
}

export async function isTrainerAvailable(
  trainerId: string,
  date: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('trainer_unavailability')
      .select('id')
      .eq('trainer_id', trainerId)
      .eq('unavailable_date', date)
      .maybeSingle();

    if (error) throw error;

    return data === null;
  } catch (error) {
    console.error('Error checking trainer availability:', error);
    return true;
  }
}

export async function markDateRangeUnavailable(
  trainerId: string,
  startDate: string,
  endDate: string,
  reason?: string
): Promise<{ success: boolean; error?: string; conflictingDates?: string[] }> {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return { success: false, error: 'Start date must be before end date' };
    }

    const dates: Array<{ trainer_id: string; unavailable_date: string; reason: string | null }> = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dates.push({
        trainer_id: trainerId,
        unavailable_date: dateStr,
        reason: reason || null,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const { error } = await supabase
      .from('trainer_unavailability')
      .insert(dates);

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'One or more dates in this range are already marked as unavailable' };
      }
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error marking date range unavailable:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark date range unavailable',
    };
  }
}

export async function removeDateRangeUnavailability(
  trainerId: string,
  startDate: string,
  endDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('trainer_unavailability')
      .delete()
      .eq('trainer_id', trainerId)
      .gte('unavailable_date', startDate)
      .lte('unavailable_date', endDate);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error removing date range unavailability:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove date range unavailability',
    };
  }
}

export async function getAllTrainersUnavailability(
  startDate: string,
  endDate: string
): Promise<TrainerUnavailability[]> {
  try {
    const { data, error } = await supabase
      .from('trainer_unavailability')
      .select('*')
      .gte('unavailable_date', startDate)
      .lte('unavailable_date', endDate)
      .order('trainer_id', { ascending: true })
      .order('unavailable_date', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching all unavailability:', error);
    return [];
  }
}

export async function getBookingConflicts(
  trainerId: string,
  startDate: string,
  endDate: string
): Promise<Array<{ id: string; title: string; booking_date: string }>> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, title, booking_date')
      .eq('trainer_id', trainerId)
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)
      .neq('status', 'cancelled');

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error checking booking conflicts:', error);
    return [];
  }
}

export async function toggleDateAvailability(
  trainerId: string,
  date: string,
  reason?: string
): Promise<{ success: boolean; error?: string; action?: 'marked' | 'removed' }> {
  try {
    const { data: existing } = await supabase
      .from('trainer_unavailability')
      .select('id')
      .eq('trainer_id', trainerId)
      .eq('unavailable_date', date)
      .maybeSingle();

    if (existing) {
      const result = await removeDateUnavailability(existing.id);
      return { ...result, action: 'removed' };
    } else {
      const result = await markDateUnavailable(trainerId, date, reason);
      return { ...result, action: 'marked' };
    }
  } catch (error) {
    console.error('Error toggling date availability:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle availability',
    };
  }
}
