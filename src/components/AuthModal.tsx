import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  Building2,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatAuthErrorMessage } from '../lib/firebase';
import { KarraLogo } from './KarraLogo';

interface AuthModalProps {
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onShowToast }) => {
  const {
    isAuthModalOpen,
    authModalTab,
    closeAuthModal,
    signIn,
    signUp,
    signInWithGoogle,
    signInGuest,
    requestPasswordReset,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'forgot'>(authModalTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // Sync activeTab when authModalTab prop changes from external open trigger
  React.useEffect(() => {
    setActiveTab(authModalTab);
    setErrorMessage(null);
    setResetSent(false);
  }, [authModalTab, isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please provide both your email and password.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await signIn(email, password);
      if (onShowToast) onShowToast('Logged in successfully! Your store is synced.', 'success');
      closeAuthModal();
    } catch (err: any) {
      setErrorMessage(formatAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !businessName) {
      setErrorMessage('Please provide your business name, email address, and a password.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await signUp(email, password, displayName || businessName, businessName);
      if (onShowToast) onShowToast('Account created! Welcome to Karra.', 'success');
      closeAuthModal();
    } catch (err: any) {
      setErrorMessage(formatAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
      if (onShowToast) onShowToast('Signed in with Google successfully!', 'success');
      closeAuthModal();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(formatAuthErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await signInGuest();
      if (onShowToast) onShowToast('Exploring in Guest Demo Mode.', 'info');
      closeAuthModal();
    } catch (err: any) {
      setErrorMessage(formatAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage('Please enter your email address to receive a password reset link.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await requestPasswordReset(email);
      setResetSent(true);
      if (onShowToast) onShowToast('Password reset email sent. Check your inbox.', 'success');
    } catch (err: any) {
      setErrorMessage(formatAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        id="auth-modal-card"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="bg-linear-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 relative">
          <button
            type="button"
            onClick={closeAuthModal}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2.5 mb-1.5">
            <KarraLogo size="xs" variant="green-bg" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-emerald-400">
              Karra Cloud
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white">
            {activeTab === 'signin' && 'Welcome Back'}
            {activeTab === 'signup' && 'Create Merchant Account'}
            {activeTab === 'forgot' && 'Reset Your Password'}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {activeTab === 'signin' && 'Sign in to access your synchronized store ledger & daily books'}
            {activeTab === 'signup' && 'Cloud-backed financial records, debtor tracking & offline sync'}
            {activeTab === 'forgot' && 'Enter your email to receive recovery instructions'}
          </p>

          {/* Tab Switcher (Only if not in forgot password mode) */}
          {activeTab !== 'forgot' && (
            <div className="grid grid-cols-2 gap-1 bg-slate-800/80 p-1 rounded-xl mt-4 border border-slate-700/50">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setErrorMessage(null);
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'signin'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signup');
                  setErrorMessage(null);
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'signup'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Forgot Password View */}
          {activeTab === 'forgot' ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {resetSent ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Email Sent!</h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    We've sent a password reset link to <strong className="text-emerald-900 dark:text-emerald-100">{email}</strong>. Check your inbox and spam folder.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signin');
                      setResetSent(false);
                    }}
                    className="mt-3 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                  >
                    Return to Log In
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="merchant@example.com"
                        className="w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending Link...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Reset Link</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('signin')}
                      className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                    >
                      ← Back to Log In
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : activeTab === 'signin' ? (
            /* Log In Form */
            <form onSubmit={handleSignIn} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="merchant@example.com"
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('forgot')}
                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50 min-h-[42px]"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Log In to Store</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Sign Up Form */
            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Business / Store Name *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Balogun Spares & Electricals"
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Proprietor / Owner Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Chief Emeka Nnamdi"
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="store@example.com"
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password * (Min. 6 chars)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full pl-9 pr-10 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50 min-h-[42px]"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Store Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Social Auth & Demo Divider */}
          {activeTab !== 'forgot' && (
            <>
              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-slate-200 dark:border-slate-800"></div>
                <span className="shrink mx-3 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Or continue with
                </span>
                <div className="grow border-t border-slate-200 dark:border-slate-800"></div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer min-h-[38px] disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  onClick={handleGuestSignIn}
                  disabled={isLoading}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer min-h-[38px] disabled:opacity-50"
                  title="Test immediately with instant guest access"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Guest Demo</span>
                </button>
              </div>

              {/* Security & Cloud Badge */}
              <div className="pt-2 flex items-center justify-center space-x-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Protected by Google Cloud Firestore security rules</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
