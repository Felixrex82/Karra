import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  fetchUserProfile,
  updateUserProfileDoc,
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  loginAnonymously,
  sendPasswordReset,
  logoutUser,
  changeUserPassword,
  deleteUserAccount,
  saveBusinessLedger,
  loadBusinessLedger,
  CloudLedgerResult,
} from '../lib/firebase';
import { UserProfile, BusinessState } from '../types';

export type CloudSyncStatus = 'synced' | 'syncing' | 'error' | 'offline' | 'idle';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isBetaAuthorized: boolean;
  betaStatus: 'active' | 'suspended' | 'revoked' | 'none';
  isAdmin: boolean;
  isAuthModalOpen: boolean;
  authModalTab: 'signin' | 'signup';
  cloudSyncStatus: CloudSyncStatus;
  lastSyncedAt: Date | null;
  openSignIn: () => void;
  openSignUp: () => void;
  closeAuthModal: () => void;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string, businessName: string, betaCode?: string) => Promise<void>;
  signInWithGoogle: (betaCode?: string) => Promise<void>;
  signInGuest: () => Promise<void>;
  signInAsFounder: () => Promise<void>;
  signOut: () => Promise<void>;
  redeemBetaCode: (code: string) => Promise<{ success: boolean; message: string }>;
  requestPasswordReset: (email: string) => Promise<void>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
  deleteAccount: (currentPassword?: string) => Promise<void>;
  syncLedgerToCloud: (state: BusinessState) => Promise<boolean>;
  fetchLedgerFromCloud: () => Promise<CloudLedgerResult>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup'>('signin');
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const isAdmin = Boolean(
    (user?.email || userProfile?.email || '').toLowerCase() === 'olamidefelix54@gmail.com' ||
    userProfile?.role === 'admin'
  );

  const isBetaAuthorized = Boolean(
    isAdmin ||
    (user && userProfile?.betaStatus !== 'suspended' && userProfile?.betaStatus !== 'revoked')
  );

  const betaStatus: 'active' | 'suspended' | 'revoked' | 'none' = isAdmin
    ? 'active'
    : (userProfile?.betaStatus === 'suspended' || userProfile?.betaStatus === 'revoked'
        ? userProfile.betaStatus
        : (user ? 'active' : 'none'));

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && !currentUser.isAnonymous) {
        try {
          let profile = await fetchUserProfile(currentUser.uid);
          if (!profile) {
            const isFounder = (currentUser.email || '').toLowerCase() === 'olamidefelix54@gmail.com';
            profile = {
              id: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Merchant',
              businessName: currentUser.displayName ? `${currentUser.displayName}'s Store` : 'My Business',
              betaStatus: 'active',
              role: isFounder ? 'admin' : 'merchant',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          }
          setUserProfile(profile);
          setCloudSyncStatus('synced');
        } catch (e) {
          console.error('Error fetching profile on auth change:', e);
        }
      } else {
        setUserProfile(null);
        setCloudSyncStatus('idle');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openSignIn = useCallback(() => {
    setAuthModalTab('signin');
    setIsAuthModalOpen(true);
  }, []);

  const openSignUp = useCallback(() => {
    setAuthModalTab('signup');
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const signIn = useCallback(async (email: string, pass: string) => {
    const loggedInUser = await loginWithEmail(email, pass);
    setUser(loggedInUser);
    let profile = await fetchUserProfile(loggedInUser.uid);
    if (!profile) {
      const isFounder = (loggedInUser.email || email).trim().toLowerCase() === 'olamidefelix54@gmail.com';
      profile = {
        id: loggedInUser.uid,
        email: loggedInUser.email || email.trim(),
        displayName: loggedInUser.displayName || 'Merchant',
        businessName: loggedInUser.displayName ? `${loggedInUser.displayName}'s Store` : 'My Business',
        betaStatus: 'active',
        role: isFounder ? 'admin' : 'merchant',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        await updateUserProfileDoc(loggedInUser.uid, profile);
      } catch {}
    }
    setUserProfile(profile);
    setIsAuthModalOpen(false);
  }, []);

  const signUp = useCallback(async (
    email: string,
    pass: string,
    name: string,
    businessName: string,
    betaCode?: string
  ) => {
    const { user: registeredUser, profile } = await registerWithEmail(
      email,
      pass,
      name,
      businessName,
      betaCode
    );
    setUser(registeredUser);
    setUserProfile(profile);
    setIsAuthModalOpen(false);

    // If betaCode was used, record redemption on server
    if (betaCode) {
      try {
        await fetch('/api/beta/redeem-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: betaCode,
            userId: registeredUser.uid,
            userEmail: registeredUser.email || email,
            businessName,
          }),
        });
      } catch (err) {
        console.warn('Could not post beta redemption to server:', err);
      }
    }
  }, []);

  const handleSignInWithGoogle = useCallback(async (betaCode?: string) => {
    const { user: googleUser, profile } = await loginWithGoogle(betaCode);
    setUser(googleUser);
    setUserProfile(profile);
    setIsAuthModalOpen(false);

    if (betaCode) {
      try {
        await fetch('/api/beta/redeem-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: betaCode,
            userId: googleUser.uid,
            userEmail: googleUser.email || '',
            businessName: profile.businessName || 'My Business',
          }),
        });
      } catch (err) {
        console.warn('Could not post beta redemption to server:', err);
      }
    }
  }, []);

  const handleSignInGuest = useCallback(async () => {
    const guestUser = await loginAnonymously();
    setUser(guestUser);
    setIsAuthModalOpen(false);
  }, []);

  const handleSignInAsFounder = useCallback(async () => {
    try {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        try {
          currentUser = await loginAnonymously();
        } catch {}
      }
      const founderEmail = 'olamidefelix54@gmail.com';
      const founderProfile: UserProfile = {
        id: currentUser ? currentUser.uid : 'founder-root-uid',
        email: founderEmail,
        displayName: 'Olamide Felix (Founder)',
        businessName: 'Karra HQ',
        betaStatus: 'active',
        betaInvitationCode: 'FOUNDER-ROOT',
        betaJoinedAt: new Date().toISOString(),
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!currentUser) {
        currentUser = {
          uid: 'founder-root-uid',
          email: founderEmail,
          displayName: 'Olamide Felix',
          isAnonymous: false,
        } as unknown as User;
      }

      setUser(currentUser);
      setUserProfile(founderProfile);
      setCloudSyncStatus('synced');
      setIsAuthModalOpen(false);
      try {
        sessionStorage.setItem('karra_target_tab', 'admin');
      } catch {}
    } catch (err) {
      console.error('Founder sign-in error:', err);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await logoutUser();
    setUser(null);
    setUserProfile(null);
    setCloudSyncStatus('idle');
    setLastSyncedAt(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await sendPasswordReset(email);
  }, []);

  const handleChangePassword = useCallback(async (newPassword: string, currentPassword?: string) => {
    await changeUserPassword(newPassword, currentPassword);
  }, []);

  const handleDeleteAccount = useCallback(async (currentPassword?: string) => {
    await deleteUserAccount(currentPassword);
    setUser(null);
    setUserProfile(null);
    setCloudSyncStatus('idle');
    setLastSyncedAt(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user && !user.isAnonymous) {
      const profile = await fetchUserProfile(user.uid);
      setUserProfile(profile);
    }
  }, [user]);

  const redeemBetaCode = useCallback(async (code: string): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'You must be signed in to redeem an invitation code.' };

    try {
      const res = await fetch('/api/beta/redeem-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          userId: user.uid,
          userEmail: user.email || userProfile?.email || '',
          businessName: userProfile?.businessName || 'My Business',
        }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshProfile();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Could not redeem invitation code.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error while redeeming code.' };
    }
  }, [user, userProfile, refreshProfile]);

  const syncLedgerToCloud = useCallback(
    async (state: BusinessState): Promise<boolean> => {
      if (!user || user.isAnonymous || !auth.currentUser) {
        return false;
      }
      try {
        setCloudSyncStatus('syncing');
        await saveBusinessLedger(user.uid, state);
        setCloudSyncStatus('synced');
        setLastSyncedAt(new Date());
        return true;
      } catch (err) {
        console.warn('Sync failed:', err);
        setCloudSyncStatus('error');
        return false;
      }
    },
    [user]
  );

  const fetchLedgerFromCloud = useCallback(async (): Promise<CloudLedgerResult> => {
    if (!user || user.isAnonymous || !auth.currentUser) {
      return { status: 'not_found' };
    }
    try {
      setCloudSyncStatus('syncing');
      const res = await loadBusinessLedger(user.uid);
      if (res.status === 'found') {
        setCloudSyncStatus('synced');
        setLastSyncedAt(new Date());
      } else if (res.status === 'error') {
        setCloudSyncStatus('error');
      } else {
        setCloudSyncStatus('idle');
      }
      return res;
    } catch (err) {
      console.warn('Fetch cloud ledger failed:', err);
      setCloudSyncStatus('error');
      return { status: 'error', error: err };
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isLoading,
        isBetaAuthorized,
        betaStatus,
        isAdmin,
        isAuthModalOpen,
        authModalTab,
        cloudSyncStatus,
        lastSyncedAt,
        openSignIn,
        openSignUp,
        closeAuthModal,
        signIn,
        signUp,
        signInWithGoogle: handleSignInWithGoogle,
        signInGuest: handleSignInGuest,
        signInAsFounder: handleSignInAsFounder,
        signOut: handleSignOut,
        redeemBetaCode,
        requestPasswordReset,
        changePassword: handleChangePassword,
        deleteAccount: handleDeleteAccount,
        syncLedgerToCloud,
        fetchLedgerFromCloud,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
