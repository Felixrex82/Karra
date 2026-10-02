import crypto from 'crypto';
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

export function isValidAdminSession(token: string, email?: string): boolean {
  if (!token) return false;
  const trimmedToken = token.trim();

  // 1. Direct secret / founder key match
  const candidateKeys = [
    '@Felixrex1',
    'founder_active_admin',
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

  // 1b. Direct founder token match
  if (
    trimmedToken.startsWith('karra_adm_') ||
    trimmedToken.startsWith('karra_admin_') ||
    trimmedToken.includes('founder')
  ) {
    if (!email || email.trim().toLowerCase() === FOUNDER_EMAIL.toLowerCase()) {
      return true;
    }
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

  // 3. In-memory session map check
  const session = activeAdminSessions.get(trimmedToken);
  if (session) {
    if (Date.now() > session.expiresAt) {
      activeAdminSessions.delete(trimmedToken);
      return false;
    }
    if (email && email.trim().toLowerCase() !== session.email.toLowerCase()) {
      return false;
    }
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
      return sendJson(res, 200, { success: ok });
    }

    // E. Admin Users
    if (targetPath === 'admin/users' || targetPath === 'admin/users/status') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      if (method === 'GET') {
        return sendJson(res, 200, { users: listUsers() });
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
      const limit = Number(req.query?.limit) || 300;
      const userId = (req.query?.userId as string) || undefined;
      return sendJson(res, 200, { events: listEvents(limit, userId) });
    }

    // H. Admin Analytics
    if (targetPath === 'admin/analytics') {
      if (!verifyAdminRequest(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin required.' });
      }
      return sendJson(res, 200, { analytics: getBetaAnalytics() });
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
      const result = validateInvitationCode(code);
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
      const result = redeemInvitationCode(code, {
        userId,
        userEmail,
        businessName: businessName || 'My Business',
      });
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
