import { useState, useRef, useEffect } from 'react';
import { Shield, ArrowLeft, Key } from 'lucide-react';

interface TwoFactorVerifyProps {
  email: string;
  fullName: string | null;
  onVerify: (code: string) => Promise<boolean>;
  onUseBackupCode: (code: string) => Promise<boolean>;
  onCancel: () => void;
  loading?: boolean;
}

export default function TwoFactorVerify({
  email,
  fullName,
  onVerify,
  onUseBackupCode,
  onCancel,
  loading = false,
}: TwoFactorVerifyProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showBackupInput, setShowBackupInput] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (digit && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length > 0) {
      const newCode = [...code];
      for (let i = 0; i < pastedData.length; i++) {
        newCode[i] = pastedData[i];
      }
      setCode(newCode);

      // Focus appropriate input
      const focusIndex = Math.min(pastedData.length, 5);
      inputRefs.current[focusIndex]?.focus();

      // Auto-submit if full code pasted
      if (pastedData.length === 6) {
        handleVerify(pastedData);
      }
    }
  };

  const handleVerify = async (codeToVerify?: string) => {
    const fullCode = codeToVerify || code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const isValid = await onVerify(fullCode);
      if (!isValid) {
        setError('Invalid verification code. Please try again.');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const handleBackupCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupCode.trim()) {
      setError('Please enter your backup code');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const isValid = await onUseBackupCode(backupCode.trim());
      if (!isValid) {
        setError('Invalid backup code. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  if (showBackupInput) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100 mb-2">
            Use Backup Code
          </h2>
          <p className="text-sm text-slate-400">
            Enter one of your backup codes to sign in
          </p>
        </div>

        <form onSubmit={handleBackupCodeSubmit} className="space-y-4">
          <div>
            <label htmlFor="backupCode" className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
              Backup Code
            </label>
            <input
              type="text"
              id="backupCode"
              value={backupCode}
              onChange={(e) => {
                setBackupCode(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="XXXX-XXXX-XX"
              className="w-full px-4 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-slate-100 text-center text-lg tracking-widest font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              disabled={verifying || loading}
            />
          </div>

          {error && (
            <p className="text-center text-sm text-red-400 bg-red-900/30 py-2 px-4 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={verifying || loading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-full shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {verifying ? 'Verifying...' : 'Verify Backup Code'}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowBackupInput(false);
              setBackupCode('');
              setError('');
            }}
            className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-full transition-colors"
          >
            Back to Authenticator
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-100 mb-2">
          Two-Factor Authentication
        </h2>
        <p className="text-sm text-slate-400">
          {fullName ? `Welcome back, ${fullName}` : `Signing in as ${email}`}
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      <div className="flex justify-center gap-2" onPaste={handlePaste}>
        {code.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleCodeChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="w-12 h-14 text-center text-2xl font-semibold bg-slate-900/90 border border-slate-700 rounded-xl text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
            disabled={verifying || loading}
          />
        ))}
      </div>

      {error && (
        <p className="text-center text-sm text-red-400 bg-red-900/30 py-2 px-4 rounded-lg">
          {error}
        </p>
      )}

      <button
        onClick={() => handleVerify()}
        disabled={verifying || loading || code.join('').length !== 6}
        className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-full shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        {verifying ? 'Verifying...' : 'Verify'}
      </button>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowBackupInput(true)}
          className="w-full px-4 py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Use a backup code instead
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-full transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </button>
      </div>
    </div>
  );
}
