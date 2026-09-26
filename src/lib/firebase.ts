import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  deleteDoc,
  getDoc,
  setDoc,
  updateDoc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import { BusinessState, UserProfile } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with configured database ID
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Validate connection to Firestore as mandated in the system skill
 */
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase Firestore is currently offline or unreachable.');
    }
  }
}

// Fire connection verification test
testConnection();

/**
 * Recursively sanitizes any JavaScript object or array for Cloud Firestore.
 * Cloud Firestore strictly forbids `undefined` values anywhere in a document payload
 * and throws: "Function setDoc() called with invalid data. Unsupported field value: undefined".
 *
 * This function:
 * 1. Deeply scrubs all undefined keys and values using JSON serialization.
 * 2. Recursively removes keys with `undefined` values from all objects.
 * 3. Converts undefined values in arrays to null or filters them out.
 * 4. Converts Date instances to ISO strings.
 * 5. Normalizes NaN / Infinite numbers to 0.
 * 6. Returns a clean Firestore-compatible plain object or value.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined || data === null) {
    return (data === undefined ? null : data) as any;
  }
  if (typeof data !== 'object') {
    if (typeof data === 'number' && (isNaN(data) || !isFinite(data))) {
      return 0 as any;
    }
    return data;
  }
  if (data instanceof Date) {
    return data.toISOString() as any;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }

  // Pre-clean via JSON to strip non-enumerable undefined properties and prototype leaks
  try {
    const jsonStr = JSON.stringify(data, (key, value) => {
      if (value === undefined) return undefined;
      if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) return 0;
      return value;
    });
    if (!jsonStr) return {} as any;
    const parsed = JSON.parse(jsonStr);

    const cleanObject: Record<string, any> = {};
    for (const [key, val] of Object.entries(parsed as Record<string, any>)) {
      if (val !== undefined) {
        cleanObject[key] = sanitizeForFirestore(val);
      }
    }
    return cleanObject as T;
  } catch {
    const cleanObject: Record<string, any> = {};
    for (const [key, val] of Object.entries(data as Record<string, any>)) {
      if (val !== undefined) {
        cleanObject[key] = sanitizeForFirestore(val);
      }
    }
    return cleanObject as T;
  }
}

/**
 * Clean user-friendly error message translation for Nigerian merchants
 */
export function formatAuthErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';
  const code = error.code || '';
  const msg = error.message || '';
  if (code === 'auth/operation-not-allowed' || msg.includes('auth/operation-not-allowed') || msg.includes('operation-not-allowed')) {
    return 'Email/Password sign-in is not yet enabled in the Firebase Console for this project. Please sign in with Google (recommended) or enable Email/Password under Authentication > Sign-in method in your Firebase Console.';
  }
  if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain') || msg.includes('unauthorized-domain')) {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'your-domain.vercel.app';
    return `Google Sign-in domain unauthorized (${currentHost}). To authorize: Go to Firebase Console > Authentication > Settings > Authorized domains, and add "${currentHost}". Meanwhile, sign in with Email & Password or use the Admin Portal.`;
  }
  switch (code) {
    case 'auth/invalid-email':
      return 'The email address is invalid. Please check and retype.';
    case 'auth/user-disabled':
      return 'This merchant account has been disabled. Contact support.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please check or sign up.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect password or email. Please verify and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing.';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment before trying again.';
    default:
      return error.message || 'Authentication failed. Please try again.';
  }
}

/**
 * Create a new user account with Email & Password
 */
export async function registerWithEmail(
  email: string,
  pass: string,
  displayName: string,
  businessName: string,
  betaInvitationCode?: string
): Promise<{ user: User; profile: UserProfile }> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  const user = credential.user;

  // Set Auth display name
  await updateProfile(user, {
    displayName: displayName.trim() || businessName.trim(),
  });

  const isFounder = (user.email || email).trim().toLowerCase() === 'olamidefelix54@gmail.com';
  const now = new Date().toISOString();
  const profile: UserProfile = {
    id: user.uid,
    email: user.email || email.trim(),
    displayName: displayName.trim() || businessName.trim(),
    businessName: businessName.trim() || 'My Business',
    betaStatus: 'active',
    betaInvitationCode: betaInvitationCode || (isFounder ? 'FOUNDER-ROOT' : undefined),
    betaJoinedAt: now,
    role: isFounder ? 'admin' : 'merchant',
    createdAt: now,
    updatedAt: now,
  };

  // Create profile document in Firestore
  try {
    await setDoc(doc(db, 'users', user.uid), sanitizeForFirestore(profile));
  } catch (err) {
    console.error('Error saving user profile to Firestore:', err);
  }

  return { user, profile };
}

/**
 * Log in with Email & Password
 */
export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return credential.user;
}

/**
 * Sign in using Google Popup
 */
export async function loginWithGoogle(betaInvitationCode?: string): Promise<{ user: User; isNewUser: boolean; profile: UserProfile }> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  const isFounder = (user.email || '').toLowerCase() === 'olamidefelix54@gmail.com';
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  let isNewUser = false;
  let profile: UserProfile;

  const now = new Date().toISOString();
  if (!userSnap.exists()) {
    isNewUser = true;
    profile = {
      id: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Merchant',
      businessName: `${user.displayName || 'Merchant'}'s Store`,
      betaStatus: 'active',
      betaInvitationCode: betaInvitationCode || (isFounder ? 'FOUNDER-ROOT' : undefined),
      betaJoinedAt: now,
      role: isFounder ? 'admin' : 'merchant',
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(userRef, sanitizeForFirestore(profile));
  } else {
    profile = userSnap.data() as UserProfile;
    // Founder override
    if (isFounder && (profile.role !== 'admin' || profile.betaStatus !== 'active')) {
      profile.role = 'admin';
      profile.betaStatus = 'active';
      try {
        await updateDoc(userRef, { role: 'admin', betaStatus: 'active', updatedAt: now });
      } catch {}
    } else if (profile.betaStatus !== 'suspended' && profile.betaStatus !== 'revoked') {
      if (profile.betaStatus !== 'active') {
        profile.betaStatus = 'active';
        try {
          await updateDoc(userRef, { betaStatus: 'active', updatedAt: now });
        } catch {}
      }
    }
  }

  return { user, isNewUser, profile };
}

/**
 * Continue as Guest / Demo user
 */
export async function loginAnonymously(): Promise<User> {
  const credential = await signInAnonymously(auth);
  return credential.user;
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Change authenticated user password
 */
export async function changeUserPassword(newPassword: string, currentPassword?: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('No authenticated user session found.');

  // If current password provided and user has email credential, reauthenticate
  if (currentPassword && currentUser.email) {
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
    } catch (reauthErr) {
      console.warn('Reauthentication attempt failed or skipped:', reauthErr);
      throw reauthErr;
    }
  }

  await updatePassword(currentUser, newPassword);
}

/**
 * Permanently delete user account and cloud store records
 */
export async function deleteUserAccount(currentPassword?: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('No authenticated user session found.');

  // If current password provided and user has email, reauthenticate before deletion
  if (currentPassword && currentUser.email) {
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
    } catch (reauthErr) {
      console.warn('Reauthentication attempt failed:', reauthErr);
      throw reauthErr;
    }
  }

  const uid = currentUser.uid;

  // Clean up user document in Firestore
  try {
    const userDocRef = doc(db, 'users', uid);
    await deleteDoc(userDocRef);
  } catch (err) {
    console.warn('Failed to delete firestore user document:', err);
  }

  // Delete the Auth user
  await deleteUser(currentUser);
}

/**
 * Log out user
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Fetch user profile from Firestore
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      // If betaStatus was not set or was 'none', update to 'active' as long as not suspended/revoked
      if (data.betaStatus !== 'suspended' && data.betaStatus !== 'revoked' && data.betaStatus !== 'active') {
        data.betaStatus = 'active';
        try {
          await updateDoc(userRef, { betaStatus: 'active', updatedAt: new Date().toISOString() });
        } catch {}
      }
      return data;
    } else {
      // Auto-create user profile if authenticated user document doesn't exist
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === userId) {
        const isFounder = (currentUser.email || '').toLowerCase() === 'olamidefelix54@gmail.com';
        const now = new Date().toISOString();
        const newProfile: UserProfile = {
          id: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || 'Merchant',
          businessName: currentUser.displayName ? `${currentUser.displayName}'s Store` : 'My Business',
          betaStatus: 'active',
          role: isFounder ? 'admin' : 'merchant',
          createdAt: now,
          updatedAt: now,
        };
        try {
          await setDoc(userRef, sanitizeForFirestore(newProfile));
        } catch (e) {
          console.warn('Could not auto-create profile doc:', e);
        }
        return newProfile;
      }
    }
  } catch (err) {
    console.error('Error fetching user profile:', err);
  }
  return null;
}

/**
 * Update user profile in Firestore
 */
export async function updateUserProfileDoc(
  userId: string,
  data: Partial<UserProfile>
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const cleanData = sanitizeForFirestore({
    ...data,
    updatedAt: new Date().toISOString(),
  });
  await updateDoc(userRef, cleanData);
}

/**
 * Save business ledger state to Firestore under /users/{userId}/data/ledger
 */
export async function saveBusinessLedger(
  userId: string,
  state: BusinessState
): Promise<void> {
  if (!userId) throw new Error('Cannot save ledger: Missing userId');
  if (!auth.currentUser) {
    throw new Error('Cannot save ledger: No active Firebase Auth session');
  }
  const path = `users/${userId}/data/ledger`;
  try {
    const ledgerRef = doc(db, 'users', userId, 'data', 'ledger');
    const rawPayload = {
      id: 'ledger',
      ownerId: userId,
      businessName: state.businessName || 'My Business',
      ownerName: state.ownerName || '',
      currency: state.currency || 'NGN',
      profile: state.profile || null,
      products: state.products || [],
      events: state.events || [],
      customers: state.customers || [],
      suppliers: state.suppliers || [],
      unitRelationships: state.unitRelationships || [],
      rules: state.rules || state.businessRules || [],
      businessRules: state.businessRules || state.rules || [],
      chatHistory: state.chatHistory || [],
      pendingFollowUp: state.pendingFollowUp || null,
      pulseInsights: state.pulseInsights || [],
      updatedAt: new Date().toISOString(),
    };
    const sanitizedPayload = sanitizeForFirestore(rawPayload);
    await setDoc(ledgerRef, sanitizedPayload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
  return errInfo;
}

export type CloudLedgerResult = 
  | { status: 'found'; data: Partial<BusinessState> }
  | { status: 'not_found' }
  | { status: 'error'; error: any };

/**
 * Load business ledger state from Firestore
 */
export async function loadBusinessLedger(
  userId: string
): Promise<CloudLedgerResult> {
  if (!userId) return { status: 'error', error: new Error('Missing userId') };
  
  // If no authenticated Firebase session exists, return not_found to allow local storage fallback
  if (!auth.currentUser) {
    return { status: 'not_found' };
  }

  const path = `users/${userId}/data/ledger`;
  try {
    const ledgerRef = doc(db, 'users', userId, 'data', 'ledger');
    const snap = await getDoc(ledgerRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        status: 'found',
        data: {
          businessName: data.businessName,
          ownerName: data.ownerName,
          currency: data.currency,
          profile: data.profile,
          products: data.products || [],
          events: data.events || [],
          customers: data.customers || [],
          suppliers: data.suppliers || [],
          unitRelationships: data.unitRelationships || [],
          rules: data.rules || data.businessRules || [],
          businessRules: data.businessRules || data.rules || [],
          chatHistory: data.chatHistory || [],
          pendingFollowUp: data.pendingFollowUp || null,
          pulseInsights: data.pulseInsights || [],
        },
      };
    }
    return { status: 'not_found' };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.GET, path);
    return { status: 'error', error: err };
  }
}

