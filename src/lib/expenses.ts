import { supabase } from './supabase';

export type FuelType = 'petrol' | 'diesel';
export type EngineSize = '1400cc_or_less' | '1401cc_to_2000cc' | 'over_2000cc';
export type ClaimStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export type Journey = {
  id: string;
  expense_claim_id: string;
  journey_date: string;
  origin: string;
  destination: string;
  miles: number;
  tolls_parking: number;
  created_at: string;
};

export type ExpenseClaim = {
  id: string;
  trainer_id: string;
  trainer_name: string;
  submission_date: string;
  vehicle_registration: string;
  fuel_type: FuelType;
  engine_size: EngineSize;
  total_miles: number;
  total_tolls_parking: number;
  total_amount: number;
  status: ClaimStatus;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  journeys?: Journey[];
};

export type Trainer = {
  id: string;
  name: string;
  email: string;
};

const MILEAGE_RATES = {
  petrol: {
    '1400cc_or_less': 0.45,
    '1401cc_to_2000cc': 0.45,
    'over_2000cc': 0.45
  },
  diesel: {
    '1400cc_or_less': 0.45,
    '1401cc_to_2000cc': 0.45,
    'over_2000cc': 0.45
  }
};

export function calculateMileageRate(fuelType: FuelType, engineSize: EngineSize): number {
  return MILEAGE_RATES[fuelType][engineSize];
}

export function calculateTotalAmount(
  miles: number,
  tollsParking: number,
  fuelType: FuelType,
  engineSize: EngineSize
): number {
  const rate = calculateMileageRate(fuelType, engineSize);
  return (miles * rate) + tollsParking;
}

export async function getCurrentTrainer(): Promise<Trainer | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('email')
    .eq('id', user.id)
    .maybeSingle();

  if (!userData?.email) return null;

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, name, email')
    .ilike('email', userData.email)
    .maybeSingle();

  return trainer;
}

export async function getAllTrainers(): Promise<Trainer[]> {
  const { data, error } = await supabase
    .from('trainers')
    .select('id, name, email')
    .order('name');

  if (error) {
    console.error('Error loading trainers:', error);
    return [];
  }

  return data || [];
}

export async function getExpenseClaims(trainerId?: string): Promise<ExpenseClaim[]> {
  let query = supabase
    .from('expense_claims')
    .select('*')
    .order('submission_date', { ascending: false });

  if (trainerId) {
    query = query.eq('trainer_id', trainerId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading expense claims:', error);
    return [];
  }

  return data || [];
}

export async function getExpenseClaimWithJourneys(claimId: string): Promise<ExpenseClaim | null> {
  const { data: claim, error: claimError } = await supabase
    .from('expense_claims')
    .select('*')
    .eq('id', claimId)
    .maybeSingle();

  if (claimError || !claim) {
    console.error('Error loading expense claim:', claimError);
    return null;
  }

  const { data: journeys } = await supabase
    .from('expense_claim_journeys')
    .select('*')
    .eq('expense_claim_id', claimId)
    .order('journey_date', { ascending: false });

  return {
    ...claim,
    journeys: journeys || []
  };
}

export async function createExpenseClaim(claim: {
  trainer_id: string;
  trainer_name: string;
  vehicle_registration: string;
  fuel_type: FuelType;
  engine_size: EngineSize;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('expense_claims')
    .insert({
      ...claim,
      total_miles: 0,
      total_tolls_parking: 0,
      total_amount: 0,
      status: 'pending'
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating expense claim:', error);
    throw error;
  }

  return data?.id || null;
}

export async function addJourney(journey: {
  expense_claim_id: string;
  journey_date: string;
  origin: string;
  destination: string;
  miles: number;
  tolls_parking: number;
}): Promise<void> {
  const { error } = await supabase
    .from('expense_claim_journeys')
    .insert(journey);

  if (error) {
    console.error('Error adding journey:', error);
    throw error;
  }

  await recalculateTotals(journey.expense_claim_id);
}

export async function updateJourney(
  journeyId: string,
  updates: {
    journey_date?: string;
    origin?: string;
    destination?: string;
    miles?: number;
    tolls_parking?: number;
  }
): Promise<void> {
  const { data: journey, error: fetchError } = await supabase
    .from('expense_claim_journeys')
    .select('expense_claim_id')
    .eq('id', journeyId)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('expense_claim_journeys')
    .update(updates)
    .eq('id', journeyId);

  if (error) {
    console.error('Error updating journey:', error);
    throw error;
  }

  await recalculateTotals(journey.expense_claim_id);
}

export async function updateExpenseClaim(
  claimId: string,
  updates: {
    vehicle_registration?: string;
    fuel_type?: FuelType;
    engine_size?: EngineSize;
  }
): Promise<void> {
  const { error } = await supabase
    .from('expense_claims')
    .update(updates)
    .eq('id', claimId);

  if (error) {
    console.error('Error updating expense claim:', error);
    throw error;
  }

  if (updates.fuel_type || updates.engine_size) {
    await recalculateTotals(claimId);
  }
}

export async function deleteJourney(journeyId: string): Promise<void> {
  const { data: journey, error: fetchError } = await supabase
    .from('expense_claim_journeys')
    .select('expense_claim_id')
    .eq('id', journeyId)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('expense_claim_journeys')
    .delete()
    .eq('id', journeyId);

  if (error) {
    console.error('Error deleting journey:', error);
    throw error;
  }

  await recalculateTotals(journey.expense_claim_id);
}

async function recalculateTotals(claimId: string): Promise<void> {
  const { data: claim } = await supabase
    .from('expense_claims')
    .select('fuel_type, engine_size')
    .eq('id', claimId)
    .single();

  if (!claim) return;

  const { data: journeys } = await supabase
    .from('expense_claim_journeys')
    .select('miles, tolls_parking')
    .eq('expense_claim_id', claimId);

  if (!journeys) return;

  const totalMiles = journeys.reduce((sum, j) => sum + Number(j.miles), 0);
  const totalTollsParking = journeys.reduce((sum, j) => sum + Number(j.tolls_parking), 0);
  const totalAmount = calculateTotalAmount(
    totalMiles,
    totalTollsParking,
    claim.fuel_type,
    claim.engine_size
  );

  await supabase
    .from('expense_claims')
    .update({
      total_miles: totalMiles,
      total_tolls_parking: totalTollsParking,
      total_amount: totalAmount
    })
    .eq('id', claimId);
}

export async function submitExpenseClaim(claimId: string): Promise<void> {
  const { error } = await supabase
    .from('expense_claims')
    .update({ status: 'pending' })
    .eq('id', claimId);

  if (error) {
    console.error('Error submitting expense claim:', error);
    throw error;
  }
}

export async function updateClaimStatus(
  claimId: string,
  status: ClaimStatus,
  notes?: string
): Promise<void> {
  const updates: any = { status, notes };

  if (status === 'paid') {
    updates.payment_date = new Date().toISOString().split('T')[0];
  }

  const { error } = await supabase
    .from('expense_claims')
    .update(updates)
    .eq('id', claimId);

  if (error) {
    console.error('Error updating claim status:', error);
    throw error;
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(amount);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function getStatusBadgeColor(status: ClaimStatus): string {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  };
  return colors[status];
}

export function getEngineSizeLabel(engineSize: EngineSize): string {
  const labels = {
    '1400cc_or_less': '1400cc or less',
    '1401cc_to_2000cc': '1401cc to 2000cc',
    'over_2000cc': 'Over 2000cc'
  };
  return labels[engineSize];
}
