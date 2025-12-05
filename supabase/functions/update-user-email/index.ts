import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UpdateEmailRequest {
  userId: string;
  newEmail: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: adminUser } = await supabaseClient
      .from("users")
      .select("can_manage_users")
      .eq("id", user.id)
      .single();

    if (!adminUser?.can_manage_users) {
      throw new Error("Unauthorized: Only admins can update user emails");
    }

    const { userId, newEmail }: UpdateEmailRequest = await req.json();

    if (!userId || !newEmail) {
      throw new Error("userId and newEmail are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new Error("Invalid email format");
    }

    const { data: existingUser, error: checkError } = await supabaseClient
      .from("users")
      .select("email")
      .eq("email", newEmail)
      .neq("id", userId)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Error checking existing email: ${checkError.message}`);
    }

    if (existingUser) {
      throw new Error("Email already in use by another user");
    }

    const { error: authUpdateError } = await supabaseClient.auth.admin.updateUserById(
      userId,
      { email: newEmail }
    );

    if (authUpdateError) {
      throw new Error(`Failed to update auth email: ${authUpdateError.message}`);
    }

    const { error: publicUpdateError } = await supabaseClient
      .from("users")
      .update({ email: newEmail })
      .eq("id", userId);

    if (publicUpdateError) {
      throw new Error(`Failed to update public email: ${publicUpdateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email updated successfully",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});