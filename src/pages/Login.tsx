import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  function handleShowForgotPassword() {
    setShowForgotPassword(true);
    setResetSuccess(true); // Show the contact admin message immediately
  }

  function handleBackToLogin() {
    setShowForgotPassword(false);
    setResetEmail('');
    setResetError('');
    setResetSuccess(false);
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
                  onClick={handleShowForgotPassword}
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

            <div className="space-y-4">
              <div className="text-center text-sm text-blue-400 bg-blue-900/30 py-4 px-4 rounded-lg space-y-2">
                <p className="font-semibold">Forgot your password?</p>
                <p className="text-slate-300">
                  Please contact your system administrator to reset your password. They will send you a new temporary password via email.
                </p>
              </div>
              <button
                onClick={handleBackToLogin}
                className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-full transition-colors"
              >
                Back to Login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
