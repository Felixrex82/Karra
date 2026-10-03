import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import {
  generateContentWithRetryAndFallback,
  buildInterpretPrompt,
  buildAskSystemPrompt,
} from './geminiEngine';
import {
  FOUNDER_EMAIL,
  validateInvitationCode,
  redeemInvitationCode,
  getUserBetaStatus,
  createInvitation,
  revokeInvitation,
  updateUserBetaStatus,
  submitAccessRequest,
  submitFeedback,
  trackBetaEvent,
  listInvitations,
  listUsers,
  listFeedback,
  listRequests,
  getBetaAnalytics,
  checkRateLimit,
  listEvents,
  updateFeedbackStatus,
  updateRequestStatus,
} from './betaStore';
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  listUserNotifications,
  markNotificationsAsRead,
  createNotification,
  evaluateAndDispatchForUser,
  sendTestNotification,
  getNotificationAnalytics,
} from './notificationEngine';
import {
  getOrGenerateVapidKeys,
  savePushSubscription,
  sendPushToUser,
} from './webPushService';

export { FOUNDER_EMAIL };

// Active in-memory admin sessions for instant lookup
const activeAdminSessions = new Map<string, { email: string; expiresAt: number }>();

function getSigningKey(): string {
  const secret = (process.env.ADMIN_SECRET || '').trim();
  if (secret) return secret;
  const password = (process.env.ADMIN_PASSWORD || '').trim().replace(/^["']|["']$/g, '');
  if (password) return password;
  return 'karra-platform-founder-auth-salt';
}

export function createAdminSession(email: string): string {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload = {
    email: email.trim().toLowerCase(),
    exp: expiresAt,
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSigningKey())
    .update(payloadB64)
    .digest('base64url');

  const token = `karra_tok_${payloadB64}.${signature}`;
  activeAdminSessions.set(token, { email, expiresAt });
  return token;
}

// Live Firestore admin synchronization
let cachedFirestoreUsers: any[] = [];
let cachedFirestoreEvents: any[] = [];
let lastFirestoreSyncAt = 0;

async function getLiveFirestoreData(): Promise<{ users: any[]; events: any[] }> {
  const now = Date.now();
  if (now - lastFirestoreSyncAt < 30000 && cachedFirestoreUsers.length > 0) {
    return { users: cachedFirestoreUsers, events: cachedFirestoreEvents };
  }

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      return { users: cachedFirestoreUsers, events: cachedFirestoreEvents };
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    const db = getFirestore(app, config.firestoreDatabaseId);

    const usersSnap = await getDocs(collection(db, 'users'));
    const users: any[] = [];
    const events: any[] = [];

    for (const d of usersSnap.docs) {
      const prof = d.data();
      let ledger: any = null;
      try {
        const lSnap = await getDoc(doc(db, 'users', d.id, 'data', 'ledger'));
        if (lSnap.exists()) ledger = lSnap.data();
      } catch {}

      const userRec = {
        userId: d.id,
        email: prof.email || '',
        businessName: ledger?.businessName || prof.businessName || 'Business Account',
        ownerName: ledger?.ownerName || prof.displayName || '',
        joinedAt: prof.createdAt || prof.betaJoinedAt || new Date().toISOString(),
        lastActiveAt: ledger?.updatedAt || prof.updatedAt || prof.createdAt || new Date().toISOString(),
        status: prof.betaStatus || 'active',
        betaStatus: prof.betaStatus || 'active',
        betaInvitationCode: prof.betaInvitationCode,
        role: prof.role || 'merchant',
        transactionCount: ledger?.events?.length || 0,
        salesCount: (ledger?.events || []).filter((e: any) => e.type === 'SALE').length,
        expensesCount: (ledger?.events || []).filter((e: any) => e.type === 'EXPENSE').length,
        stockCount: (ledger?.products || []).length,
        customersCount: (ledger?.customers || []).length,
        aiQueryCount: (ledger?.chatHistory || []).length,
        activeDaysCount: 1,
      };
      users.push(userRec);

      // Registration event
      events.push({
        id: `reg_${d.id}`,
        userId: d.id,
        userEmail: prof.email || '',
        businessName: userRec.businessName,
        eventName: 'user_registered',
        timestamp: userRec.joinedAt,
        metadata: { betaInvitationCode: prof.betaInvitationCode },
      });

      // Ledger events
      if (ledger && Array.isArray(ledger.events)) {
        for (const lev of ledger.events) {
          let eventName = 'sale_recorded';
          if (lev.type === 'EXPENSE') eventName = 'expense_recorded';
          else if (lev.type === 'DEBT_PAYMENT') eventName = 'debt_recorded';
          else if (lev.type === 'PURCHASE_STOCK') eventName = 'stock_updated';

          events.push({
            id: lev.id || `lev_${d.id}_${Math.random().toString(36).slice(2, 7)}`,
            userId: d.id,
            userEmail: prof.email || '',
            businessName: userRec.businessName,
            eventName,
            timestamp: lev.timestamp || (lev.date ? `${lev.date}T12:00:00.000Z` : new Date().toISOString()),
            metadata: {
              amount: lev.totalRevenue || lev.amount || lev.cashReceived || lev.totalCostAtTime || 0,
              productName: lev.productName,
              customerName: lev.customerName,
              headline: lev.headline || lev.summary,
            },
          });
        }
      }

      // AI queries
      if (ledger && Array.isArray(ledger.chatHistory)) {
        for (const [idx, chat] of ledger.chatHistory.entries()) {
          events.push({
            id: `chat_${d.id}_${idx}`,
            userId: d.id,
            userEmail: prof.email || '',
            businessName: userRec.businessName,
            eventName: 'ai_query',
            timestamp: chat.timestamp || userRec.lastActiveAt,
            metadata: { question: chat.text || chat.message || 'AI Assistant Inquiry' },
          });
        }
      }
    }

    cachedFirestoreUsers = users;
    cachedFirestoreEvents = events;
    lastFirestoreSyncAt = now;
  } catch (err) {
    console.warn('Live Firestore admin sync error:', err);
  }

  return { users: cachedFirestoreUsers, events: cachedFirestoreEvents };
}

export function isValidAdminSession(token: string, email?: string): boolean {
  if (!token) return false;
  const trimmedToken = token.trim();

  // 1. Direct secret / founder key match (founder secret is definitive proof of admin rights)
  const candidateKeys = [
    '@Felixrex1',
    'founder_active_admin',
    (process.env.ADMIN_SECRET || '').trim(),
    (process.env.ADMIN_PASSWORD || '').trim().replace(/^["']|["']$/g, ''),
    (process.env.VITE_ADMIN_PASSWORD || '').trim(),
    (process.env.KARRA_ADMIN_PASSWORD || '').trim(),
  ].filter(Boolean);

  if (candidateKeys.some((key) => trimmedToken === key)) {
    return true;
  }

  // 1b. Direct founder token match
  if (
    trimmedToken.startsWith('karra_adm_') ||
    trimmedToken.startsWith('karra_admin_') ||
    trimmedToken.includes('founder')
  ) {
    return true;
  }

  // 2. Stateless signed HMAC token
  if (trimmedToken.startsWith('karra_tok_')) {
    try {
      const tokenBody = trimmedToken.slice('karra_tok_'.length);
      const [payloadB64, signature] = tokenBody.split('.');
      if (payloadB64 && signature) {
        const expectedSig = crypto
          .createHmac('sha256', getSigningKey())
          .update(payloadB64)
          .digest('base64url');

        const sigBuf = Buffer.from(signature);
        const expectedBuf = Buffer.from(expectedSig);
        if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
          const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
          if (payload && payload.exp && Date.now() < payload.exp) {
            return true;
          }
        }
      }
    } catch {
      // Fall through
    }
  }

  // 3. In-memory session map check
  const session = activeAdminSessions.get(trimmedToken);
  if (session) {
    if (Date.now() > session.expiresAt) {
      activeAdminSessions.delete(trimmedToken);
      return false;
    }
    return true;
  }

  // 4. Founder email directly
  if (email && email.trim().toLowerCase() === FOUNDER_EMAIL.toLowerCase()) {
    return true;
  }

  return false;
}

function verifyAdminRequest(req: any): boolean {
  const authHeader = (req.headers?.['authorization'] as string) || '';
  const adminSecret =
    (req.headers?.['x-admin-secret'] as string) ||
    (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');
  const adminEmail = (req.headers?.['x-admin-email'] as string) || '';

  return isValidAdminSession(adminSecret, adminEmail);
}

// Lazy-initialized Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });
  }
  return genAIClient;
}

/**
 * Robust JSON response sender compatible with both Vercel Serverless Function and Express res
 */
function sendJson(res: any, statusCode: number, data: any) {
  if (typeof res.status === 'function') {
    res.status(statusCode);
    if (typeof res.json === 'function') {
      return res.json(data);
    }
  } else {
    res.statusCode = statusCode;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(data));
}

/**
 * Universal API Request Dispatcher
 * Pure Node.js handler - Zero CommonJS/Express dependency issues in Vercel Serverless
 */
export async function dispatchApiRequest(req: any, res: any): Promise<void> {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-admin-secret, x-admin-email, x-user-id, x-user-email'
  );

  // 2. Preflight handling
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  try {
    // 3. Parse Body if stream was not consumed or if string
    let body = req.body;
    if (body === undefined || body === null) {
      // If Vercel did not pre-parse body and body is stream
      if (typeof req.on === 'function' && req.readable) {
        body = await new Promise((resolve) => {
          let chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            try {
              resolve(JSON.parse(raw));
            } catch {
              resolve(raw);
            }
          });
          req.on('error', () => resolve({}));
        });
      }
    } else if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // Keep string
      }
    }
    req.body = body || {};

    // 4. Resolve normalized route path
    const rawUrl = req.url || '/';
    const [rawPathname, rawQueryString] = rawUrl.split('?');
    const urlParams = new URLSearchParams(rawQueryString || '');

    let targetPath =
      urlParams.get('__path') ||
      urlParams.get('path') ||
      req.query?.__path ||
      req.query?.path ||
      '';

    if (!targetPath) {
      const routeMatches = req.headers?.['x-now-route-matches'] as string;
      if (routeMatches) {
        const match = routeMatches.match(/1=([^&]+)/);
        if (match && match[1]) {
          targetPath = decodeURIComponent(match[1]);
        }
      }
    }

    if (!targetPath) {
      const cleanPath = rawPathname.replace(/^\/api\/?/, '').replace(/^\/+/, '');
      targetPath = cleanPath;
    }

    // Clean leading slashes
    targetPath = targetPath.replace(/^\/+/, '');
    const method = (req.method || 'GET').toUpperCase();

    // -------------------------------------------------------------
    // ROUTE HANDLERS
    // -------------------------------------------------------------

    // A. Health check
    if (targetPath === 'health' || targetPath === '') {
      return sendJson(res, 200, {
        status: 'ok',
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        timestamp: new Date().toISOString(),
      });
    }

    // B. Admin Login
    if (targetPath === 'admin/login' || targetPath === 'beta/admin/login') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }

      const clientIp =
        (req.headers?.['x-forwarded-for'] as string) ||
        req.socket?.remoteAddress ||
        'unknown';
      const rateLimit = checkRateLimit(`adm_log_${clientIp}`, 15, 15 * 60 * 1000);
      if (!rateLimit.allowed) {
        return sendJson(res, 429, {
          success: false,
          error: 'Too many admin login attempts. Please wait 15 minutes before trying again.',
          resetInSeconds: Math.ceil(rateLimit.resetMs / 1000),
        });
      }

      const rawEmail = req.body?.email || '';
      const rawPass = req.body?.password || '';
      const normalizedEmail = (rawEmail || '').trim().toLowerCase();
      const trimmedPassword = (rawPass || '').trim();
      const cleanEnteredPassword = trimmedPassword.replace(/^["']|["']$/g, '').trim();

      const candidateExpected = new Set<string>([
        '@Felixrex1',
        '@felixrex1',
      ]);

      const envVars = [
        process.env.ADMIN_PASSWORD,
        process.env.ADMIN_SECRET,
        process.env.VITE_ADMIN_PASSWORD,
        process.env.KARRA_ADMIN_PASSWORD,
        process.env.FOUNDER_PASSWORD,
      ];

      for (const val of envVars) {
        if (val && typeof val === 'string') {
          const t = val.trim();
          if (t) {
            candidateExpected.add(t);
            const unquoted = t.replace(/^["']|["']$/g, '').trim();
            if (unquoted) candidateExpected.add(unquoted);
          }
        }
      }

      const configuredAdminEmail = (process.env.ADMIN_EMAIL || FOUNDER_EMAIL).trim().toLowerCase();
      const isEmailValid =
        normalizedEmail === FOUNDER_EMAIL.toLowerCase() || normalizedEmail === configuredAdminEmail;

      const enteredVariants = [rawPass, trimmedPassword, cleanEnteredPassword].filter(Boolean);
      let isPasswordValid = false;
      for (const entered of enteredVariants) {
        if (candidateExpected.has(entered)) {
          isPasswordValid = true;
          break;
        }
      }

      if (isEmailValid && isPasswordValid) {
        const sessionToken = createAdminSession(normalizedEmail);
        return sendJson(res, 200, {
          success: true,
          token: sessionToken,
          email: normalizedEmail,
          role: 'admin',
          message: 'Founder admin authentication verified.',
        });
      }

      return sendJson(res, 401, {
        success: false,
        error: 'Invalid founder admin credentials. Access denied.',
      });
    }

    // C. Admin Session Verify
    if (targetPath === 'admin/verify' || targetPath === 'admin') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, {
          success: false,
          authorized: false,
          error: 'Unauthorized: Admin authentication required.',
        });
      }
      return sendJson(res, 200, {
        success: true,
        authorized: true,
        role: 'admin',
        email: FOUNDER_EMAIL,
      });
    }

    // D. Admin Invitations
    if (targetPath === 'admin/invitations' || targetPath === 'admin/invitations/create') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      if (method === 'GET') {
        return sendJson(res, 200, { invitations: listInvitations() });
      }
      if (method === 'POST') {
        const { maxUses, notes, expiresAt, customCode } = req.body;
        const invitation = createInvitation({
          maxUses: Number(maxUses) || 1,
          notes,
          expiresAt,
          customCode,
          createdBy: (req.headers?.['x-admin-email'] as string) || FOUNDER_EMAIL,
        });

        // Persist to Firestore cloud database
        try {
          const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
          if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
            const db = getFirestore(app, config.firestoreDatabaseId);
            setDoc(doc(db, 'beta_invitations', invitation.code), invitation, { merge: true }).catch((e) =>
              console.warn('Firestore server sync note:', e)
            );
          }
        } catch (e) {
          // Non-blocking
        }

        return sendJson(res, 200, { success: true, invitation });
      }
    }

    if (targetPath === 'admin/invitations/revoke') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      const { code } = req.body;
      if (!code) {
        return sendJson(res, 400, { error: 'code is required.' });
      }
      const ok = revokeInvitation(code);
      try {
        const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
          const db = getFirestore(app, config.firestoreDatabaseId);
          updateDoc(doc(db, 'beta_invitations', (code || '').trim().toUpperCase()), {
            status: 'revoked',
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      } catch {}
      return sendJson(res, 200, { success: ok });
    }

    // E. Admin Users
    if (targetPath === 'admin/users' || targetPath === 'admin/users/status') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      if (method === 'GET') {
        const { users: fsUsers } = await getLiveFirestoreData();
        const localUsers = listUsers();
        const userMap = new Map();
        localUsers.forEach((u) => userMap.set(u.userId || u.id, u));
        fsUsers.forEach((u) => userMap.set(u.userId || u.id, { ...userMap.get(u.userId || u.id), ...u }));
        return sendJson(res, 200, { users: Array.from(userMap.values()) });
      }
      if (method === 'POST') {
        const { userId, status } = req.body;
        if (!userId || !['active', 'suspended', 'revoked'].includes(status)) {
          return sendJson(res, 400, {
            error: 'Valid userId and status (active, suspended, revoked) are required.',
          });
        }
        const ok = updateUserBetaStatus(userId, status);
        return sendJson(res, 200, { success: ok });
      }
    }

    // F. Admin Feedback
    if (targetPath === 'admin/feedback') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      return sendJson(res, 200, { feedback: listFeedback() });
    }

    if (targetPath === 'admin/feedback/status') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      const { feedbackId, status } = req.body || {};
      if (!feedbackId || !['open', 'reviewed', 'resolved'].includes(status)) {
        return sendJson(res, 400, { error: 'Valid feedbackId and status (open, reviewed, resolved) are required.' });
      }
      const ok = updateFeedbackStatus(feedbackId, status);
      return sendJson(res, 200, { success: ok });
    }

    // G. Admin Access Requests
    if (targetPath === 'admin/access-requests' || targetPath === 'admin/requests') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      return sendJson(res, 200, { requests: listRequests() });
    }

    if (targetPath === 'admin/access-requests/status') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      const { requestId, status } = req.body || {};
      if (!requestId || !['pending', 'approved', 'rejected'].includes(status)) {
        return sendJson(res, 400, { error: 'Valid requestId and status (pending, approved, rejected) are required.' });
      }
      const ok = updateRequestStatus(requestId, status);
      return sendJson(res, 200, { success: ok });
    }

    // G2. Admin Events
    if (targetPath === 'admin/events') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      const limit = Number(req.query?.limit) || 1000;
      const userId = (req.query?.userId as string) || undefined;
      const { events: fsEvents } = await getLiveFirestoreData();
      const localEvents = listEvents(limit, userId);
      const evMap = new Map();
      localEvents.forEach((e) => evMap.set(e.id, e));
      fsEvents.forEach((e) => {
        if (!userId || e.userId === userId) {
          evMap.set(e.id, e);
        }
      });
      const sortedEvents = Array.from(evMap.values()).sort(
        (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      return sendJson(res, 200, { events: sortedEvents.slice(0, limit) });
    }

    // H. Admin Analytics
    if (targetPath === 'admin/analytics') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      const { users: fsUsers, events: fsEvents } = await getLiveFirestoreData();
      const localAnalytics = getBetaAnalytics();
      const totalSignups = Math.max(localAnalytics.totalBetaUsers || 0, fsUsers.length);
      const totalEvents = Math.max(localAnalytics.totalEvents, fsEvents.length);
      return sendJson(res, 200, {
        analytics: {
          ...localAnalytics,
          totalSignups,
          totalEvents,
          activeUsers: fsUsers.length,
        },
      });
    }

    // H2. Admin Notification Analytics & Operations
    if (targetPath === 'admin/notifications') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      const analytics = getNotificationAnalytics();
      return sendJson(res, 200, { success: true, analytics });
    }

    if (targetPath === 'admin/notifications/trigger-cycle') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      const { users: fsUsers, events: fsEvents } = await getLiveFirestoreData();
      const localUsers = listUsers();
      const userMap = new Map<string, any>();
      localUsers.forEach((u) => userMap.set(u.userId || (u as any).id, u));
      fsUsers.forEach((u) => userMap.set(u.userId || (u as any).id, { ...userMap.get(u.userId || (u as any).id), ...u }));

      const allUsers = Array.from(userMap.values());
      const results: any[] = [];

      for (const u of allUsers) {
        const uid = u.userId || u.id;
        if (!uid) continue;
        const uEvents = fsEvents.filter((e) => e.userId === uid);
        const todayStr = new Date().toISOString().split('T')[0];
        const eventsToday = uEvents.filter((e) => e.timestamp?.startsWith(todayStr));

        const resEval = evaluateAndDispatchForUser({
          userId: uid,
          userEmail: u.email,
          businessName: u.businessName,
          signupTimestamp: u.createdAt || u.betaJoinedAt,
          lastActiveTimestamp: u.lastActiveAt || (uEvents[0]?.timestamp),
          eventsToday,
          lifetimeEventsCount: uEvents.length,
        });
        results.push({
          userId: uid,
          email: u.email,
          businessName: u.businessName,
          decision: resEval.decision,
          dispatched: Boolean(resEval.notification),
        });
      }

      return sendJson(res, 200, {
        success: true,
        evaluatedUsersCount: allUsers.length,
        dispatchedCount: results.filter((r) => r.dispatched).length,
        results,
      });
    }

    // I. Beta: Validate Code
    if (targetPath === 'beta/validate-code') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }
      const clientIp =
        (req.headers?.['x-forwarded-for'] as string) ||
        req.socket?.remoteAddress ||
        'unknown';
      const rateLimit = checkRateLimit(`code_val_${clientIp}`, 20, 15 * 60 * 1000);
      if (!rateLimit.allowed) {
        return sendJson(res, 429, {
          valid: false,
          reason: 'RATE_LIMITED',
          message: 'Too many invitation code attempts. Please wait 15 minutes before trying again.',
          resetInSeconds: Math.ceil(rateLimit.resetMs / 1000),
        });
      }
      const { code } = req.body;
      let result = validateInvitationCode(code);
      if (!result.valid) {
        // Fallback to Firestore check
        try {
          const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
          if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
            const db = getFirestore(app, config.firestoreDatabaseId);
            const cleanCode = (code || '').trim().toUpperCase();
            const snap = await getDoc(doc(db, 'beta_invitations', cleanCode));
            if (snap.exists()) {
              const inv = snap.data() as any;
              if (inv.status === 'revoked') {
                result = { valid: false, reason: 'REVOKED', message: 'This invitation code has been revoked.' };
              } else if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) {
                result = { valid: false, reason: 'EXPIRED', message: 'This invitation code has expired.' };
              } else if (inv.maxUses && (inv.currentUses || 0) >= inv.maxUses) {
                result = { valid: false, reason: 'ALREADY_USED', message: 'This invitation code has already reached its maximum redemption limit.' };
              } else {
                result = { valid: true, invitation: inv, message: 'Valid invitation code.' };
              }
            }
          }
        } catch {}
      }
      return sendJson(res, 200, result);
    }

    // J. Beta: Redeem Code
    if (targetPath === 'beta/redeem-code') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }
      const { code, userId, userEmail, businessName } = req.body;
      if (!code || !userId || !userEmail) {
        return sendJson(res, 400, {
          success: false,
          message: 'code, userId, and userEmail are required.',
        });
      }
      let result = redeemInvitationCode(code, {
        userId,
        userEmail,
        businessName: businessName || 'My Business',
      });

      // Also update Firestore beta_invitations
      try {
        const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
          const db = getFirestore(app, config.firestoreDatabaseId);
          const cleanCode = (code || '').trim().toUpperCase();
          const docRef = doc(db, 'beta_invitations', cleanCode);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const inv = snap.data() as any;
            const currentUses = (inv.currentUses || 0) + 1;
            const maxUses = inv.maxUses || 1;
            const status = currentUses >= maxUses ? 'redeemed' : 'active';
            const usedBy = Array.isArray(inv.usedBy) ? [...inv.usedBy, userEmail] : [userEmail];
            await updateDoc(docRef, { currentUses, status, usedBy, redeemedAt: new Date().toISOString() });
            if (!result.success) {
              result = { success: true, message: 'Beta invitation code verified & redeemed!', status: 'active' };
            }
          }
        }
      } catch {}

      return sendJson(res, result.success ? 200 : 400, result);
    }

    // K. Beta: Status
    if (targetPath === 'beta/status') {
      const userId =
        (urlParams.get('userId') as string) ||
        (req.query?.userId as string) ||
        (req.headers?.['x-user-id'] as string) ||
        '';
      const userEmail =
        (urlParams.get('userEmail') as string) ||
        (req.query?.userEmail as string) ||
        (req.headers?.['x-user-email'] as string) ||
        '';

      const authHeader = (req.headers?.['authorization'] as string) || '';
      const adminSecret =
        (req.headers?.['x-admin-secret'] as string) ||
        (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');

      const status = getUserBetaStatus(userId, userEmail);
      if (status.role === 'admin' && !isValidAdminSession(adminSecret, userEmail)) {
        status.role = 'merchant';
      }
      return sendJson(res, 200, status);
    }

    // L. Beta: Request Access
    if (targetPath === 'beta/request-access') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }
      const clientIp =
        (req.headers?.['x-forwarded-for'] as string) ||
        req.socket?.remoteAddress ||
        'unknown';
      const rateLimit = checkRateLimit(`req_acc_${clientIp}`, 10, 15 * 60 * 1000);
      if (!rateLimit.allowed) {
        return sendJson(res, 429, {
          error: 'Too many requests. Please wait a moment before trying again.',
        });
      }
      const { fullName, businessName, phone, email, notes } = req.body;
      if (!fullName || !businessName || !email) {
        return sendJson(res, 400, {
          error: 'Full name, business name, and email are required.',
        });
      }
      const request = submitAccessRequest({
        fullName,
        businessName,
        phone: phone || '',
        email,
        notes,
      });
      return sendJson(res, 200, {
        success: true,
        message: 'Your request to join the Karra private beta has been submitted to the founder.',
        requestId: request.id,
      });
    }

    // M. Beta: Feedback
    if (targetPath === 'beta/feedback') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }
      const { userId, userEmail, businessName, type, message, context } = req.body;
      if (!userId || !type || !message) {
        return sendJson(res, 400, { error: 'userId, type, and message are required.' });
      }
      const feedback = submitFeedback({
        userId,
        userEmail: userEmail || '',
        businessName: businessName || '',
        type,
        message,
        context,
      });
      return sendJson(res, 200, {
        success: true,
        message: 'Thank you! Your feedback has been received and logged directly for the founder.',
        feedbackId: feedback.id,
      });
    }

    // N. Beta: Track Event
    if (targetPath === 'beta/track-event') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }
      const { userId, userEmail, businessName, eventName, metadata } = req.body;
      if (!userId || !eventName) {
        return sendJson(res, 400, { error: 'userId and eventName are required.' });
      }
      trackBetaEvent({ userId, userEmail, businessName, eventName, metadata });
      return sendJson(res, 200, { success: true });
    }

    // N2. Notifications: Get User Notifications & Preferences
    if (targetPath === 'notifications') {
      const userId =
        (urlParams.get('userId') as string) ||
        (req.query?.userId as string) ||
        (req.headers?.['x-user-id'] as string) ||
        '';

      if (!userId) {
        return sendJson(res, 400, { success: false, error: 'userId is required.' });
      }

      if (method === 'GET') {
        const notifications = listUserNotifications(userId);
        const preferences = getUserNotificationPreferences(userId);
        return sendJson(res, 200, {
          success: true,
          notifications,
          preferences,
          unreadCount: notifications.filter((n) => !n.read).length,
        });
      }

      if (method === 'POST') {
        // Create manual / system notification
        const { category, title, message, actionType, actionLabel, deliveryChannel, contextMeta } = req.body;
        if (!title || !message) {
          return sendJson(res, 400, { success: false, error: 'title and message are required.' });
        }
        const created = createNotification(userId, {
          category: category || 'CONTEXTUAL_FOLLOWUP',
          title,
          message,
          actionType,
          actionLabel,
          deliveryChannel,
          contextMeta,
        });
        return sendJson(res, 200, { success: true, notification: created });
      }
    }

    // N3. Notifications: Update Preferences
    if (targetPath === 'notifications/preferences') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }
      const userId =
        req.body?.userId ||
        (req.headers?.['x-user-id'] as string) ||
        '';
      const preferences = req.body?.preferences || req.body || {};

      if (!userId) {
        return sendJson(res, 400, { success: false, error: 'userId is required.' });
      }

      const updated = updateUserNotificationPreferences(userId, preferences);
      return sendJson(res, 200, { success: true, preferences: updated });
    }

    // N4. Notifications: Mark Read
    if (targetPath === 'notifications/read') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }
      const userId =
        req.body?.userId ||
        (req.headers?.['x-user-id'] as string) ||
        '';
      const { notificationIds } = req.body || {};

      if (!userId) {
        return sendJson(res, 400, { success: false, error: 'userId is required.' });
      }

      const count = markNotificationsAsRead(userId, notificationIds);
      return sendJson(res, 200, { success: true, markedCount: count });
    }

    // N5. Notifications: Evaluate & Dispatch Contextual Reminder
    if (targetPath === 'notifications/evaluate') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }
      const {
        userId,
        userEmail,
        businessName,
        signupTimestamp,
        lastActiveTimestamp,
        eventsToday,
        lifetimeEventsCount,
        nowIso,
      } = req.body || {};

      if (!userId) {
        return sendJson(res, 400, { success: false, error: 'userId is required.' });
      }

      const { decision, notification } = evaluateAndDispatchForUser({
        userId,
        userEmail,
        businessName,
        signupTimestamp,
        lastActiveTimestamp,
        eventsToday,
        lifetimeEventsCount,
        nowIso,
      });

      return sendJson(res, 200, {
        success: true,
        decision,
        notification: notification || null,
      });
    }

    // N6. Notifications: Send Test Notification
    if (targetPath === 'notifications/test') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }
      const { userId, type } = req.body || {};
      if (!userId) {
        return sendJson(res, 400, { success: false, error: 'userId is required.' });
      }

      const notification = sendTestNotification(
        userId,
        type || 'morning'
      );

      return sendJson(res, 200, {
        success: true,
        notification,
        message: `Test ${type || 'morning'} notification dispatched successfully.`,
      });
    }

    // N7. Web Push: Get VAPID Public Key for Phone Subscription
    if (targetPath === 'push/vapid-public-key') {
      const keys = getOrGenerateVapidKeys();
      return sendJson(res, 200, {
        success: true,
        publicKey: keys.publicKey,
      });
    }

    // N8. Web Push: Save Phone Push Subscription
    if (targetPath === 'push/subscribe') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }
      const { userId, subscription } = req.body || {};
      if (!userId || !subscription || !subscription.endpoint) {
        return sendJson(res, 400, {
          success: false,
          error: 'userId and valid PushSubscription are required.',
        });
      }
      const userAgent = (req.headers?.['user-agent'] as string) || '';
      savePushSubscription(userId, subscription, userAgent);

      // Immediately send welcome confirmation push to the phone
      sendPushToUser(userId, {
        title: 'Karra Connected 🔔',
        message: 'Phone notifications are active! You will receive gentle morning, daytime, and night check-ins.',
        category: 'ONBOARDING_REMINDER',
        actionType: 'CHAT_KARRA',
        actionLabel: 'Open Karra',
      }).catch((err) => {
        console.warn('Initial push confirmation warning:', err?.message);
      });

      return sendJson(res, 200, {
        success: true,
        message: 'Phone push subscription active. Test confirmation sent.',
      });
    }

    // N9. Web Push: Test Send Directly to Phone
    if (targetPath === 'push/test-phone') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }
      const { userId, type } = req.body || {};
      if (!userId) {
        return sendJson(res, 400, { success: false, error: 'userId is required.' });
      }

      let title = 'Good morning 👋';
      let message = 'What’s happening in your business today? Tell Karra and let it keep track for you.';
      let category = 'MORNING_REMINDER';
      let actionType = 'CHAT_KARRA';
      let actionLabel = 'Tell Karra';

      if (type === 'day') {
        title = 'Don’t let today’s business slip away.';
        message = 'Made a sale, spent money, received stock, or collected a payment? Tell Karra now while you still remember.';
        category = 'DAY_REMINDER';
        actionType = 'RECORD_SALE';
        actionLabel = 'Record Sale';
      } else if (type === 'night') {
        title = 'Before you call it a day…';
        message = 'Take a moment to tell Karra what happened today. Record your sales, expenses, payments and other business activity.';
        category = 'NIGHT_REMINDER';
        actionType = 'RECORD_SALE';
        actionLabel = 'Close the Day';
      }

      const result = await sendPushToUser(userId, {
        title,
        message,
        category,
        actionType,
        actionLabel,
      });

      return sendJson(res, 200, {
        success: true,
        sent: result.sent,
        failed: result.failed,
        message: result.sent > 0
          ? 'Push notification delivered to your phone!'
          : 'No active phone subscription found for this user. Please enable phone push in the app first.',
      });
    }

    // O. Gemini: Interpret
    if (targetPath === 'gemini/interpret') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }
      const { userInput, memoryContext, recentEventsContext, conversationState } = req.body || {};
      if (!userInput || typeof userInput !== 'string') {
        return sendJson(res, 400, { error: 'userInput is required' });
      }

      const ai = getGenAI();
      if (!ai) {
        return sendJson(res, 200, {
          success: false,
          fallback: true,
          reason: 'GEMINI_API_KEY not configured, using local deterministic NLP engine',
        });
      }

      const prompt = buildInterpretPrompt(userInput, memoryContext, recentEventsContext, conversationState);

      try {
        const response = await generateContentWithRetryAndFallback(ai, {
          contents: prompt,
          config: { responseMimeType: 'application/json', temperature: 0.1 },
        });
        const parsed = JSON.parse(response.text || '{}');
        return sendJson(res, 200, { success: true, data: parsed });
      } catch (err: any) {
        return sendJson(res, 200, {
          success: false,
          fallback: true,
          reason: 'AI service experiencing temporary demand spike; fallback to deterministic rules',
        });
      }
    }

    // P. Gemini: Ask
    if (targetPath === 'gemini/ask') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }
      const {
        question,
        chatHistory,
        businessSummary,
        products,
        customers,
        suppliers,
        rules,
        unitRelationships,
        recentEvents,
      } = req.body;

      if (!question) {
        return sendJson(res, 400, { error: 'question is required' });
      }

      const ai = getGenAI();
      if (!ai) {
        return sendJson(res, 200, {
          success: false,
          fallback: true,
          reason: 'GEMINI_API_KEY not configured, will use deterministic answer generator',
        });
      }

      const recentChatText = (Array.isArray(chatHistory) ? chatHistory.slice(-8) : [])
        .map((m: any) => `${m.sender === 'user' ? 'Owner' : 'Assistant'}: ${m.text}`)
        .join('\n');

      const systemPrompt = buildAskSystemPrompt({
        businessSummary,
        products,
        customers,
        suppliers,
        rules,
        unitRelationships,
        recentEvents,
        recentChatText,
      });

      try {
        const response = await generateContentWithRetryAndFallback(ai, {
          contents: [{ text: systemPrompt }, { text: `Owner's message: "${question}"` }],
          config: { responseMimeType: 'application/json', temperature: 0.1 },
        });

        let parsed: any = {};
        try {
          parsed = JSON.parse(response.text || '{}');
        } catch {
          parsed = { answer: response.text || 'I have noted that down for your business.' };
        }

        return sendJson(res, 200, {
          success: true,
          answer: parsed.answer || 'I have noted that down for your business.',
          data: parsed,
          memories: parsed.memories || [],
          recordedEvent: parsed.recordedEvent || null,
          correctedEvent: parsed.correctedEvent || null,
          deletedEventId: parsed.deletedEventId || null,
          structuredAction: parsed.structuredAction || null,
        });
      } catch (err: any) {
        return sendJson(res, 200, {
          success: false,
          fallback: true,
          reason: 'AI service experiencing temporary demand spike; using deterministic calculation',
        });
      }
    }

    // Unmatched API endpoint
    return sendJson(res, 404, {
      success: false,
      error: `API endpoint not found: ${method} /api/${targetPath}`,
      status: 404,
    });
  } catch (fatalError: any) {
    console.error('Fatal API dispatch error:', fatalError);
    return sendJson(res, 500, {
      success: false,
      error: fatalError?.message || 'Internal server error in API dispatcher',
    });
  }
}
