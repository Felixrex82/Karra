import { setCorsHeaders, isValidAdminSession } from '../_auth';
import { getUserBetaStatus } from '../../server/betaStore';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const userId = (req.query?.userId as string) || (req.headers['x-user-id'] as string) || '';
    const userEmail = (req.query?.userEmail as string) || (req.headers['x-user-email'] as string) || '';
    const authHeader = (req.headers['authorization'] as string) || '';
    const adminSecret = (req.headers['x-admin-secret'] as string) || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');

    const status = getUserBetaStatus(userId, userEmail);
    if (status.role === 'admin' && !isValidAdminSession(adminSecret, userEmail)) {
      status.role = 'merchant';
    }

    return res.status(200).json(status);
  } catch (err: any) {
    console.error('Beta status error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
