import { setCorsHeaders, parseBody } from '../_auth';
import { trackBetaEvent } from '../../server/betaStore';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const body = parseBody(req);
    const { userId, userEmail, businessName, eventName, metadata } = body;
    if (!userId || !eventName) {
      return res.status(400).json({ error: 'userId and eventName are required.' });
    }

    trackBetaEvent({ userId, userEmail, businessName, eventName, metadata });
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Track event error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
