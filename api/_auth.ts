import crypto from 'crypto';

export const FOUNDER_EMAIL = 'olamidefelix54@gmail.com';

export function getSigningKey(): string {
  const secret = (process.env.ADMIN_SECRET || '').trim();
  if (secret) return secret;
  const password = (process.env.ADMIN_PASSWORD || '').trim().replace(/^["']|["']$/g, '');
  if (password) return password;
  return 'karra-platform-founder-auth-salt';
}

export function isValidAdminSession(token: string, email?: string): boolean {
  if (!token) return false;
  const trimmedToken = token.trim();

  // 1. Check programmatic ADMIN_SECRET or ADMIN_PASSWORD env var if configured
  const envSecret = (process.env.ADMIN_SECRET || '').trim();
  const envPassword = (process.env.ADMIN_PASSWORD || '').trim().replace(/^["']|["']$/g, '');
  if ((envSecret && trimmedToken === envSecret) || (envPassword && trimmedToken === envPassword)) {
    if (email && email.trim().toLowerCase() !== FOUNDER_EMAIL.toLowerCase()) {
      return false;
    }
    return true;
  }

  // 2. Check stateless signed HMAC token
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
            const configuredAdminEmail = (process.env.ADMIN_EMAIL || FOUNDER_EMAIL).trim().toLowerCase();
            if (tokenEmail === FOUNDER_EMAIL || tokenEmail === configuredAdminEmail) {
              if (!email || email.trim().toLowerCase() === tokenEmail) {
                return true;
              }
            }
          }
        }
      }
    } catch {}
  }

  return false;
}

export function verifyAdminRequest(req: any): boolean {
  const authHeader = (req.headers['authorization'] as string) || '';
  const adminSecret = (req.headers['x-admin-secret'] as string) || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');
  const adminEmail = (req.headers['x-admin-email'] as string) || '';
  return isValidAdminSession(adminSecret, adminEmail);
}

export function setCorsHeaders(res: any, methods = 'GET, POST, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret, x-admin-email, x-user-id, x-user-email');
}

export function parseBody(req: any): any {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}
