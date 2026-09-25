import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AdminDashboardView } from './AdminDashboardView';
import { KarraLogo } from './KarraLogo';

interface AdminPortalPageProps {
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
  onExitAdmin: () => void;
  theme?: 'light' | 'dark';
}

const FOUNDER_EMAIL = 'olamidefelix54@gmail.com';
const ADMIN_SESSION_KEY = 'karra_admin_auth_token';

export const AdminPortalPage: React.FC<AdminPortalPageProps> = ({
  onShowToast,
  onExitAdmin,
  theme = 'light',
}) => {
  const { user, signInAsFounder, signIn } = useAuth();
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [email, setEmail] = useState(FOUNDER_EMAIL);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if session is already authenticated
  useEffect(() => {
    try {
      const isAuth = sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
      if (isAuth) {
        setIsAdminAuthenticated(true);
      }
    } catch {}
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPass = password.trim();

    if (!normalizedEmail || !trimmedPass) {
      setErrorMessage('Please enter both your founder email and admin password.');
      setIsSubmitting(false);
      return;
    }

    if (normalizedEmail !== FOUNDER_EMAIL.toLowerCase()) {
      setErrorMessage('Access denied: Invalid admin email. Access is restricted to the platform founder.');
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Authenticate with server-side admin login endpoint
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: trimmedPass }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Access denied: Invalid admin credentials.');
        setIsSubmitting(false);
        return;
      }

      // Store authenticated admin token in session storage
      if (data.token) {
        sessionStorage.setItem('karra_admin_token', data.token);
      }

      // 2. Authorize founder in AuthContext
      await signInAsFounder();

      // 3. Persist admin session in sessionStorage
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      setIsAdminAuthenticated(true);
      if (onShowToast) {
        onShowToast('Welcome, Founder! Admin dashboard unlocked.', 'success');
      }
    } catch (err: any) {
      console.error('Founder login error:', err);
      setErrorMessage(err.message || 'Could not complete admin sign-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminSignOut = () => {
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      sessionStorage.removeItem('karra_admin_token');
    } catch {}
    setIsAdminAuthenticated(false);
    setPassword('');
    setErrorMessage(null);
    if (onShowToast) {
      onShowToast('Signed out of Admin Console.', 'info');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-purple-900 selection:text-white">
      {/* Top Admin Bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-tight text-white">Karra Founder Portal</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-950 text-purple-300 border border-purple-800/80">
                Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Restricted Platform Administration</p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {isAdminAuthenticated && (
            <button
              type="button"
              onClick={handleAdminSignOut}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors cursor-pointer"
              title="Lock Admin Dashboard"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Sign Out Admin</span>
            </button>
          )}

          <button
            type="button"
            onClick={onExitAdmin}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors cursor-pointer"
            title="Return to the store app"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
            <span>Go to Platform</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {!isAdminAuthenticated ? (
          // ==========================================
          // ADMIN LOGIN GATE (Founder Only)
          // ==========================================
          <div className="flex-1 flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-400" />

              <div className="text-center mb-6 pt-2">
                <div className="w-14 h-14 rounded-2xl bg-purple-950/60 border border-purple-800/80 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <Lock className="w-6 h-6 text-purple-400" />
                </div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">Admin Authentication</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Access restricted to the platform founder. Sign in to view and manage beta users, invitations, and metrics.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Admin Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="w-4 h-4 text-slate-500" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="olamidefelix54@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Admin Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 text-slate-500" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter admin password"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-bold text-sm shadow-md hover:shadow-purple-500/20 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isSubmitting ? 'Authenticating...' : 'Sign In as Admin'}</span>
                  </button>
                </div>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-900 text-center">
                <button
                  type="button"
                  onClick={onExitAdmin}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Return to Karra Store</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          // ==========================================
          // AUTHENTICATED ADMIN DASHBOARD
          // ==========================================
          <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            <AdminDashboardView
              onShowToast={onShowToast}
              onNavigateTab={(tab) => {
                if (tab === 'dashboard' || tab === 'profile') {
                  onExitAdmin();
                }
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
};
