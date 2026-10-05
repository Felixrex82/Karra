import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { validateProductionConfig } from './server/config/env';
import { dispatchApiRequest, createAdminSession, isValidAdminSession } from './server/apiDispatcher';
import { startBackgroundNotificationWorker } from './server/notificationEngine';

// Ensure environment is loaded and validated
dotenv.config();
validateProductionConfig();

export const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

export { createAdminSession, isValidAdminSession };

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
  const rawQueryPath =
    urlParams.get('__path') ||
    urlParams.get('path') ||
    req.query?.__path ||
    req.query?.path;

  if (rawQueryPath) {
    const pathStr = Array.isArray(rawQueryPath) ? rawQueryPath.join('/') : String(rawQueryPath || '');
    const cleanPath = pathStr.replace(/^\/+/, '');
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

// Delegate all /api requests to universal API dispatcher
app.all(['/api', '/api/*'], async (req, res) => {
  await dispatchApiRequest(req, res);
});

// Global error handler
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
    console.log(`Karra Server running on http://0.0.0.0:${PORT}`);
    // Start automated background notification reminder worker
    startBackgroundNotificationWorker();
  });

  server.on('error', (err: any) => {
    console.error('Karra Server error:', err);
  });
}

const isMainModule = Boolean(
  process.argv[1] &&
    (process.argv[1].endsWith('server.ts') ||
     process.argv[1].endsWith('server.cjs') ||
     process.argv[1].endsWith('server.js'))
);

const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.IS_TEST) || Boolean(process.env.VITEST);

if (isMainModule && !process.env.VERCEL && !isTestEnv) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}

export default app;
