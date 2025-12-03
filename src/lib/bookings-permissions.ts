import { supabase } from './supabase';

export interface TrainerPermission {
  id?: string;
  user_id: string;
  trainer_id: string;
  can_receive_notifications: boolean;
}

export interface TrainerTypePermission {
  id?: string;
  user_id: string;
  trainer_type_id: string;
  can_receive_notifications: boolean;
}

export interface BookingWithDetails {
  id: string;
  trainer_id: string;
  booking_date: string;
  start_time: string;
  title: string;
  location: string;
  client_name: string;
  client_contact_name: string;
  client_email: string;
  client_telephone: string;
  notes: string;
  status: string;
  in_centre: boolean;
  num_days: number;
  course_type_id?: string;
  trainer?: {
    id: string;
    name: string;
  };
  candidates?: Array<{
    id: string;
    candidate_name: string;
    telephone: string;
    email: string;
  }>;
}

export async function hasBookingViewCapability(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('can_view_bookings')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data?.can_view_bookings || false;
  } catch (error) {
    console.error('Error checking booking view capability:', error);
    return false;
  }
}

export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

export async function getUserAuthorizedTrainerIds(userId: string): Promise<string[]> {
  try {
    const isAdmin = await isAdminUser(userId);

    if (isAdmin) {
      const { data, error } = await supabase
        .from('trainers')
        .select('id');

      if (error) throw error;
      return data?.map(trainer => trainer.id) || [];
    }

    const { data, error } = await supabase.rpc('get_user_authorized_trainers', {
      p_user_id: userId
    });

    if (error) throw error;
    return data?.map((row: { trainer_id: string }) => row.trainer_id) || [];
  } catch (error) {
    console.error('Error getting authorized trainers:', error);
    return [];
  }
}

export async function getUserNotificationTrainerIds(userId: string): Promise<string[]> {
  try {
    const individualTrainers = await supabase
      .from('user_trainer_permissions')
      .select('trainer_id')
      .eq('user_id', userId)
      .eq('can_receive_notifications', true);

    const trainerTypePerms = await supabase
      .from('user_trainer_type_permissions')
      .select('trainer_type_id')
      .eq('user_id', userId)
      .eq('can_receive_notifications', true);

    if (individualTrainers.error || trainerTypePerms.error) {
      throw individualTrainers.error || trainerTypePerms.error;
    }

    const directTrainerIds = individualTrainers.data?.map(p => p.trainer_id) || [];
    const typeTrainerTypeIds = trainerTypePerms.data?.map(p => p.trainer_type_id) || [];

    if (typeTrainerTypeIds.length === 0) {
      return directTrainerIds;
    }

    const { data: trainersFromTypes, error: trainersError } = await supabase
      .from('trainers')
      .select('id')
      .in('trainer_type_id', typeTrainerTypeIds);

    if (trainersError) throw trainersError;

    const typeBasedTrainerIds = trainersFromTypes?.map(t => t.id) || [];
    const allTrainerIds = [...new Set([...directTrainerIds, ...typeBasedTrainerIds])];

    return allTrainerIds;
  } catch (error) {
    console.error('Error getting notification trainer IDs:', error);
    return [];
  }
}

export async function getBookingsForUser(
  userId: string,
  filters?: {
    searchTerm?: string;
    trainerId?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<BookingWithDetails[]> {
  try {
    const hasCapability = await hasBookingViewCapability(userId);
    if (!hasCapability) {
      return [];
    }

    const authorizedTrainerIds = await getUserAuthorizedTrainerIds(userId);
    if (authorizedTrainerIds.length === 0) {
      return [];
    }

    let query = supabase
      .from('bookings')
      .select(`
        *,
        trainer:trainers(id, name)
      `)
      .in('trainer_id', authorizedTrainerIds)
      .order('booking_date', { ascending: true });

    if (filters?.trainerId) {
      query = query.eq('trainer_id', filters.trainerId);
    }

    if (filters?.startDate) {
      query = query.gte('booking_date', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('booking_date', filters.endDate);
    }

    const { data: bookings, error: bookingsError } = await query;

    if (bookingsError) throw bookingsError;

    let results = bookings || [];

    if (filters?.searchTerm && filters.searchTerm.trim()) {
      const searchLower = filters.searchTerm.toLowerCase();
      results = results.filter(booking =>
        booking.title?.toLowerCase().includes(searchLower) ||
        booking.client_name?.toLowerCase().includes(searchLower) ||
        booking.location?.toLowerCase().includes(searchLower)
      );
    }

    const bookingIds = results.map(b => b.id);
    if (bookingIds.length === 0) {
      return results as BookingWithDetails[];
    }

    const { data: candidates, error: candidatesError } = await supabase
      .from('booking_candidates')
      .select('id, booking_id, candidate_name, telephone, email')
      .in('booking_id', bookingIds);

    if (candidatesError) throw candidatesError;

    const candidatesByBooking = (candidates || []).reduce((acc, candidate) => {
      if (!acc[candidate.booking_id]) {
        acc[candidate.booking_id] = [];
      }
      acc[candidate.booking_id].push(candidate);
      return acc;
    }, {} as Record<string, typeof candidates>);

    return results.map(booking => ({
      ...booking,
      candidates: candidatesByBooking[booking.id] || []
    })) as BookingWithDetails[];

  } catch (error) {
    console.error('Error getting bookings for user:', error);
    return [];
  }
}

export async function checkUserCanViewBooking(userId: string, bookingId: string): Promise<boolean> {
  try {
    const hasCapability = await hasBookingViewCapability(userId);
    if (!hasCapability) {
      return false;
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('trainer_id')
      .eq('id', bookingId)
      .maybeSingle();

    if (error || !booking) {
      return false;
    }

    const authorizedTrainerIds = await getUserAuthorizedTrainerIds(userId);
    return authorizedTrainerIds.includes(booking.trainer_id);
  } catch (error) {
    console.error('Error checking if user can view booking:', error);
    return false;
  }
}

export async function saveUserTrainerPermissions(
  userId: string,
  permissions: Array<{ trainer_id: string; can_receive_notifications: boolean }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: deleteError } = await supabase
      .from('user_trainer_permissions')
      .delete()
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    if (permissions.length > 0) {
      const { error: insertError } = await supabase
        .from('user_trainer_permissions')
        .insert(permissions.map(p => ({
          user_id: userId,
          trainer_id: p.trainer_id,
          can_receive_notifications: p.can_receive_notifications
        })));

      if (insertError) throw insertError;
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving trainer permissions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save permissions'
    };
  }
}

export async function saveUserTrainerTypePermissions(
  userId: string,
  permissions: Array<{ trainer_type_id: string; can_receive_notifications: boolean }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: deleteError } = await supabase
      .from('user_trainer_type_permissions')
      .delete()
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    if (permissions.length > 0) {
      const { error: insertError } = await supabase
        .from('user_trainer_type_permissions')
        .insert(permissions.map(p => ({
          user_id: userId,
          trainer_type_id: p.trainer_type_id,
          can_receive_notifications: p.can_receive_notifications
        })));

      if (insertError) throw insertError;
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving trainer type permissions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save permissions'
    };
  }
}

export async function getUserTrainerPermissions(userId: string): Promise<TrainerPermission[]> {
  try {
    const { data, error } = await supabase
      .from('user_trainer_permissions')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting trainer permissions:', error);
    return [];
  }
}

export async function getUserTrainerTypePermissions(userId: string): Promise<TrainerTypePermission[]> {
  try {
    const { data, error } = await supabase
      .from('user_trainer_type_permissions')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting trainer type permissions:', error);
    return [];
  }
}

export async function getUsersToNotifyForBooking(trainerId: string): Promise<string[]> {
  try {
    const { data: trainer, error: trainerError } = await supabase
      .from('trainers')
      .select('trainer_type_id')
      .eq('id', trainerId)
      .maybeSingle();

    if (trainerError || !trainer) {
      throw trainerError || new Error('Trainer not found');
    }

    const usersWithDirectPermission = await supabase
      .from('user_trainer_permissions')
      .select('user_id')
      .eq('trainer_id', trainerId)
      .eq('can_receive_notifications', true);

    let usersWithTypePermission: { data: any[] | null } = { data: [] };
    if (trainer.trainer_type_id) {
      usersWithTypePermission = await supabase
        .from('user_trainer_type_permissions')
        .select('user_id')
        .eq('trainer_type_id', trainer.trainer_type_id)
        .eq('can_receive_notifications', true);
    }

    if (usersWithDirectPermission.error || usersWithTypePermission.data === null) {
      throw usersWithDirectPermission.error;
    }

    const directUserIds = usersWithDirectPermission.data?.map(p => p.user_id) || [];
    const typeUserIds = usersWithTypePermission.data?.map(p => p.user_id) || [];
    const allUserIds = [...new Set([...directUserIds, ...typeUserIds])];

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .in('id', allUserIds)
      .eq('can_view_bookings', true);

    if (usersError) throw usersError;

    return users?.map(u => u.id) || [];
  } catch (error) {
    console.error('Error getting users to notify:', error);
    return [];
  }
}
