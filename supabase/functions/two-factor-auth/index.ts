import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { TOTP } from 'npm:otpauth@9.2.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Generate a random base32 secret
function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const randomBytes = crypto.getRandomValues(new Uint8Array(20));
  for (let i = 0; i < 20; i++) {
    secret += chars[randomBytes[i] % 32];
  }
  return secret;
}

// Generate backup codes
function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(5));
    const code = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    // Format as XXXX-XXXX-XX
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 10)}`);
  }
  return codes;
}

// Create TOTP instance
function createTOTP(secret: string, email: string): TOTP {
  return new TOTP({
    issuer: 'NCT Portal',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secret,
  });
}

interface TwoFactorRequest {
  action: 'setup' | 'verify' | 'enable' | 'disable' | 'verify-backup' | 'status';
  code?: string;
  secret?: string;
  backupCodes?: string[];
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

    // Verify the calling user
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

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('email, full_name, two_factor_enabled, two_factor_secret')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const requestBody: TwoFactorRequest = await req.json();
    const { action, code, secret } = requestBody;

    switch (action) {
      case 'status': {
        // Return current 2FA status
        return new Response(
          JSON.stringify({
            enabled: profile.two_factor_enabled || false,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'setup': {
        // Generate new secret and return QR code URI
        const newSecret = generateSecret();
        const totp = createTOTP(newSecret, profile.email);
        const uri = totp.toString();

        return new Response(
          JSON.stringify({
            secret: newSecret,
            uri: uri,
            qrData: uri,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'verify': {
        // Verify a TOTP code (for login or setup verification)
        if (!code) {
          return new Response(
            JSON.stringify({ error: 'Code is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Use provided secret (for setup) or stored secret (for login)
        const secretToUse = secret || profile.two_factor_secret;

        if (!secretToUse) {
          return new Response(
            JSON.stringify({ error: '2FA is not set up for this account' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const totp = createTOTP(secretToUse, profile.email);
        const delta = totp.validate({ token: code, window: 1 });
        const isValid = delta !== null;

        return new Response(
          JSON.stringify({
            valid: isValid,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'enable': {
        // Enable 2FA after verifying the code
        if (!code || !secret) {
          return new Response(
            JSON.stringify({ error: 'Code and secret are required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Verify the code first
        const totp = createTOTP(secret, profile.email);
        const delta = totp.validate({ token: code, window: 1 });

        if (delta === null) {
          return new Response(
            JSON.stringify({ error: 'Invalid verification code' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Generate backup codes
        const backupCodes = generateBackupCodes(10);

        // Enable 2FA
        const { error: enableError } = await supabaseAdmin.rpc('enable_user_2fa', {
          p_user_id: user.id,
          p_secret: secret,
          p_backup_codes: backupCodes,
        });

        if (enableError) {
          return new Response(
            JSON.stringify({ error: 'Failed to enable 2FA' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            backupCodes: backupCodes,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'disable': {
        // Disable 2FA - require current code verification
        if (!code) {
          return new Response(
            JSON.stringify({ error: 'Current 2FA code is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        if (!profile.two_factor_enabled || !profile.two_factor_secret) {
          return new Response(
            JSON.stringify({ error: '2FA is not enabled' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Verify current code
        const totp = createTOTP(profile.two_factor_secret, profile.email);
        const delta = totp.validate({ token: code, window: 1 });

        if (delta === null) {
          return new Response(
            JSON.stringify({ error: 'Invalid verification code' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Disable 2FA
        const { error: disableError } = await supabaseAdmin.rpc('disable_user_2fa', {
          p_user_id: user.id,
        });

        if (disableError) {
          return new Response(
            JSON.stringify({ error: 'Failed to disable 2FA' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'verify-backup': {
        // Verify a backup code
        if (!code) {
          return new Response(
            JSON.stringify({ error: 'Backup code is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Normalize the backup code (uppercase, with dashes)
        const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const formattedCode = `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4, 8)}-${normalizedCode.slice(8, 10)}`;

        // Verify and consume the backup code
        const { data: isValid, error: verifyError } = await supabaseAdmin.rpc('verify_and_consume_backup_code', {
          p_user_id: user.id,
          p_backup_code: formattedCode,
        });

        if (verifyError) {
          return new Response(
            JSON.stringify({ error: 'Failed to verify backup code' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({
            valid: isValid,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }
  } catch (error) {
    console.error('Error in 2FA function:', error);
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
