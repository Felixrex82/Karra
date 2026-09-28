import { verifyAdminRequest, setCorsHeaders, parseBody } from '../_auth';
import { listUsers, updateUserBetaStatus } from '../../server/betaStore';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!verifyAdminRequest(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin authentication required.' });
  }

  try {
    if (req.method === 'GET') {
      const users = listUsers();
      return res.status(200).json({ users });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const { userId, status } = body;
      if (!userId || !['active', 'suspended', 'revoked'].includes(status)) {
        return res.status(400).json({ error: 'Valid userId and status are required.' });
      }
      const ok = updateUserBetaStatus(userId, status);
      return res.status(200).json({ success: ok });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('Users handler error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
