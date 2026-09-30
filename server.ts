import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import {
  generateContentWithRetryAndFallback,
  buildInterpretPrompt,
  buildAskSystemPrompt,
} from './server/geminiEngine';
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
} from './server/betaStore';

dotenv.config();

export const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Global CORS & preflight headers for all requests
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-admin-secret, x-admin-email, x-user-id, x-user-email'
  );
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// JSON body parsing with pre-parsed Vercel lambda stream guard
app.use((req, res, next) => {
  if (req.body !== undefined && req.body !== null) {
    (req as any)._body = true;
    if (typeof req.body === 'string' && req.body.trim().length > 0) {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // Retain raw string if not valid JSON
      }
    }
  }
  next();
});
app.use(express.json({ limit: '10mb' }));

// Resilient path normalization for Vercel Serverless Function invocations & rewrites
app.use((req, res, next) => {
  const rawUrl = req.url || '/';
  const [pathname, queryString] = rawUrl.split('?');
  const qs = queryString ? `?${queryString}` : '';

  // 1. If req.url is already a specific /api/... path with a subroute (e.g. /api/beta/status)
  if (pathname.startsWith('/api/') && pathname.length > 5) {
    return next();
  }

  // 2. Query param __path or path injected by Vercel rewrite (e.g. /api?__path=beta/status)
  const urlParams = new URLSearchParams(queryString || '');
  const queryPath =
    urlParams.get('__path') ||
    urlParams.get('path') ||
    (req.query?.__path as string) ||
    (req.query?.path as string);

  if (queryPath) {
    const cleanPath = queryPath.replace(/^\/+/, '');
    urlParams.delete('__path');
    urlParams.delete('path');
    const remainingQs = urlParams.toString() ? `?${urlParams.toString()}` : '';
    req.url = `/api/${cleanPath}${remainingQs}`;
    return next();
  }

  // 3. Vercel route matches header (e.g. x-now-route-matches: 1=beta%2Fstatus)
  const routeMatches = req.headers['x-now-route-matches'] as string;
  if (routeMatches) {
    const match = routeMatches.match(/1=([^&]+)/);
    if (match && match[1]) {
      const decoded = decodeURIComponent(match[1]).replace(/^\/+/, '');
      req.url = `/api/${decoded}${qs}`;
      return next();
    }
  }

  // 4. Vercel matched path / invoke path / forwarded url
  const matchedPath =
    (req.headers['x-matched-path'] as string) ||
    (req.headers['x-invoke-path'] as string) ||
    (req.headers['x-forwarded-url'] as string);
  if (matchedPath && matchedPath !== '/api' && matchedPath !== '/api/') {
    const [mPath] = matchedPath.split('?');
    if (mPath.startsWith('/api/')) {
      req.url = `${mPath}${qs}`;
      return next();
    } else if (mPath.startsWith('/admin') || mPath.startsWith('/beta')) {
      req.url = `/api${mPath}${qs}`;
      return next();
    }
  }

  next();
});

import { dispatchApiRequest, createAdminSession, isValidAdminSession } from './server/apiDispatcher';
export { createAdminSession, isValidAdminSession };

// Delegate all /api requests to universal API dispatcher
app.all(['/api', '/api/*'], async (req, res) => {
  await dispatchApiRequest(req, res);
});

/**
 * Admin authorization middleware - strictly requires valid admin session token
 */
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = (req.headers['authorization'] as string) || '';
  const adminSecret = (req.headers['x-admin-secret'] as string) || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');
  const adminEmail = (req.headers['x-admin-email'] as string) || '';

  if (!isValidAdminSession(adminSecret, adminEmail)) {
    res.status(403).json({
      error: 'Access denied. Valid Founder/Admin credentials required.',
    });
    return;
  }

  return next();
}


// Lazy-initialized Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// =========================================================================
// CLOSED BETA SYSTEM ENDPOINTS
// =========================================================================

// 1. Validate Invitation Code (Rate limited against brute-force attacks)
app.post('/api/beta/validate-code', (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const rateLimit = checkRateLimit(`code_val_${clientIp}`, 15, 15 * 60 * 1000); // 15 attempts per 15 mins
  if (!rateLimit.allowed) {
    res.status(429).json({
      valid: false,
      reason: 'RATE_LIMITED',
      message: 'Too many invitation code attempts. Please wait 15 minutes before trying again.',
      resetInSeconds: Math.ceil(rateLimit.resetMs / 1000),
    });
    return;
  }

  const { code } = req.body;
  const result = validateInvitationCode(code);
  res.json(result);
});

// 2. Redeem Invitation Code
app.post('/api/beta/redeem-code', (req, res) => {
  const { code, userId, userEmail, businessName } = req.body;
  if (!code || !userId || !userEmail) {
    res.status(400).json({ success: false, message: 'code, userId, and userEmail are required.' });
    return;
  }

  const result = redeemInvitationCode(code, {
    userId,
    userEmail,
    businessName: businessName || 'My Business',
  });

  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

// 3. Check User's Beta Authorization Status
app.get('/api/beta/status', (req, res) => {
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
  const userEmail = (req.query.userEmail as string) || (req.headers['x-user-email'] as string) || '';
  const authHeader = (req.headers['authorization'] as string) || '';
  const adminSecret = (req.headers['x-admin-secret'] as string) || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');

  const status = getUserBetaStatus(userId, userEmail);
  // Strictly ensure role: 'admin' is only returned when caller has a verified admin session
  if (status.role === 'admin' && !isValidAdminSession(adminSecret, userEmail)) {
    status.role = 'merchant';
  }
  res.json(status);
});

// 4. Request Access (For visitors without an invitation code)
app.post('/api/beta/request-access', (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const rateLimit = checkRateLimit(`req_acc_${clientIp}`, 5, 15 * 60 * 1000);
  if (!rateLimit.allowed) {
    res.status(429).json({ error: 'Too many requests. Please wait a moment before trying again.' });
    return;
  }

  const { fullName, businessName, phone, email, notes } = req.body;
  if (!fullName || !businessName || !email) {
    res.status(400).json({ error: 'Full name, business name, and email are required.' });
    return;
  }

  const request = submitAccessRequest({ fullName, businessName, phone: phone || '', email, notes });
  res.json({
    success: true,
    message: 'Your request to join the Karra private beta has been submitted to the founder.',
    requestId: request.id,
  });
});

// 5. Submit Beta Tester Feedback & Problem Reports
app.post('/api/beta/feedback', (req, res) => {
  const { userId, userEmail, businessName, type, message, context } = req.body;
  if (!userId || !type || !message) {
    res.status(400).json({ error: 'userId, type, and message are required.' });
    return;
  }

  const feedback = submitFeedback({
    userId,
    userEmail: userEmail || '',
    businessName: businessName || '',
    type,
    message,
    context,
  });

  res.json({
    success: true,
    message: 'Thank you! Your feedback has been received and logged directly for the founder.',
    feedbackId: feedback.id,
  });
});

// 6. Track Beta Product Usage Events
app.post('/api/beta/track-event', (req, res) => {
  const { userId, userEmail, businessName, eventName, metadata } = req.body;
  if (!userId || !eventName) {
    res.status(400).json({ error: 'userId and eventName are required.' });
    return;
  }

  trackBetaEvent({ userId, userEmail, businessName, eventName, metadata });
  res.json({ success: true });
});

// =========================================================================
// FOUNDER / ADMIN MANAGEMENT ENDPOINTS
// =========================================================================

// Explicit admin login endpoint verifying email and designated founder password with brute-force rate limit
const handleAdminLogin = (req: express.Request, res: express.Response) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const rateLimit = checkRateLimit(`admin_login_${clientIp}`, 15, 15 * 60 * 1000); // 15 attempts per 15 mins
    if (!rateLimit.allowed) {
      res.status(429).json({
        success: false,
        error: 'Too many admin login attempts. Please wait 15 minutes before trying again.',
        resetInSeconds: Math.ceil(rateLimit.resetMs / 1000),
      });
      return;
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const rawEmail = body?.email || '';
    const rawPass = body?.password || '';
    const normalizedEmail = (rawEmail || '').trim().toLowerCase();
    const trimmedPassword = (rawPass || '').trim();
    const cleanEnteredPassword = trimmedPassword.replace(/^["']|["']$/g, '').trim();

    // Collect all authorized founder passwords:
    // 1. Permanent designated founder secret
    const DEFAULT_FOUNDER_PASS = '@Felixrex1';
    const candidateExpected: Set<string> = new Set([
      DEFAULT_FOUNDER_PASS,
      DEFAULT_FOUNDER_PASS.toLowerCase(),
    ]);

    // 2. Any environment variable configured in Vercel or local
    const envVars = [
      process.env.ADMIN_PASSWORD,
      process.env.ADMIN_SECRET,
      process.env.VITE_ADMIN_PASSWORD,
      process.env.VITE_ADMIN_SECRET,
      process.env.KARRA_ADMIN_PASSWORD,
      process.env.FOUNDER_PASSWORD,
    ];

    for (const val of envVars) {
      if (val && typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed) {
          candidateExpected.add(trimmed);
          const unquoted = trimmed.replace(/^["']|["']$/g, '').trim();
          if (unquoted) candidateExpected.add(unquoted);
        }
      }
    }

    const configuredAdminEmail = (process.env.ADMIN_EMAIL || FOUNDER_EMAIL).trim().toLowerCase();
    const isEmailValid = normalizedEmail === FOUNDER_EMAIL.toLowerCase() || normalizedEmail === configuredAdminEmail;

    // Check entered password variants against all valid candidates
    const enteredVariants = [
      rawPass,
      trimmedPassword,
      cleanEnteredPassword,
    ].filter(Boolean);

    let isPasswordValid = false;
    for (const entered of enteredVariants) {
      if (candidateExpected.has(entered)) {
        isPasswordValid = true;
        break;
      }
    }

    if (isEmailValid && isPasswordValid) {
      // Generate an ephemeral, cryptographically secure stateless HMAC admin session token
      const sessionToken = createAdminSession(normalizedEmail);
      res.json({
        success: true,
        token: sessionToken,
        email: normalizedEmail,
        role: 'admin',
        message: 'Founder admin authentication verified.',
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: 'Invalid founder admin credentials. Access denied.',
    });
  } catch (err: any) {
    console.error('Error during handleAdminLogin:', err);
    res.status(500).json({
      success: false,
      error: 'An internal authentication error occurred. Please try again.',
    });
  }
};

app.post(
  ['/api/admin/login', '/api/beta/admin/login', '/admin/login', '/beta/admin/login', '/'],
  handleAdminLogin
);

// Dedicated Admin Router: Every route on this router strictly executes requireAdmin
const adminRouter = express.Router();
adminRouter.use(requireAdmin);

adminRouter.get(['/', '/verify', '/api/verify'], (req, res) => {
  res.json({ success: true, authorized: true, role: 'admin', email: FOUNDER_EMAIL });
});

adminRouter.get(['/invitations', '/api/invitations'], (req, res) => {
  res.json({ invitations: listInvitations() });
});

adminRouter.post(['/invitations', '/invitations/create', '/api/invitations', '/api/invitations/create'], (req, res) => {
  const { maxUses, notes, expiresAt, customCode } = req.body;
  const invitation = createInvitation({
    maxUses: Number(maxUses) || 1,
    notes,
    expiresAt,
    customCode,
    createdBy: (req.headers['x-admin-email'] as string) || FOUNDER_EMAIL,
  });
  res.json({ success: true, invitation });
});

adminRouter.post(['/invitations/revoke', '/api/invitations/revoke'], (req, res) => {
  const { code } = req.body;
  if (!code) {
    res.status(400).json({ error: 'code is required.' });
    return;
  }
  const ok = revokeInvitation(code);
  res.json({ success: ok });
});

adminRouter.get(['/users', '/api/users'], (req, res) => {
  res.json({ users: listUsers() });
});

adminRouter.post(['/users', '/users/status', '/api/users', '/api/users/status'], (req, res) => {
  const { userId, status } = req.body;
  if (!userId || !['active', 'suspended', 'revoked'].includes(status)) {
    res.status(400).json({ error: 'Valid userId and status (active, suspended, revoked) are required.' });
    return;
  }
  const ok = updateUserBetaStatus(userId, status);
  res.json({ success: ok });
});

adminRouter.get(['/feedback', '/api/feedback'], (req, res) => {
  res.json({ feedback: listFeedback() });
});

adminRouter.get(['/requests', '/access-requests', '/api/requests', '/api/access-requests'], (req, res) => {
  res.json({ requests: listRequests() });
});

adminRouter.get(['/analytics', '/api/analytics'], (req, res) => {
  res.json({ analytics: getBetaAnalytics() });
});

// Protect all admin endpoints under /api/admin, /admin, /api/beta/admin, /beta/admin
app.use(['/api/admin', '/api/beta/admin', '/admin', '/beta/admin'], adminRouter);


// API endpoint: Interpret natural language statement into structured business event or query
app.post('/api/gemini/interpret', async (req, res) => {
  try {
    // Abuse protection & Rate limiting
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const rateLimit = checkRateLimit(`gemini_${clientIp}`, 40, 5 * 60 * 1000); // 40 requests per 5 mins
    if (!rateLimit.allowed) {
      res.status(429).json({
        success: false,
        error: 'AI request limit reached. Please wait a moment before sending more entries.',
        resetInSeconds: Math.ceil(rateLimit.resetMs / 1000),
      });
      return;
    }

    // Beta Authorization enforcement
    const userId = req.body.userId || (req.headers['x-user-id'] as string);
    const userEmail = req.body.userEmail || (req.headers['x-user-email'] as string);
    if (userId || userEmail) {
      const userBeta = getUserBetaStatus(userId || '', userEmail || '');
      if (!userBeta.isBetaAuthorized) {
        res.status(403).json({
          success: false,
          error: 'Beta authorization is required to access Karra AI features. Your account status is: ' + userBeta.betaStatus,
          betaStatus: userBeta.betaStatus,
        });
        return;
      }
    }
    const { userInput, memoryContext, recentEventsContext } = req.body;
    if (!userInput || typeof userInput !== 'string') {
      res.status(400).json({ error: 'userInput is required' });
      return;
    }

    const ai = getGenAI();
    if (!ai) {
      // Return flag indicating client-side fallback interpreter should be used
      res.json({
        success: false,
        fallback: true,
        reason: 'GEMINI_API_KEY not configured, using local deterministic NLP engine',
      });
      return;
    }

    const prompt = buildInterpretPrompt(userInput, memoryContext, recentEventsContext);

    const response = await generateContentWithRetryAndFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error('[Gemini Interpret Error]:', error?.status, error?.message || error);
    res.json({
      success: false,
      fallback: true,
      reason: error?.message || 'AI service experiencing temporary demand spike; fallback to deterministic rules',
    });
  }
});

// API endpoint: Conversational business question answering with context flow & memory extraction
app.post('/api/gemini/ask', async (req, res) => {
  try {
    // Abuse protection & Rate limiting
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const rateLimit = checkRateLimit(`gemini_${clientIp}`, 40, 5 * 60 * 1000); // 40 requests per 5 mins
    if (!rateLimit.allowed) {
      res.status(429).json({
        success: false,
        error: 'AI request limit reached. Please wait a moment before asking more questions.',
        resetInSeconds: Math.ceil(rateLimit.resetMs / 1000),
      });
      return;
    }

    // Beta Authorization enforcement
    const userId = req.body.userId || (req.headers['x-user-id'] as string);
    const userEmail = req.body.userEmail || (req.headers['x-user-email'] as string);
    if (userId || userEmail) {
      const userBeta = getUserBetaStatus(userId || '', userEmail || '');
      if (!userBeta.isBetaAuthorized) {
        res.status(403).json({
          success: false,
          error: 'Beta authorization is required to access Karra AI features. Your account status is: ' + userBeta.betaStatus,
          betaStatus: userBeta.betaStatus,
        });
        return;
      }
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
      res.status(400).json({ error: 'question is required' });
      return;
    }

    const ai = getGenAI();
    if (!ai) {
      res.json({
        success: false,
        fallback: true,
        reason: 'GEMINI_API_KEY not configured, will use deterministic answer generator',
      });
      return;
    }

    // Format recent chat turns for flow communication
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

    const response = await generateContentWithRetryAndFallback(ai, {
      contents: [
        { text: systemPrompt },
        { text: `Owner's message: "${question}"` },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    let answerText = '';
    let extractedMemories: any[] = [];
    let recordedEvent: any = null;
    let correctedEvent: any = null;
    let deletedEventId: string | null = null;
    let targetDescription: string | null = null;
    let structuredAction: any = null;
    let calendarDate: string | null = null;
    let calendarAction: string | null = null;

    try {
      const parsed = JSON.parse(response.text || '{}');
      answerText = parsed.answer || response.text || 'I have noted that down for your business.';
      extractedMemories = Array.isArray(parsed.memories) ? parsed.memories : [];
      recordedEvent = parsed.recordedEvent || null;
      correctedEvent = parsed.correctedEvent || null;
      deletedEventId = parsed.deletedEventId || null;
      targetDescription = parsed.targetDescription || null;
      structuredAction = parsed.structuredAction || null;
      calendarDate = parsed.calendarDate || null;
      calendarAction = parsed.calendarAction || (deletedEventId ? 'DELETED' : correctedEvent ? 'CORRECTED' : recordedEvent ? 'RECORDED' : null);
    } catch {
      answerText = response.text?.trim() || 'I have noted that down for your business.';
    }

    res.json({
      success: true,
      answer: answerText,
      data: {
        answer: answerText,
        memories: extractedMemories,
        recordedEvent,
        correctedEvent,
        deletedEventId,
        targetDescription,
        structuredAction,
        calendarDate,
        calendarAction,
      },
      memories: extractedMemories,
      recordedEvent,
      correctedEvent,
      deletedEventId,
      targetDescription,
      structuredAction,
      calendarDate,
      calendarAction,
    });
  } catch (error: any) {
    console.error('[Gemini Ask Error]:', error?.status, error?.message || error);
    res.json({
      success: false,
      fallback: true,
      reason: error?.message || 'AI service experiencing temporary demand spike; using deterministic calculation',
    });
  }
});

// Explicit JSON 404 handler for unmatched /api/* endpoints
// Prevents Vite SPA fallback from serving HTML index.html for failed API requests
app.all('/api/*', (req, res) => {
  res.status(404).json({
    error: `API endpoint not found: ${req.method} ${req.path}`,
    status: 404,
  });
});

// Global Express error handler guaranteeing JSON responses
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    success: false,
    error: err?.message || 'Internal server error',
  });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePkg);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`KudiOS Server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('KudiOS Server error:', err);
  });
}

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test' && !process.env.IS_TEST) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}

export default app;
