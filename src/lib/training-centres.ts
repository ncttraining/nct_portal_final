import { supabase } from './supabase';

export interface TrainingCentre {
  id: string;
  name: string;
  address1: string;
  address2: string;
  town: string;
  postcode: string;
  contact_name: string;
  contact_email: string;
  contact_telephone: string;
  notes: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingCentreRoom {
  id: string;
  centre_id: string;
  room_name: string;
  capacity: number;
  equipment: string;
  notes: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getTrainingCentres(): Promise<TrainingCentre[]> {
  const { data, error } = await supabase
    .from('training_centres')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error loading training centres:', error);
    throw error;
  }

  return data || [];
}

export async function getActiveTrainingCentres(): Promise<TrainingCentre[]> {
  const { data, error } = await supabase
    .from('training_centres')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error loading active training centres:', error);
    throw error;
  }

  return data || [];
}

export async function getRoomsForCentre(centreId: string): Promise<TrainingCentreRoom[]> {
  const { data, error } = await supabase
    .from('training_centre_rooms')
    .select('*')
    .eq('centre_id', centreId)
    .order('sort_order', { ascending: true })
    .order('room_name', { ascending: true });

  if (error) {
    console.error('Error loading rooms:', error);
    throw error;
  }

  return data || [];
}

export async function getActiveRoomsForCentre(centreId: string): Promise<TrainingCentreRoom[]> {
  const { data, error } = await supabase
    .from('training_centre_rooms')
    .select('*')
    .eq('centre_id', centreId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('room_name', { ascending: true });

  if (error) {
    console.error('Error loading active rooms:', error);
    throw error;
  }

  return data || [];
}

export async function checkRoomAvailability(
  roomId: string,
  startDate: string,
  numDays: number,
  excludeBookingId?: string
): Promise<boolean> {
  // Calculate end date based on number of days
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + (numDays - 1));
  const endDate = end.toISOString().split('T')[0];

  // Query for overlapping bookings with the same room
  let query = supabase
    .from('bookings')
    .select('id, booking_date, num_days, room_id')
    .eq('room_id', roomId)
    .neq('status', 'cancelled');

  // Exclude current booking if editing
  if (excludeBookingId) {
    query = query.neq('id', excludeBookingId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error checking room availability:', error);
    return false;
  }

  if (!data || data.length === 0) {
    return true;
  }

  // Check for date range overlaps
  for (const booking of data) {
    const bookingStart = new Date(booking.booking_date + 'T00:00:00');
    const bookingEnd = new Date(bookingStart);
    bookingEnd.setDate(bookingStart.getDate() + (booking.num_days - 1));

    // Check if ranges overlap
    if (start <= bookingEnd && end >= bookingStart) {
      return false; // Room is not available
    }
  }

  return true; // Room is available
}

export async function getUnavailableRoomIds(
  centreId: string,
  startDate: string,
  numDays: number,
  excludeBookingId?: string
): Promise<string[]> {
  // Get all rooms for this centre
  const rooms = await getActiveRoomsForCentre(centreId);

  // Check availability for each room
  const unavailableRooms: string[] = [];

  for (const room of rooms) {
    const isAvailable = await checkRoomAvailability(room.id, startDate, numDays, excludeBookingId);
    if (!isAvailable) {
      unavailableRooms.push(room.id);
    }
  }

  return unavailableRooms;
}
