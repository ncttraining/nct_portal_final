import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateTrainerRequest {
  email: string;
  password: string;
  fullName: string;
  trainerName: string;
  trainerTypeId: string;
  telephone?: string;
  address1?: string;
  address2?: string;
  town?: string;
  postcode?: string;
  dayRate?: number;
  latitude?: number;
  longitude?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const requestBody: CreateTrainerRequest = await req.json();
    const {
      email,
      password,
      fullName,
      trainerName,
      trainerTypeId,
      telephone = '',
      address1 = '',
      address2 = '',
      town = '',
      postcode = '',
      dayRate = null,
      latitude = null,
      longitude = null,
    } = requestBody;

    if (!email || !password || !fullName || !trainerName || !trainerTypeId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create user using Admin API (this properly sets up all auth tables)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError || !userData.user) {
      return new Response(
        JSON.stringify({ error: createError?.message || 'Failed to create user' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = userData.user.id;

    // Create trainer record
    const { data: trainerData, error: trainerError } = await supabaseAdmin
      .from('trainers')
      .insert({
        name: trainerName,
        email,
        telephone,
        trainer_type_id: trainerTypeId,
        address1,
        address2,
        town,
        postcode,
        day_rate: dayRate,
        latitude,
        longitude,
        active: true,
        user_id: userId,
      })
      .select()
      .single();

    if (trainerError || !trainerData) {
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: trainerError?.message || 'Failed to create trainer' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Update users table with trainer relationship
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        trainer_id: trainerData.id,
        is_trainer: true,
        can_login: true,
        full_name: fullName,
      })
      .eq('id', userId);

    if (updateError) {
      // Rollback
      await supabaseAdmin.from('trainers').delete().eq('id', trainerData.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: updateError.message || 'Failed to update user profile' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        trainerId: trainerData.id,
        email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
