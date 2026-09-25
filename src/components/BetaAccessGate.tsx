import React, { useState } from 'react';
import { ShieldAlert, Key, ArrowRight, LogOut, CheckCircle2, AlertCircle, Sparkles, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { KarraLogo } from './KarraLogo';

interface BetaAccessGateProps {
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const BetaAccessGate: React.FC<BetaAccessGateProps> = ({ onShowToast }) => {
  const { user, userProfile, betaStatus, signOut, redeemBetaCode } = useAuth();
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMessage('Please enter your invitation code.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const res = await redeemBetaCode(code.trim().toUpperCase());
      if (res.success) {
        if (onShowToast) onShowToast('Welcome to the Karra Private Beta! Access granted.', 'success');
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error validating code.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B111E] flex flex-col justify-center items-center p-4 selection:bg-emerald-100 dark:selection:bg-emerald-950">
      <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 animate-in fade-in duration-300">
        {/* Karra Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <KarraLogo size="md" />
            <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white">Karra</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60">
              Private Beta
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Signed in as <span className="font-medium text-slate-700 dark:text-slate-300">{user?.email}</span>
          </p>
        </div>

        {/* State 1: Suspended */}
        {betaStatus === 'suspended' && (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Beta Access Suspended</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Your beta account is temporarily on hold. Please reach out directly to the founder for assistance.
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
              Founder contact: <a href="mailto:olamidefelix54@gmail.com" className="font-semibold text-emerald-600 dark:text-emerald-400 underline">olamidefelix54@gmail.com</a>
            </div>
            <button
              onClick={() => signOut()}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* State 2: Revoked */}
        {betaStatus === 'revoked' && (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-center justify-center text-red-600 dark:text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Beta Access Revoked</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Access to the Karra private beta has been ended for this account.
              </p>
            </div>
            <button
              onClick={() => signOut()}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* State 3: Active pass or need invitation code */}
        {betaStatus === 'active' && (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Beta Pass Active</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Your merchant account is verified and ready.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg cursor-pointer transition-all"
            >
              <span>Launch Store Platform</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {betaStatus !== 'suspended' && betaStatus !== 'revoked' && betaStatus !== 'active' && (
          <form onSubmit={handleRedeem} className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Enter Invitation Code
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter your invitation code to activate your private beta pass and unlock your store ledger.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start space-x-2 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Beta Invitation Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="KARRA-XXXX-XXXX"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-slate-900 dark:text-white font-mono tracking-widest text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all uppercase"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isVerifying || !code.trim()}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer transition-all"
            >
              {isVerifying ? (
                <span>Verifying code...</span>
              ) : (
                <>
                  <span>Activate Beta Pass</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => signOut()}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
              >
                Sign out of account
              </button>
              <a
                href="mailto:olamidefelix54@gmail.com?subject=Karra%20Beta%20Access%20Request"
                className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline cursor-pointer"
              >
                Contact founder
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
