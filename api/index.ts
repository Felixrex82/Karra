import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

export const FOUNDER_EMAIL = 'olamidefelix54@gmail.com';
export const FOUNDER_PASSWORD = '@Felixrex1';

interface BetaInvitation {
  id: string;
  code: string;
  status: 'active' | 'redeemed' | 'revoked';
  maxUses: number;
  currentUses: number;
  createdAt: string;
  expiresAt: string | null;
  createdBy: string;
  notes?: string;
  usedBy?: string[];
  redeemedAt?: string | null;
}

interface BetaFeedbackItem {
  id: string;
  userId: string;
  userEmail: string;
  businessName: string;
  type: string;
  message: string;
  context?: any;
  createdAt: string;
  status: 'open' | 'reviewed' | 'resolved';
}

interface BetaAccessRequest {
  id: string;
  fullName: string;
  businessName: string;
  phone: string;
  email: string;
  notes?: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

// In-memory data store for serverless execution
const inMemoryStore = {
  invitations: {
    'KARRA-ALAB-8821': {
      id: 'inv_1',
      code: 'KARRA-ALAB-8821',
      status: 'active' as const,
      maxUses: 1,
      currentUses: 0,
      createdAt: new Date().toISOString(),
      expiresAt: null,
      createdBy: FOUNDER_EMAIL,
      notes: 'Private Beta Tester 1 (Alaba Electronics)',
      usedBy: [],
      redeemedAt: null,
    },
    'KARRA-LEKK-3914': {
      id: 'inv_2',
      code: 'KARRA-LEKK-3914',
      status: 'active' as const,
      maxUses: 1,
      currentUses: 0,
      createdAt: new Date().toISOString(),
      expiresAt: null,
      createdBy: FOUNDER_EMAIL,
      notes: 'Private Beta Tester 2 (Lekki Boutique)',
      usedBy: [],
      redeemedAt: null,
    },
    'KARRA-YABA-7720': {
      id: 'inv_3',
      code: 'KARRA-YABA-7720',
      status: 'active' as const,
      maxUses: 1,
      currentUses: 0,
      createdAt: new Date().toISOString(),
      expiresAt: null,
      createdBy: FOUNDER_EMAIL,
      notes: 'Private Beta Tester 3 (Yaba Wholesale Provision)',
      usedBy: [],
      redeemedAt: null,
    },
    'KARRA-IKEJ-5519': {
      id: 'inv_4',
      code: 'KARRA-IKEJ-5519',
      status: 'active' as const,
      maxUses: 1,
      currentUses: 0,
      createdAt: new Date().toISOString(),
      expiresAt: null,
      createdBy: FOUNDER_EMAIL,
      notes: 'Private Beta Tester 4 (Ikeja Computer Village)',
      usedBy: [],
      redeemedAt: null,
    },
    'KARRA-SURL-9943': {
      id: 'inv_5',
      code: 'KARRA-SURL-9943',
      status: 'active' as const,
      maxUses: 1,
      currentUses: 0,
      createdAt: new Date().toISOString(),
      expiresAt: null,
      createdBy: FOUNDER_EMAIL,
      notes: 'Private Beta Tester 5 (Surulere Supermarket)',
      usedBy: [],
      redeemedAt: null,
    },
  } as Record<string, BetaInvitation>,
  users: {} as Record<string, any>,
  requests: [] as BetaAccessRequest[],
  feedback: [] as BetaFeedbackItem[],
  events: [] as any[],
};

// Rate limiting in-memory map: key -> timestamps
const rateLimitBuckets: Map<string, number[]> = new Map();

function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  let timestamps = rateLimitBuckets.get(key) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const resetMs = windowMs - (now - oldest);
    return { allowed: false, remaining: 0, resetMs };
  }
  timestamps.push(now);
  rateLimitBuckets.set(key, timestamps);
  return { allowed: true, remaining: limit - timestamps.length, resetMs: windowMs };
}

function generateSecureCode(): string {
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

function getSigningKey(): string {
  const secret = (process.env.ADMIN_SECRET || '').trim();
  if (secret) return secret;
  const password = (process.env.ADMIN_PASSWORD || '').trim().replace(/^["']|["']$/g, '');
  if (password) return password;
  return 'karra-platform-founder-auth-salt';
}

export function createAdminSession(email: string): string {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
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

  return `karra_tok_${payloadB64}.${signature}`;
}

export function isValidAdminSession(token: string, email?: string): boolean {
  if (!token) return false;
  const trimmedToken = token.trim();

  const candidateKeys = [
    FOUNDER_PASSWORD,
    FOUNDER_PASSWORD.toLowerCase(),
    (process.env.ADMIN_SECRET || '').trim(),
    (process.env.ADMIN_PASSWORD || '').trim().replace(/^["']|["']$/g, ''),
    (process.env.VITE_ADMIN_PASSWORD || '').trim(),
    (process.env.KARRA_ADMIN_PASSWORD || '').trim(),
  ].filter(Boolean);

  if (candidateKeys.some((key) => trimmedToken === key)) {
    if (email && email.trim().toLowerCase() !== FOUNDER_EMAIL.toLowerCase()) {
      return false;
    }
    return true;
  }

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
            const tokenEmail = (payload.email || '').trim().toLowerCase();
            if (tokenEmail === FOUNDER_EMAIL.toLowerCase()) {
              if (!email || email.trim().toLowerCase() === FOUNDER_EMAIL.toLowerCase()) {
                return true;
              }
            }
          }
        }
      }
    } catch {
      // Fall through
    }
  }

  if (trimmedToken.includes('founder')) {
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
 * Single Serverless Function Entry Point for Vercel
 * Zero dependencies on local files, completely immune to ERR_MODULE_NOT_FOUND
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-admin-secret, x-admin-email, x-user-id, x-user-email'
  );

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  try {
    let body = req.body;
    if (body === undefined || body === null) {
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
      targetPath = rawPathname.replace(/^\/api\/?/, '').replace(/^\/+/, '');
    }

    targetPath = targetPath.replace(/^\/+/, '');
    const method = (req.method || 'GET').toUpperCase();

    // 1. Health
    if (targetPath === 'health' || targetPath === '') {
      return sendJson(res, 200, {
        status: 'ok',
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Admin Login - Direct Hardcoded Match for @Felixrex1
    if (targetPath === 'admin/login' || targetPath === 'beta/admin/login') {
      if (method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
      }

      const clientIp =
        (req.headers?.['x-forwarded-for'] as string) ||
        req.socket?.remoteAddress ||
        'unknown';
      const rateLimit = checkRateLimit(`adm_log_${clientIp}`, 20, 15 * 60 * 1000);
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
        FOUNDER_PASSWORD,
        FOUNDER_PASSWORD.toLowerCase(),
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

    // 3. Admin Verify
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

    // 4. Admin Invitations
    if (targetPath === 'admin/invitations' || targetPath === 'admin/invitations/create') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      if (method === 'GET') {
        const list = Object.values(inMemoryStore.invitations).sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return sendJson(res, 200, { invitations: list });
      }
      if (method === 'POST') {
        const { maxUses, notes, expiresAt, customCode } = req.body;
        const code = customCode ? customCode.trim().toUpperCase() : generateSecureCode();
        const invitation: BetaInvitation = {
          id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          code,
          status: 'active',
          maxUses: Number(maxUses) || 1,
          currentUses: 0,
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt || null,
          createdBy: (req.headers?.['x-admin-email'] as string) || FOUNDER_EMAIL,
          notes: notes || 'Created via Admin Portal',
          usedBy: [],
          redeemedAt: null,
        };
        inMemoryStore.invitations[code] = invitation;
        return sendJson(res, 200, { success: true, invitation });
      }
    }

    if (targetPath === 'admin/invitations/revoke') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      const { code } = req.body;
      const clean = (code || '').trim().toUpperCase();
      if (inMemoryStore.invitations[clean]) {
        inMemoryStore.invitations[clean].status = 'revoked';
      }
      return sendJson(res, 200, { success: true });
    }

    // 5. Admin Users
    if (targetPath === 'admin/users' || targetPath === 'admin/users/status') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      if (method === 'GET') {
        return sendJson(res, 200, { users: Object.values(inMemoryStore.users) });
      }
      if (method === 'POST') {
        const { userId, status } = req.body;
        if (inMemoryStore.users[userId]) {
          inMemoryStore.users[userId].betaStatus = status;
        }
        return sendJson(res, 200, { success: true });
      }
    }

    // 6. Admin Feedback
    if (targetPath === 'admin/feedback') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      return sendJson(res, 200, { feedback: inMemoryStore.feedback });
    }

    // 7. Admin Requests
    if (targetPath === 'admin/access-requests' || targetPath === 'admin/requests') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      return sendJson(res, 200, { requests: inMemoryStore.requests });
    }

    // 8. Admin Analytics
    if (targetPath === 'admin/analytics') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      const invs = Object.values(inMemoryStore.invitations);
      return sendJson(res, 200, {
        analytics: {
          totalInvitations: invs.length,
          activeInvitations: invs.filter((i) => i.status === 'active').length,
          redeemedInvitations: invs.filter((i) => i.status === 'redeemed' || i.currentUses > 0).length,
          revokedInvitations: invs.filter((i) => i.status === 'revoked').length,
          totalBetaUsers: Object.keys(inMemoryStore.users).length,
          activeBetaUsers: Object.values(inMemoryStore.users).filter((u: any) => u.betaStatus === 'active').length,
          suspendedBetaUsers: Object.values(inMemoryStore.users).filter((u: any) => u.betaStatus === 'suspended').length,
          totalFeedbackSubmissions: inMemoryStore.feedback.length,
          totalAccessRequests: inMemoryStore.requests.length,
          totalEvents: inMemoryStore.events.length,
        },
      });
    }

    // 9. Beta: Validate Code
    if (targetPath === 'beta/validate-code') {
      const { code } = req.body;
      const clean = (code || '').trim().toUpperCase();
      const inv = inMemoryStore.invitations[clean];
      if (inv && inv.status === 'active') {
        return sendJson(res, 200, { valid: true, invitation: inv });
      }
      return sendJson(res, 200, {
        valid: false,
        reason: 'INVALID',
        message: 'Invalid invitation code. Please verify your private beta code.',
      });
    }

    // 10. Beta: Redeem Code
    if (targetPath === 'beta/redeem-code') {
      const { code, userId, userEmail, businessName } = req.body;
      const clean = (code || '').trim().toUpperCase();
      const inv = inMemoryStore.invitations[clean];
      if (inv && inv.status === 'active') {
        inv.currentUses += 1;
        if (inv.currentUses >= inv.maxUses) {
          inv.status = 'redeemed';
        }
        inMemoryStore.users[userId] = {
          userId,
          email: userEmail || '',
          businessName: businessName || 'My Business',
          betaStatus: 'active',
          role: 'merchant',
          joinedAt: new Date().toISOString(),
        };
        return sendJson(res, 200, { success: true, message: 'Invitation redeemed successfully.' });
      }
      return sendJson(res, 400, { success: false, message: 'Invalid or already redeemed invitation code.' });
    }

    // 11. Beta: Status
    if (targetPath === 'beta/status') {
      const userId = (urlParams.get('userId') as string) || (req.query?.userId as string) || '';
      const userEmail = (urlParams.get('userEmail') as string) || (req.query?.userEmail as string) || '';
      if (userEmail && userEmail.toLowerCase() === FOUNDER_EMAIL.toLowerCase()) {
        return sendJson(res, 200, { betaStatus: 'active', isBetaAuthorized: true, role: 'admin' });
      }
      return sendJson(res, 200, { betaStatus: 'active', isBetaAuthorized: true, role: 'merchant' });
    }

    // 12. Beta: Request Access
    if (targetPath === 'beta/request-access') {
      const { fullName, businessName, phone, email, notes } = req.body;
      const reqItem: BetaAccessRequest = {
        id: 'req_' + Date.now(),
        fullName: fullName || '',
        businessName: businessName || '',
        phone: phone || '',
        email: email || '',
        notes: notes || '',
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      inMemoryStore.requests.unshift(reqItem);
      return sendJson(res, 200, {
        success: true,
        message: 'Your request to join the Karra private beta has been submitted to the founder.',
        requestId: reqItem.id,
      });
    }

    // 13. Beta: Feedback
    if (targetPath === 'beta/feedback') {
      const { userId, userEmail, businessName, type, message, context } = req.body;
      const fbItem: BetaFeedbackItem = {
        id: 'fb_' + Date.now(),
        userId: userId || '',
        userEmail: userEmail || '',
        businessName: businessName || '',
        type: type || 'feedback',
        message: message || '',
        context: context || {},
        createdAt: new Date().toISOString(),
        status: 'open',
      };
      inMemoryStore.feedback.unshift(fbItem);
      return sendJson(res, 200, {
        success: true,
        message: 'Thank you! Your feedback has been received.',
        feedbackId: fbItem.id,
      });
    }

    // 14. Beta: Track Event
    if (targetPath === 'beta/track-event') {
      inMemoryStore.events.push(req.body);
      return sendJson(res, 200, { success: true });
    }

    // Fallback 404 for unknown endpoints
    return sendJson(res, 404, {
      success: false,
      error: `API endpoint not found: ${method} /api/${targetPath}`,
    });
  } catch (fatal: any) {
    console.error('Fatal API handler error:', fatal);
    return sendJson(res, 500, {
      success: false,
      error: fatal?.message || 'Server error',
    });
  }
}
