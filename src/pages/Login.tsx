import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import TwoFactorVerify from '../components/TwoFactorVerify';
import { verifyTwoFactorCode, verifyBackupCode } from '../lib/two-factor-auth';

export default function Login() {
  const { signIn, pendingTwoFactorAuth, completeTwoFactorAuth, cancelTwoFactorAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  // 2FA states
  const [show2FA, setShow2FA] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);

  // Password recovery states (when user clicks reset link from email)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatePasswordLoading, setUpdatePasswordLoading] = useState(false);
  const [updatePasswordSuccess, setUpdatePasswordSuccess] = useState(false);
  const [updatePasswordError, setUpdatePasswordError] = useState('');

  // Check for recovery token in URL on mount
  useEffect(() => {
    // Check URL hash for recovery token (Supabase format)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');

    if (type === 'recovery') {
      setIsRecoveryMode(true);
    }

    // Also listen for auth state changes for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      if (err.message === '2FA_REQUIRED') {
        // Store credentials and show 2FA verification
        setPendingCredentials({ email, password });
        setShow2FA(true);
      } else {
        setError(err.message || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handle2FAVerify(code: string): Promise<boolean> {
    if (!pendingCredentials) return false;

    try {
      // First, sign in again to get the session
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: pendingCredentials.email,
        password: pendingCredentials.password,
      });

      if (signInError) throw signInError;

      // Verify the 2FA code
      const isValid = await verifyTwoFactorCode(code);

      if (!isValid) {
        // Sign out since code was invalid
        await supabase.auth.signOut();
        return false;
      }

      // Clear pending state - auth state change will handle the rest
      setPendingCredentials(null);
      setShow2FA(false);
      await completeTwoFactorAuth();
      return true;
    } catch (err: any) {
      console.error('2FA verification error:', err);
      return false;
    }
  }

  async function handle2FABackupCode(code: string): Promise<boolean> {
    if (!pendingCredentials) return false;

    try {
      // First, sign in again to get the session
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: pendingCredentials.email,
        password: pendingCredentials.password,
      });

      if (signInError) throw signInError;

      // Verify the backup code
      const isValid = await verifyBackupCode(code);

      if (!isValid) {
        // Sign out since code was invalid
        await supabase.auth.signOut();
        return false;
      }

      // Clear pending state - auth state change will handle the rest
      setPendingCredentials(null);
      setShow2FA(false);
      await completeTwoFactorAuth();
      return true;
    } catch (err: any) {
      console.error('Backup code verification error:', err);
      return false;
    }
  }

  function handleCancel2FA() {
    setShow2FA(false);
    setPendingCredentials(null);
    cancelTwoFactorAuth();
  }

  async function handleSendResetEmail(e: React.FormEvent) {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}`,
      });

      if (error) {
        throw error;
      }

      setResetSuccess(true);
    } catch (err: any) {
      setResetError(err.message || 'Failed to send reset email');
    } finally {
      setResetLoading(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setUpdatePasswordError('');

    if (newPassword !== confirmPassword) {
      setUpdatePasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setUpdatePasswordError('Password must be at least 6 characters');
      return;
    }

    setUpdatePasswordLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      setUpdatePasswordSuccess(true);

      // Clear the hash from URL
      window.history.replaceState(null, '', window.location.pathname);

      // Sign out and redirect to login after short delay
      setTimeout(async () => {
        await supabase.auth.signOut();
        setIsRecoveryMode(false);
        setUpdatePasswordSuccess(false);
        setNewPassword('');
        setConfirmPassword('');
      }, 2000);
    } catch (err: any) {
      setUpdatePasswordError(err.message || 'Failed to update password');
    } finally {
      setUpdatePasswordLoading(false);
    }
  }

  function handleBackToLogin() {
    setShowForgotPassword(false);
    setResetEmail('');
    setResetError('');
    setResetSuccess(false);
  }

  // 2FA verification mode
  if (show2FA && pendingCredentials) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-950 to-slate-950 p-5">
        <img
          src="/logo_white.png"
          alt="NCT Logo"
          className="w-64 mb-8"
        />

        <div className="w-full max-w-md bg-gradient-to-br from-slate-950 to-slate-950 border border-slate-800 rounded-3xl shadow-2xl p-8">
          <TwoFactorVerify
            email={pendingCredentials.email}
            fullName={pendingTwoFactorAuth?.fullName || null}
            onVerify={handle2FAVerify}
            onUseBackupCode={handle2FABackupCode}
            onCancel={handleCancel2FA}
          />
        </div>
      </div>
    );
  }

  // Recovery mode - user clicked reset link from email
  if (isRecoveryMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-950 to-slate-950 p-5">
        <img
          src="/logo_white.png"
          alt="NCT Logo"
          className="w-64 mb-8"
        />

        <div className="w-full max-w-md bg-gradient-to-br from-slate-950 to-slate-950 border border-slate-800 rounded-3xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-center mb-6 tracking-wider uppercase text-slate-100">
            Set New Password
          </h2>

          {updatePasswordSuccess ? (
            <div className="text-center text-sm text-green-400 bg-green-900/30 py-4 px-4 rounded-lg">
              <p className="font-semibold">Password updated successfully!</p>
              <p className="text-slate-300 mt-2">Redirecting to login...</p>
            </div>
          ) : (
            <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
              <div>
                <label htmlFor="newPassword" className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  placeholder="Confirm new password"
                />
              </div>

              <button
                type="submit"
                disabled={updatePasswordLoading}
                className="w-full mt-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-full shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {updatePasswordLoading ? 'Updating...' : 'Update Password'}
              </button>

              {updatePasswordError && (
                <p className="text-center text-sm text-red-400 bg-red-900/30 py-2 px-4 rounded-lg">
                  {updatePasswordError}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-950 to-slate-950 p-5">
      <img
        src="/logo_white.png"
        alt="NCT Logo"
        className="w-64 mb-8"
      />

      <div className="w-full max-w-md bg-gradient-to-br from-slate-950 to-slate-950 border border-slate-800 rounded-3xl shadow-2xl p-8">
        {!showForgotPassword ? (
          <>
            <h2 className="text-xl font-semibold text-center mb-6 tracking-wider uppercase text-slate-100">
              Login to NCT Portal
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="email" className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-full shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            {error && (
              <p className="mt-4 text-center text-sm text-red-400 bg-red-900/30 py-2 px-4 rounded-lg">
                {error}
              </p>
            )}
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-center mb-6 tracking-wider uppercase text-slate-100">
              Reset Password
            </h2>

            {resetSuccess ? (
              <div className="space-y-4">
                <div className="text-center text-sm text-green-400 bg-green-900/30 py-4 px-4 rounded-lg space-y-2">
                  <p className="font-semibold">Reset email sent!</p>
                  <p className="text-slate-300">
                    If an account exists with that email address, you will receive a password reset link shortly. Please check your inbox and spam folder.
                  </p>
                </div>
                <button
                  onClick={handleBackToLogin}
                  className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-full transition-colors"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendResetEmail} className="space-y-4">
                <p className="text-sm text-slate-400 text-center mb-4">
                  Enter your email address and we'll send you a link to reset your password.
                </p>

                <div>
                  <label htmlFor="resetEmail" className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="resetEmail"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    placeholder="Enter your email"
                  />
                </div>

                {resetError && (
                  <p className="text-center text-sm text-red-400 bg-red-900/30 py-2 px-4 rounded-lg">
                    {resetError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-full shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>

                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-full transition-colors"
                >
                  Back to Login
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
