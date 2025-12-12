import { useState, useEffect, useRef } from 'react';
import { Shield, Copy, Check, AlertTriangle, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { setupTwoFactor, enableTwoFactor, verifyTwoFactorCode } from '../lib/two-factor-auth';

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

type SetupStep = 'scan' | 'verify' | 'backup' | 'complete';

export default function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<SetupStep>('scan');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    initSetup();
  }, []);

  const initSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await setupTwoFactor();
      setSecret(data.secret);

      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(data.uri, {
        width: 200,
        margin: 2,
        color: {
          dark: '#1e293b',
          light: '#ffffff',
        },
      });
      setQrCodeDataUrl(qrDataUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to set up 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newCode = [...verificationCode];
    newCode[index] = digit;
    setVerificationCode(newCode);
    setError('');

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length > 0) {
      const newCode = [...verificationCode];
      for (let i = 0; i < pastedData.length; i++) {
        newCode[i] = pastedData[i];
      }
      setVerificationCode(newCode);
      const focusIndex = Math.min(pastedData.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = verificationCode.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      // First verify the code is correct
      const isValid = await verifyTwoFactorCode(code, secret);
      if (!isValid) {
        setError('Invalid code. Please check your authenticator app and try again.');
        setVerificationCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // Enable 2FA and get backup codes
      const codes = await enableTwoFactor(code, secret);
      setBackupCodes(codes);
      setStep('backup');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setVerificationCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'secret' | 'backup') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'secret') {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      } else {
        setCopiedBackupCodes(true);
        setTimeout(() => setCopiedBackupCodes(false), 2000);
      }
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      if (type === 'secret') {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      } else {
        setCopiedBackupCodes(true);
        setTimeout(() => setCopiedBackupCodes(false), 2000);
      }
    }
  };

  const formatSecretForDisplay = (secret: string) => {
    return secret.match(/.{1,4}/g)?.join(' ') || secret;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-4" />
        <p className="text-slate-400">Setting up two-factor authentication...</p>
      </div>
    );
  }

  if (error && !secret) {
    return (
      <div className="space-y-4">
        <div className="text-center text-sm text-red-400 bg-red-900/30 py-4 px-4 rounded-lg">
          <p className="font-semibold">{error}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={initSetup}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (step === 'scan') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-1">
            Set Up Authenticator App
          </h3>
          <p className="text-sm text-slate-400">
            Scan this QR code with your authenticator app
          </p>
        </div>

        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-xl">
            <img src={qrCodeDataUrl} alt="2FA QR Code" className="w-48 h-48" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-500 text-center">
            Or enter this code manually:
          </p>
          <div className="flex items-center gap-2 bg-slate-900/50 rounded-lg p-3">
            <code className="flex-1 text-sm text-slate-300 font-mono tracking-wider text-center">
              {formatSecretForDisplay(secret)}
            </code>
            <button
              onClick={() => copyToClipboard(secret, 'secret')}
              className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
              title="Copy secret"
            >
              {copiedSecret ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setStep('verify');
              setTimeout(() => inputRefs.current[0]?.focus(), 100);
            }}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-100 mb-1">
            Verify Setup
          </h3>
          <p className="text-sm text-slate-400">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {verificationCode.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-11 h-13 text-center text-xl font-semibold bg-slate-900/90 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
              disabled={verifying}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-sm text-red-400 bg-red-900/30 py-2 px-4 rounded-lg">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => {
              setStep('scan');
              setVerificationCode(['', '', '', '', '', '']);
              setError('');
            }}
            className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            disabled={verifying}
          >
            Back
          </button>
          <button
            onClick={handleVerify}
            disabled={verifying || verificationCode.join('').length !== 6}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {verifying ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'backup') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-1">
            Save Your Backup Codes
          </h3>
          <p className="text-sm text-slate-400">
            Store these codes in a safe place. You can use them to access your account if you lose your device.
          </p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-2 mb-3">
            {backupCodes.map((code, index) => (
              <code key={index} className="text-sm text-slate-300 font-mono bg-slate-800/50 px-3 py-2 rounded text-center">
                {code}
              </code>
            ))}
          </div>
          <button
            onClick={() => copyToClipboard(backupCodes.join('\n'), 'backup')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 rounded transition-colors"
          >
            {copiedBackupCodes ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy all codes
              </>
            )}
          </button>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <p className="text-xs text-amber-300">
            Each backup code can only be used once. After using a code, it will be invalidated.
          </p>
        </div>

        <button
          onClick={onComplete}
          className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
        >
          I've Saved My Backup Codes
        </button>
      </div>
    );
  }

  return null;
}
