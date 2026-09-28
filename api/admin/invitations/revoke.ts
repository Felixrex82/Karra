import { verifyAdminRequest, setCorsHeaders, parseBody } from '../../_auth';
import { revokeInvitation } from '../../../server/betaStore';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  if (!verifyAdminRequest(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin authentication required.' });
  }

  try {
    const body = parseBody(req);
    const { code } = body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'code is required.' });
    }

    const ok = revokeInvitation(code);
    return res.status(200).json({ success: ok });
  } catch (err: any) {
    console.error('Error revoking invitation:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to revoke invitation.' });
  }
}
