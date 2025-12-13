import { useState } from 'react';
import { Shield, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import TwoFactorSetup from '../components/TwoFactorSetup';

export default function Mandatory2FASetup() {
  const { profile, signOut, reloadProfile } = useAuth();
  const [showSetup, setShowSetup] = useState(false);

  async function handleSetupComplete() {
    setShowSetup(false);
    // Reload the profile to update the 2FA status
    await reloadProfile();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-slate-100 dark:from-slate-800 dark:via-slate-950 dark:to-slate-950 p-5 transition-colors">
      <img
        src="/logo_white.png"
        alt="NCT Logo"
        className="w-64 mb-8"
      />

      <div className="w-full max-w-md bg-white dark:bg-gradient-to-br dark:from-slate-950 dark:to-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-8">
        {!showSetup ? (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Two-Factor Authentication Required
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {profile?.full_name ? `Welcome, ${profile.full_name}!` : 'Welcome!'}
              </p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                For security purposes, all users are required to set up two-factor authentication (2FA) before accessing the NCT Portal.
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                You'll need an authenticator app like Google Authenticator, Microsoft Authenticator, or Authy on your phone.
              </p>
            </div>

            <button
              onClick={() => setShowSetup(true)}
              className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-full shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
            >
              <Shield className="w-5 h-5" />
              Set Up 2FA Now
            </button>

            <button
              onClick={signOut}
              className="w-full mt-4 px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-full transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </>
        ) : (
          <TwoFactorSetup
            onComplete={handleSetupComplete}
            onCancel={() => setShowSetup(false)}
          />
        )}
      </div>
    </div>
  );
}
