import { setCorsHeaders, parseBody } from '../_auth';
import { redeemInvitationCode } from '../../server/betaStore';

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
    const { code, userId, userEmail, businessName } = body;
    if (!code || !userId || !userEmail) {
      return res.status(400).json({ success: false, message: 'code, userId, and userEmail are required.' });
    }

    const result = redeemInvitationCode(code, {
      userId,
      userEmail,
      businessName: businessName || 'My Business',
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Redeem code error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
