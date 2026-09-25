import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  BetaInvitation,
  BetaFeedbackItem,
  BetaAccessRequest,
  BetaEventRecord,
  BetaFeedbackType,
} from '../src/types';

export const FOUNDER_EMAIL = 'olamidefelix54@gmail.com';

interface BetaStoreData {
  invitations: Record<string, BetaInvitation>;
  users: Record<string, {
    userId: string;
    email: string;
    businessName: string;
    betaStatus: 'active' | 'suspended' | 'revoked';
    betaJoinedAt: string;
    betaInvitationCode: string;
    role: 'admin' | 'merchant';
    lastActiveAt: string;
  }>;
  requests: BetaAccessRequest[];
  feedback: BetaFeedbackItem[];
  events: BetaEventRecord[];
}

const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'beta_data.json');

// In-memory cache
let cachedData: BetaStoreData | null = null;

// Rate limiting in-memory storage: key -> timestamps[]
const rateLimitBuckets: Map<string, number[]> = new Map();

/**
 * Generate a cryptographically secure, human-friendly invitation code.
 * Format: KARRA-XXXX-XXXX
 * Uses unambiguous characters (excluding 0, O, 1, I)
 */
export function generateSecureInvitationCode(): string {
  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const getChunk = (len: number) => {
    const bytes = crypto.randomBytes(len * 2);
    let str = '';
    for (let i = 0; i < bytes.length && str.length < len; i++) {
      const idx = bytes[i] % charset.length;
      str += charset[idx];
    }
    return str;
  };

  return `KARRA-${getChunk(4)}-${getChunk(4)}`;
}

/**
 * Ensure storage directory and file exist
 */
function ensureDataStore(): BetaStoreData {
  if (cachedData) return cachedData;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(STORE_FILE)) {
    try {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      cachedData = JSON.parse(raw);
      return cachedData!;
    } catch (e) {
      console.error('Error reading beta_data.json, initializing fresh store:', e);
    }
  }

  // Initial seed with 5 unique invitation codes for the initial testers
  const initialInvitations: Record<string, BetaInvitation> = {};
  const seedLabels = [
    'Private Beta Tester 1 (Alaba Merchant)',
    'Private Beta Tester 2 (Lekki Boutique)',
    'Private Beta Tester 3 (Yaba Wholesale Provision)',
    'Private Beta Tester 4 (Ikeja Electronics)',
    'Private Beta Tester 5 (Surulere Supermarket)',
  ];

  const now = new Date().toISOString();
  for (const label of seedLabels) {
    const code = generateSecureInvitationCode();
    initialInvitations[code] = {
      id: crypto.randomUUID(),
      code,
      status: 'active',
      maxUses: 1,
      currentUses: 0,
      createdAt: now,
      expiresAt: null,
      createdBy: FOUNDER_EMAIL,
      notes: label,
      usedBy: [],
      redeemedAt: null,
    };
  }

  cachedData = {
    invitations: initialInvitations,
    users: {},
    requests: [],
    feedback: [],
    events: [],
  };

  saveDataStore(cachedData);
  return cachedData;
}

/**
 * Atomically write store to disk
 */
function saveDataStore(data: BetaStoreData) {
  cachedData = data;
  try {
    const tempFile = `${STORE_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, STORE_FILE);
  } catch (err) {
    console.error('Failed to persist beta data store to disk:', err);
  }
}

/**
 * Normalize an invitation code: trim whitespace, uppercase, strip extraneous dashes or spaces
 */
export function normalizeCode(input: string): string {
  if (!input) return '';
  return input.trim().toUpperCase().replace(/[\s_]+/g, '-');
}

/**
 * Server-side code validation
 */
export function validateInvitationCode(rawCode: string): {
  valid: boolean;
  reason?: 'INVALID' | 'EXPIRED' | 'ALREADY_USED' | 'REVOKED';
  message: string;
  invitation?: BetaInvitation;
} {
  const store = ensureDataStore();
  const code = normalizeCode(rawCode);

  if (!code) {
    return {
      valid: false,
      reason: 'INVALID',
      message: "Please enter your invitation code.",
    };
  }

  const invitation = store.invitations[code];

  // 1. Code does not exist
  if (!invitation) {
    return {
      valid: false,
      reason: 'INVALID',
      message: "That invitation code isn't valid.",
    };
  }

  // 2. Code is revoked / inactive
  if (invitation.status === 'revoked') {
    return {
      valid: false,
      reason: 'REVOKED',
      message: "This invitation is no longer active.",
    };
  }

  // 3. Code has expired
  if (invitation.expiresAt) {
    const expiry = new Date(invitation.expiresAt).getTime();
    if (Date.now() > expiry) {
      if (invitation.status !== 'expired') {
        invitation.status = 'expired';
        saveDataStore(store);
      }
      return {
        valid: false,
        reason: 'EXPIRED',
        message: "This invitation has expired.",
      };
    }
  }

  // 4. Code has exceeded max uses
  if (invitation.currentUses >= invitation.maxUses || invitation.status === 'redeemed') {
    return {
      valid: false,
      reason: 'ALREADY_USED',
      message: "This invitation has already been used.",
    };
  }

  return {
    valid: true,
    message: "Valid invitation code. Welcome to the Karra private beta!",
    invitation,
  };
}

/**
 * Server-side code redemption
 */
export function redeemInvitationCode(
  rawCode: string,
  user: { userId: string; userEmail: string; businessName: string }
): {
  success: boolean;
  message: string;
  status: string;
} {
  const store = ensureDataStore();
  const validation = validateInvitationCode(rawCode);

  if (!validation.valid || !validation.invitation) {
    return {
      success: false,
      message: validation.message,
      status: validation.reason || 'INVALID',
    };
  }

  const code = normalizeCode(rawCode);
  const inv = store.invitations[code];
  const now = new Date().toISOString();

  // Atomically record redemption
  inv.currentUses += 1;
  inv.redeemedAt = now;
  if (!inv.usedBy) inv.usedBy = [];
  inv.usedBy.push({
    userId: user.userId,
    userEmail: user.userEmail,
    businessName: user.businessName,
    redeemedAt: now,
  });

  if (inv.currentUses >= inv.maxUses) {
    inv.status = 'redeemed';
  }

  // Associate user with active beta access
  store.users[user.userId] = {
    userId: user.userId,
    email: user.userEmail,
    businessName: user.businessName,
    betaStatus: 'active',
    betaJoinedAt: now,
    betaInvitationCode: code,
    role: user.userEmail.toLowerCase() === FOUNDER_EMAIL.toLowerCase() ? 'admin' : 'merchant',
    lastActiveAt: now,
  };

  // Track event
  store.events.push({
    id: crypto.randomUUID(),
    userId: user.userId,
    userEmail: user.userEmail,
    businessName: user.businessName,
    eventName: 'beta_invite_redeemed',
    timestamp: now,
    metadata: { code, currentUses: inv.currentUses },
  });

  saveDataStore(store);

  return {
    success: true,
    message: "Invitation redeemed successfully. Beta access granted.",
    status: 'active',
  };
}

/**
 * Retrieve user's beta authorization status
 */
export function getUserBetaStatus(userId: string, email?: string): {
  betaStatus: 'active' | 'suspended' | 'revoked' | 'none';
  isBetaAuthorized: boolean;
  role: 'admin' | 'merchant';
} {
  const store = ensureDataStore();

  // Founder is always admin and beta authorized
  if (email && email.toLowerCase() === FOUNDER_EMAIL.toLowerCase()) {
    return {
      betaStatus: 'active',
      isBetaAuthorized: true,
      role: 'admin',
    };
  }

  let user = store.users[userId];
  if (!user) {
    if (userId) {
      const now = new Date().toISOString();
      user = {
        userId,
        email: email || '',
        businessName: 'My Store',
        betaStatus: 'active',
        betaJoinedAt: now,
        betaInvitationCode: 'ACTIVE-AUTH',
        role: 'merchant',
        lastActiveAt: now,
      };
      store.users[userId] = user;
      saveDataStore(store);
      return {
        betaStatus: 'active',
        isBetaAuthorized: true,
        role: 'merchant',
      };
    }
    return {
      betaStatus: 'none',
      isBetaAuthorized: false,
      role: 'merchant',
    };
  }

  // Update last active
  user.lastActiveAt = new Date().toISOString();
  saveDataStore(store);

  return {
    betaStatus: user.betaStatus,
    isBetaAuthorized: user.betaStatus !== 'suspended' && user.betaStatus !== 'revoked',
    role: user.role,
  };
}

/**
 * Admin: Create a new invitation code
 */
export function createInvitation(params: {
  maxUses?: number;
  notes?: string;
  expiresAt?: string | null;
  createdBy?: string;
  customCode?: string;
}): BetaInvitation {
  const store = ensureDataStore();
  let code = params.customCode ? normalizeCode(params.customCode) : generateSecureInvitationCode();

  // Ensure code uniqueness
  while (store.invitations[code]) {
    code = generateSecureInvitationCode();
  }

  const now = new Date().toISOString();
  const invitation: BetaInvitation = {
    id: crypto.randomUUID(),
    code,
    status: 'active',
    maxUses: params.maxUses && params.maxUses > 0 ? params.maxUses : 1,
    currentUses: 0,
    createdAt: now,
    expiresAt: params.expiresAt || null,
    createdBy: params.createdBy || FOUNDER_EMAIL,
    notes: params.notes || 'Created via Admin Console',
    usedBy: [],
    redeemedAt: null,
  };

  store.invitations[code] = invitation;
  saveDataStore(store);
  return invitation;
}

/**
 * Admin: Revoke / deactivate an invitation code
 */
export function revokeInvitation(rawCode: string): boolean {
  const store = ensureDataStore();
  const code = normalizeCode(rawCode);
  if (!store.invitations[code]) return false;

  store.invitations[code].status = 'revoked';
  saveDataStore(store);
  return true;
}

/**
 * Admin: Update user beta access state (active, suspended, revoked)
 */
export function updateUserBetaStatus(
  userId: string,
  newStatus: 'active' | 'suspended' | 'revoked'
): boolean {
  const store = ensureDataStore();
  if (!store.users[userId]) return false;

  store.users[userId].betaStatus = newStatus;
  saveDataStore(store);
  return true;
}

/**
 * Public: Submit access request from landing page
 */
export function submitAccessRequest(data: {
  fullName: string;
  businessName: string;
  phone: string;
  email: string;
  notes?: string;
}): BetaAccessRequest {
  const store = ensureDataStore();
  const req: BetaAccessRequest = {
    id: crypto.randomUUID(),
    fullName: data.fullName.trim(),
    businessName: data.businessName.trim(),
    phone: data.phone.trim(),
    email: data.email.trim(),
    notes: data.notes?.trim() || '',
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  store.requests.unshift(req);
  saveDataStore(store);
  return req;
}

/**
 * Beta Tester: Submit problem report or feedback
 */
export function submitFeedback(data: {
  userId: string;
  userEmail: string;
  businessName: string;
  type: BetaFeedbackType;
  message: string;
  context?: any;
}): BetaFeedbackItem {
  const store = ensureDataStore();
  const item: BetaFeedbackItem = {
    id: crypto.randomUUID(),
    userId: data.userId,
    userEmail: data.userEmail,
    businessName: data.businessName,
    type: data.type,
    message: data.message.trim(),
    context: data.context || {},
    createdAt: new Date().toISOString(),
    status: 'open',
  };

  store.feedback.unshift(item);
  store.events.push({
    id: crypto.randomUUID(),
    userId: data.userId,
    userEmail: data.userEmail,
    businessName: data.businessName,
    eventName: 'feedback_submitted',
    timestamp: new Date().toISOString(),
    metadata: { type: data.type },
  });

  saveDataStore(store);
  return item;
}

/**
 * Lightweight product analytics tracker
 */
export function trackBetaEvent(data: {
  userId: string;
  userEmail?: string;
  businessName?: string;
  eventName: string;
  metadata?: Record<string, any>;
}): void {
  const store = ensureDataStore();
  store.events.push({
    id: crypto.randomUUID(),
    userId: data.userId,
    userEmail: data.userEmail,
    businessName: data.businessName,
    eventName: data.eventName,
    timestamp: new Date().toISOString(),
    metadata: data.metadata || {},
  });

  // Limit event log size in memory/file
  if (store.events.length > 2000) {
    store.events = store.events.slice(-1000);
  }
  saveDataStore(store);
}

/**
 * Admin view helpers
 */
export function listInvitations(): BetaInvitation[] {
  const store = ensureDataStore();
  return Object.values(store.invitations).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listUsers(): any[] {
  const store = ensureDataStore();
  return Object.values(store.users)
    .map((u) => ({
      ...u,
      id: u.userId,
      joinedAt: u.betaJoinedAt,
    }))
    .sort((a, b) =>
      new Date(b.lastActiveAt || b.betaJoinedAt).getTime() - new Date(a.lastActiveAt || a.betaJoinedAt).getTime()
    );
}

export function listFeedback(): BetaFeedbackItem[] {
  const store = ensureDataStore();
  return store.feedback;
}

export function listRequests(): BetaAccessRequest[] {
  const store = ensureDataStore();
  return store.requests;
}

export function getBetaAnalytics() {
  const store = ensureDataStore();
  const invitations = Object.values(store.invitations);
  const users = Object.values(store.users);

  return {
    totalInvitations: invitations.length,
    activeInvitations: invitations.filter((i) => i.status === 'active').length,
    redeemedInvitations: invitations.filter((i) => i.status === 'redeemed' || i.currentUses > 0).length,
    revokedInvitations: invitations.filter((i) => i.status === 'revoked').length,
    totalBetaUsers: users.length,
    activeBetaUsers: users.filter((u) => u.betaStatus === 'active').length,
    suspendedBetaUsers: users.filter((u) => u.betaStatus === 'suspended').length,
    totalFeedbackSubmissions: store.feedback.length,
    totalAccessRequests: store.requests.length,
    totalEvents: store.events.length,
  };
}

/**
 * Sliding window rate limiter
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let timestamps = rateLimitBuckets.get(key) || [];

  // Evict expired timestamps
  timestamps = timestamps.filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const resetMs = windowMs - (now - oldest);
    return { allowed: false, remaining: 0, resetMs };
  }

  timestamps.push(now);
  rateLimitBuckets.set(key, timestamps);

  return {
    allowed: true,
    remaining: limit - timestamps.length,
    resetMs: windowMs,
  };
}
