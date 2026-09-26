import crypto from 'crypto';

const FOUNDER_EMAIL = 'olamidefelix54@gmail.com';

function getSigningKey(): string {
  const secret = (process.env.ADMIN_SECRET || '').trim();
  if (secret) return secret;
  const password = (process.env.ADMIN_PASSWORD || '').trim().replace(/^["']|["']$/g, '');
  if (password) return password;
  return 'karra-platform-founder-auth-salt';
}

function createAdminSession(email: string): string {
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

  return `karra_tok_${payloadB64}.${signature}`;
}

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret, x-admin-email');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const rawEmail = body?.email || '';
    const rawPass = body?.password || '';
    const normalizedEmail = (rawEmail || '').trim().toLowerCase();
    const trimmedPassword = (rawPass || '').trim();
    const cleanEnteredPassword = trimmedPassword.replace(/^["']|["']$/g, '').trim();

    const rawExpectedPassword = (process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET || '').trim();
    const cleanExpectedPassword = rawExpectedPassword.replace(/^["']|["']$/g, '').trim();

    if (!cleanExpectedPassword && !rawExpectedPassword) {
      return res.status(500).json({
        success: false,
        error: 'ADMIN_PASSWORD environment variable is not configured in Vercel. In your Vercel Project Settings > Environment Variables, confirm ADMIN_PASSWORD is set for Production & Preview, then go to Deployments and trigger "Redeploy".',
      });
    }

    const configuredAdminEmail = (process.env.ADMIN_EMAIL || FOUNDER_EMAIL).trim().toLowerCase();
    const isEmailValid = normalizedEmail === FOUNDER_EMAIL.toLowerCase() || normalizedEmail === configuredAdminEmail;

    const isPasswordValid = Boolean(
      (cleanExpectedPassword && trimmedPassword === cleanExpectedPassword) ||
      (rawExpectedPassword && trimmedPassword === rawExpectedPassword) ||
      (cleanExpectedPassword && cleanEnteredPassword === cleanExpectedPassword) ||
      (rawExpectedPassword && cleanEnteredPassword === rawExpectedPassword) ||
      (cleanExpectedPassword && rawPass === cleanExpectedPassword) ||
      (rawExpectedPassword && rawPass === rawExpectedPassword)
    );

    if (isEmailValid && isPasswordValid) {
      const sessionToken = createAdminSession(normalizedEmail);
      return res.status(200).json({
        success: true,
        token: sessionToken,
        email: normalizedEmail,
        role: 'admin',
        message: 'Founder admin authentication verified.',
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'Invalid founder admin credentials. Access denied.',
      });
    }
  } catch (err: any) {
    console.error('Admin login error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error during authentication.',
    });
  }
}
