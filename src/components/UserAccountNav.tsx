import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  LogOut,
  Cloud,
  CloudCheck,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  Building2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BusinessState } from '../types';

interface UserAccountNavProps {
  businessState: BusinessState;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const UserAccountNav: React.FC<UserAccountNavProps> = ({
  businessState,
  onShowToast,
}) => {
  const {
    user,
    userProfile,
    isLoading,
    openSignIn,
    openSignUp,
    signOut,
    cloudSyncStatus,
    lastSyncedAt,
    syncLedgerToCloud,
  } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isSyncingManual, setIsSyncingManual] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleManualSync = async () => {
    if (!user || user.isAnonymous) {
      openSignUp();
      return;
    }
    setIsSyncingManual(true);
    try {
      const success = await syncLedgerToCloud(businessState);
      if (success && onShowToast) {
        onShowToast('Ledger successfully synced to Cloud Firestore.', 'success');
      } else if (!success && onShowToast) {
        onShowToast('Cloud sync failed. Please check internet connection.', 'warning');
      }
    } finally {
      setIsSyncingManual(false);
    }
  };

  const handleSignOutClick = async () => {
    try {
      if (user && !user.isAnonymous) {
        try {
          await syncLedgerToCloud(businessState);
        } catch (syncErr) {
          console.warn('Pre-signout sync error:', syncErr);
        }
      }
      await signOut();
      setIsOpen(false);
      if (onShowToast) {
        onShowToast('You have been logged out securely. Your data is saved.', 'info');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="h-8 w-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
    );
  }

  // If user is authenticated (registered)
  if (user && !user.isAnonymous) {
    const initials = (userProfile?.displayName || user.displayName || user.email || 'M')
      .slice(0, 2)
      .toUpperCase();

    const displayName = userProfile?.displayName || user.displayName || 'Merchant';
    const storeName = userProfile?.businessName || businessState.businessName || 'Store';

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          id="btn-user-account-dropdown"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer text-left"
          title="Account and cloud sync menu"
        >
          {/* Avatar with initial */}
          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
            {initials}
          </div>

          <div className="hidden sm:block text-left min-w-0 max-w-[120px]">
            <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
              {displayName}
            </span>
            <div className="flex items-center space-x-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="truncate">Cloud Synced</span>
            </div>
          </div>

          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
            {/* User Details */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 mb-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {displayName}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center space-x-1">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  <span className="truncate max-w-[140px]">{storeName}</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                  Verified
                </span>
              </div>
            </div>

            {/* Cloud Sync Status Card */}
            <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 mb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                    Firestore Cloud Sync
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncingManual}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                  title="Synchronize current state to Firestore"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingManual ? 'animate-spin' : ''}`} />
                  <span>{isSyncingManual ? 'Saving...' : 'Sync Now'}</span>
                </button>
              </div>
              <p className="text-[10px] text-emerald-800 dark:text-emerald-300 mt-1">
                {cloudSyncStatus === 'syncing'
                  ? 'Saving ledger changes to cloud...'
                  : lastSyncedAt
                  ? `Last backed up: ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Automatic background backup is active'}
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={handleSignOutClick}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out of Account</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // If user is Anonymous Guest
  if (user && user.isAnonymous) {
    return (
      <div className="flex items-center space-x-2">
        <button
          id="btn-guest-upgrade"
          type="button"
          onClick={openSignUp}
          className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center space-x-1.5 transition-colors cursor-pointer"
          title="Save your ledger to the cloud by creating a permanent account"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden sm:inline">Guest Demo</span>
          <span className="font-bold underline ml-1">Save Account</span>
        </button>

        <button
          id="btn-nav-sign-in"
          type="button"
          onClick={openSignIn}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
        >
          Log In
        </button>
      </div>
    );
  }

  // Not signed in at all
  return (
    <div className="flex items-center space-x-2">
      <button
        id="btn-nav-sign-in"
        type="button"
        onClick={openSignIn}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
      >
        Log In
      </button>

      <button
        id="btn-nav-sign-up"
        type="button"
        onClick={openSignUp}
        className="px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
      >
        <User className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Sign Up</span>
        <span className="sm:hidden">Join</span>
      </button>
    </div>
  );
};
