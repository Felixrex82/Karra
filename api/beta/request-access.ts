import { setCorsHeaders, parseBody } from '../_auth';
import { submitAccessRequest, checkRateLimit } from '../../server/betaStore';

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
    const rateLimit = checkRateLimit(`req_acc_${clientIp}`, 5, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment before trying again.' });
    }

    const body = parseBody(req);
    const { fullName, businessName, phone, email, notes } = body;
    if (!fullName || !businessName || !email) {
      return res.status(400).json({ error: 'Full name, business name, and email are required.' });
    }

    const request = submitAccessRequest({ fullName, businessName, phone: phone || '', email, notes });
    return res.status(200).json({
      success: true,
      message: 'Your request to join the Karra private beta has been submitted to the founder.',
      requestId: request.id,
    });
  } catch (err: any) {
    console.error('Request access error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
