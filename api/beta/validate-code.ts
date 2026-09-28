import { setCorsHeaders, parseBody } from '../_auth';
import { validateInvitationCode, checkRateLimit } from '../../server/betaStore';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'unknown';
    const rateLimit = checkRateLimit(`val_code_${clientIp}`, 15, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        valid: false,
        reason: 'RATE_LIMITED',
        message: 'Too many invitation code attempts. Please wait 15 minutes before trying again.',
        resetInSeconds: Math.ceil(rateLimit.resetMs / 1000),
      });
    }

    const body = parseBody(req);
    const { code } = body;
    const result = validateInvitationCode(code);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Validate code error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
