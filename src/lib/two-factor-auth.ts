import { supabase } from './supabase';

export interface TwoFactorSetupResponse {
  secret: string;
  uri: string;
  qrData: string;
}

export interface TwoFactorEnableResponse {
  success: boolean;
  backupCodes: string[];
}

export interface TwoFactorVerifyResponse {
  valid: boolean;
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
}

async function callTwoFactorFunction<T>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await supabase.functions.invoke('two-factor-auth', {
    body: { action, ...params },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Two-factor authentication request failed');
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data as T;
}

/**
 * Get the current 2FA status for the logged-in user
 */
export async function getTwoFactorStatus(): Promise<boolean> {
  const result = await callTwoFactorFunction<TwoFactorStatusResponse>('status');
  return result.enabled;
}

/**
 * Start 2FA setup - generates a new secret and returns QR code data
 */
export async function setupTwoFactor(): Promise<TwoFactorSetupResponse> {
  return callTwoFactorFunction<TwoFactorSetupResponse>('setup');
}

/**
 * Verify a TOTP code
 * @param code - The 6-digit code from the authenticator app
 * @param secret - Optional secret for setup verification (not needed for login)
 */
export async function verifyTwoFactorCode(
  code: string,
  secret?: string
): Promise<boolean> {
  const result = await callTwoFactorFunction<TwoFactorVerifyResponse>('verify', {
    code,
    ...(secret && { secret }),
  });
  return result.valid;
}

/**
 * Enable 2FA after verifying the setup code
 * @param code - The 6-digit code to verify
 * @param secret - The secret that was generated during setup
 */
export async function enableTwoFactor(
  code: string,
  secret: string
): Promise<string[]> {
  const result = await callTwoFactorFunction<TwoFactorEnableResponse>('enable', {
    code,
    secret,
  });
  return result.backupCodes;
}

/**
 * Disable 2FA (requires current code verification)
 * @param code - Current 6-digit code to verify before disabling
 */
export async function disableTwoFactor(code: string): Promise<void> {
  await callTwoFactorFunction<{ success: boolean }>('disable', { code });
}

/**
 * Verify a backup code (will consume the code if valid)
 * @param code - The backup code
 */
export async function verifyBackupCode(code: string): Promise<boolean> {
  const result = await callTwoFactorFunction<TwoFactorVerifyResponse>('verify-backup', {
    code,
  });
  return result.valid;
}

/**
 * Check if user has 2FA enabled (for login flow)
 * This uses a direct database query since we need to check before full auth
 */
export async function checkUserHas2FA(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_user_2fa_status', {
    user_id: userId,
  });

  if (error) {
    console.error('Error checking 2FA status:', error);
    return false;
  }

  return data?.[0]?.has_2fa || false;
}
