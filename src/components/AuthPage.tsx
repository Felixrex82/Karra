import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Building2,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Key,
  ShieldCheck,
  Send,
  HelpCircle,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatAuthErrorMessage } from '../lib/firebase';
import { KarraLogo } from './KarraLogo';
import { LandingPage } from './LandingPage';

interface AuthPageProps {
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onShowToast,
  theme = 'light',
  onToggleTheme,
}) => {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    requestPasswordReset,
  } = useAuth();

  // Primary mode: 'landing' | 'invite_gate' | 'signup' | 'signin' | 'request_access' | 'forgot'
  const [mode, setMode] = useState<'landing' | 'invite_gate' | 'signup' | 'signin' | 'request_access' | 'forgot'>('landing');

  // Invitation code state
  const [invitationCode, setInvitationCode] = useState('');
  const [validatedCode, setValidatedCode] = useState<string | null>(null);
  const [invitationLabel, setInvitationLabel] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isCheckingCode, setIsCheckingCode] = useState(false);

  // Form input fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // Request Access form fields
  const [reqFullName, setReqFullName] = useState('');
  const [reqBusinessName, setReqBusinessName] = useState('');
  const [reqPhone, setReqPhone] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [reqSuccess, setReqSuccess] = useState(false);
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

  /**
   * Validate Invitation Code with server
   */
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = invitationCode.trim().toUpperCase();
    if (!cleanCode) {
      setCodeError("Please enter your invitation code.");
      return;
    }

    setIsCheckingCode(true);
    setCodeError(null);

    try {
      const res = await fetch('/api/beta/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode }),
      });
      const data = await res.json();

      if (data.valid) {
        setValidatedCode(cleanCode);
        setInvitationLabel(data.invitation?.notes || null);
        setMode('signup');
        if (onShowToast) onShowToast('Invitation code verified! Please set up your business account.', 'success');
      } else {
        setCodeError(data.message || "That invitation code isn't valid.");
      }
    } catch (err: any) {
      setCodeError("Unable to verify invitation code. Please check your internet connection.");
    } finally {
      setIsCheckingCode(false);
    }
  };

  /**
   * Sign In existing beta tester or founder
   */
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await signIn(email.trim(), password);
      if (onShowToast) onShowToast('Welcome back! Store ledger loaded.', 'success');
    } catch (err: any) {
      setErrorMessage(formatAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Sign Up with verified invitation code
   */
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !businessName.trim()) {
      setErrorMessage('Please provide your Business Name, Email address, and Password.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await signUp(
        email.trim(),
        password,
        displayName.trim() || businessName.trim(),
        businessName.trim(),
        validatedCode || undefined
      );
      if (onShowToast) onShowToast('Beta account created! Welcome to Karra.', 'success');
    } catch (err: any) {
      setErrorMessage(formatAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Google Sign-in with verified invitation code (or existing user)
   */
  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle(validatedCode || undefined);
      if (onShowToast) onShowToast('Welcome to Karra!', 'success');
    } catch (err: any) {
      setErrorMessage(formatAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Submit access request to the founder
   */
  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqFullName.trim() || !reqBusinessName.trim() || !reqEmail.trim()) {
      setErrorMessage('Please fill in your name, business name, and email address.');
      return;
    }

    setIsSubmittingReq(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/beta/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: reqFullName,
          businessName: reqBusinessName,
          phone: reqPhone,
          email: reqEmail,
          notes: reqNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReqSuccess(true);
      } else {
        setErrorMessage(data.error || 'Failed to submit request.');
      }
    } catch (err: any) {
      setErrorMessage('Network connection error. Please try again.');
    } finally {
      setIsSubmittingReq(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Enter the email associated with your business account.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await requestPasswordReset(email.trim());
      setResetSent(true);
      if (onShowToast) onShowToast('Password recovery email sent! Check your inbox.', 'info');
    } catch (err: any) {
      setErrorMessage(formatAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // SCREEN 0: LANDING PAGE (Comes First Before Code Gate or Login)
  // =========================================================================
  if (mode === 'landing') {
    return (
      <LandingPage
        onEnterCode={() => {
          setErrorMessage(null);
          setCodeError(null);
          setMode('invite_gate');
        }}
        onSignIn={() => {
          setErrorMessage(null);
          setMode('signin');
        }}
        onSignUp={() => {
          setErrorMessage(null);
          setMode('signup');
        }}
        onRequestAccess={() => {
          setErrorMessage(null);
          setMode('request_access');
        }}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B111E] flex flex-col justify-between selection:bg-emerald-100 dark:selection:bg-emerald-950 font-sans">
      {/* Top Navbar for Code Entry / Auth Views */}
      <nav className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            type="button"
            onClick={() => setMode('landing')}
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all active:scale-95"
            title="Return to Landing Page"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('landing')}
            className="flex items-center space-x-2.5 cursor-pointer text-left focus:outline-none group"
            title="Return to Karra Overview"
          >
            <KarraLogo size="sm" variant="green-bg" className="group-hover:scale-105 transition-transform duration-200" />
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white leading-none">
              Karra
            </span>
          </button>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          {mode !== 'signin' && (
            <button
              onClick={() => {
                setErrorMessage(null);
                setMode('signin');
              }}
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all"
            >
              Sign In
            </button>
          )}

          {mode !== 'invite_gate' && (
            <button
              onClick={() => {
                setErrorMessage(null);
                setCodeError(null);
                setMode('invite_gate');
              }}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 py-1.5 px-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer transition-all"
            >
              Enter Code
            </button>
          )}
        </div>
      </nav>

      {/* Main Centered Content */}
      <main className="w-full max-w-lg mx-auto px-4 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        <div className="bg-white dark:bg-[#111827] rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-10 transition-all">
          
          {/* =========================================================================
              SCREEN 1: INVITATION CODE GATE (Step 2: Enter Code)
             ========================================================================= */}
          {mode === 'invite_gate' && (
            <div className="animate-in fade-in duration-300">
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                  <Key className="w-7 h-7" />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  You're invited to the Karra private beta.
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  Enter your invitation code to get started.
                </p>
              </div>

              {codeError && (
                <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start space-x-2.5 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <span className="font-medium leading-relaxed">{codeError}</span>
                </div>
              )}

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Invitation Code
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={invitationCode}
                      onChange={(e) => {
                        setInvitationCode(e.target.value.toUpperCase());
                        setCodeError(null);
                      }}
                      placeholder="KARRA-XXXX-XXXX"
                      autoFocus
                      className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-slate-900 dark:text-white font-mono text-center tracking-widest text-base sm:text-lg uppercase font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal placeholder:text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isCheckingCode || !invitationCode.trim()}
                  className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer transition-all"
                >
                  {isCheckingCode ? (
                    <span>Verifying code...</span>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom links */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCodeError(null);
                    setMode('signin');
                  }}
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Already registered? <span className="font-semibold text-emerald-600 dark:text-emerald-400">Sign in</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCodeError(null);
                    setMode('landing');
                  }}
                  className="inline-flex items-center space-x-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Overview</span>
                </button>
              </div>

              <div className="mt-3.5 pt-3 border-t border-dashed border-slate-100 dark:border-slate-800 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setCodeError(null);
                    setMode('request_access');
                  }}
                  className="text-xs text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  Don't have an invitation code? <span className="font-semibold underline">Request access</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              SCREEN 2: SIGN UP / ACCOUNT CREATION
             ========================================================================= */}
          {mode === 'signup' && (
            <div className="animate-in fade-in duration-300">
              <div className="text-center mb-6">
                {validatedCode ? (
                  <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-3">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Beta Pass Verified: {validatedCode}</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Karra Business Workspace</span>
                  </div>
                )}
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Create your Karra account
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {invitationLabel ? `Reserved for: ${invitationLabel}` : 'Set up your business workspace.'}
                </p>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start space-x-2 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSignUp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Business Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Iya Basira Wholesale Provisions"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Basirat Adeyemi"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Password (min. 6 characters)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 mt-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer transition-all flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <span>Creating workspace...</span>
                  ) : (
                    <>
                      <span>Activate Beta Account & Enter</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white dark:bg-[#111827] px-2 text-slate-400">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center space-x-2.5 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('signin');
                  }}
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Already have an account? <span className="font-semibold text-emerald-600 dark:text-emerald-400">Sign in</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('landing');
                  }}
                  className="inline-flex items-center space-x-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Overview</span>
                </button>
              </div>

              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('invite_gate');
                  }}
                  className="text-xs text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                >
                  Use a different invitation code
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              SCREEN 3: SIGN IN (Existing Accounts)
             ========================================================================= */}
          {mode === 'signin' && (
            <div className="animate-in fade-in duration-300">
              <div className="text-center mb-6">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Sign in to your store
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Access your business ledger and records.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start space-x-2 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSignIn} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 mt-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer transition-all flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? <span>Signing in...</span> : <span>Sign In to Store</span>}
                </button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white dark:bg-[#111827] px-2 text-slate-400">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center space-x-2.5 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('signup');
                  }}
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Need an account? <span className="font-semibold text-emerald-600 dark:text-emerald-400">Sign up</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('landing');
                  }}
                  className="inline-flex items-center space-x-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Overview</span>
                </button>
              </div>

              <div className="mt-3 text-center space-y-2">
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setMode('invite_gate');
                    }}
                    className="text-xs text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                  >
                    Have an invitation code? Join Private Beta
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              SCREEN 4: REQUEST BETA ACCESS (For visitors without code)
             ========================================================================= */}
          {mode === 'request_access' && (
            <div className="animate-in fade-in duration-300">
              <div className="text-center mb-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <Send className="w-6 h-6" />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Request Private Beta Access
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Karra is currently admitting a limited cohort of Nigerian businesses. Tell us about yours.
                </p>
              </div>

              {reqSuccess ? (
                <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Request Received!
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Thank you! The founder will review your request and send an invitation code to <span className="font-semibold">{reqEmail}</span> as soon as a tester slot opens.
                  </p>
                  <button
                    onClick={() => {
                      setReqSuccess(false);
                      setMode('invite_gate');
                    }}
                    className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 underline cursor-pointer"
                  >
                    Back to invitation screen
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRequestAccess} className="space-y-3.5">
                  {errorMessage && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start space-x-2 text-xs text-red-700 dark:text-red-300">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={reqFullName}
                      onChange={(e) => setReqFullName(e.target.value)}
                      placeholder="e.g. Olamide Felix"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Business Name & Type
                    </label>
                    <input
                      type="text"
                      value={reqBusinessName}
                      onChange={(e) => setReqBusinessName(e.target.value)}
                      placeholder="e.g. Lagos Grain Wholesalers (Alaba)"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Phone / WhatsApp
                      </label>
                      <input
                        type="tel"
                        value={reqPhone}
                        onChange={(e) => setReqPhone(e.target.value)}
                        placeholder="0801 234 5678"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={reqEmail}
                        onChange={(e) => setReqEmail(e.target.value)}
                        placeholder="you@gmail.com"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      What is your biggest daily accounting challenge? (Optional)
                    </label>
                    <textarea
                      value={reqNotes}
                      onChange={(e) => setReqNotes(e.target.value)}
                      placeholder="e.g. Tracking customer debts and calculating wholesale bag yields..."
                      rows={2}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingReq}
                    className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer transition-all flex items-center justify-center space-x-2"
                  >
                    {isSubmittingReq ? <span>Submitting request...</span> : <span>Submit Beta Request</span>}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setMode('invite_gate')}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 cursor-pointer"
                    >
                      &larr; Back to Code Entry
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('landing')}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium cursor-pointer"
                    >
                      Back to Overview
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* =========================================================================
              SCREEN 5: FORGOT PASSWORD
             ========================================================================= */}
          {mode === 'forgot' && (
            <div className="animate-in fade-in duration-300">
              <div className="text-center mb-6">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Reset Password
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  We will send a secure reset link to your email.
                </p>
              </div>

              {resetSent ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center space-y-2 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="font-semibold text-slate-900 dark:text-white">Email Sent</p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Check your inbox and spam folder for instructions to reset your password.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setResetSent(false);
                      setMode('signin');
                    }}
                    className="mt-3 font-semibold text-emerald-600 dark:text-emerald-400 underline cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  {errorMessage && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start space-x-2 text-xs text-red-700 dark:text-red-300">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Registered Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md cursor-pointer transition-all"
                  >
                    {isSubmitting ? 'Sending link...' : 'Send Recovery Email'}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setMode('signin')}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 dark:text-slate-600">
        Karra Operating System &bull; Private Beta v1.0 &bull; Lagos, Nigeria
      </footer>
    </div>
  );
};
