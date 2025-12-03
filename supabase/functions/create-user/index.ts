import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'user';
  can_manage_users: boolean;
  can_manage_bookings: boolean;
  can_manage_courses: boolean;
  can_view_bookings: boolean;
  can_manage_expenses: boolean;
  can_manage_availability: boolean;
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

    // Verify the calling user has permission to manage users
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user has permission to manage users
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('can_manage_users')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile?.can_manage_users) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const requestBody: CreateUserRequest = await req.json();
    const {
      email,
      password,
      full_name,
      role,
      can_manage_users,
      can_manage_bookings,
      can_manage_courses,
      can_view_bookings,
      can_manage_expenses,
      can_manage_availability,
    } = requestBody;

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: 'Email, password, and full name are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create user using Admin API (this doesn't affect the current session)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
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

    // Update users table with permissions
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        full_name,
        role,
        can_manage_users,
        can_manage_bookings,
        can_manage_courses,
        can_view_bookings,
        can_manage_expenses,
        can_manage_availability,
      })
      .eq('id', userId);

    if (updateError) {
      // Rollback: delete the auth user
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
        email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating user:', error);
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