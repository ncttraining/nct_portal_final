import { useAuth } from '../contexts/AuthContext';
import Login from '../pages/Login';
import Mandatory2FASetup from '../pages/Mandatory2FASetup';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, requires2FASetup } = useAuth();

  // Check if this is a password recovery redirect
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const isRecovery = hashParams.get('type') === 'recovery';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  // Show Login page for recovery mode (even if user is technically "signed in" with recovery token)
  if (!user || isRecovery) {
    return <Login />;
  }

  // Enforce 2FA setup for all users
  if (requires2FASetup) {
    return <Mandatory2FASetup />;
  }

  return <>{children}</>;
}
