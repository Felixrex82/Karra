import { verifyAdminRequest, setCorsHeaders } from '../_auth';
import { listRequests } from '../../server/betaStore';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  if (!verifyAdminRequest(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin authentication required.' });
  }

  try {
    const requests = listRequests();
    return res.status(200).json({ requests });
  } catch (err: any) {
    console.error('Access requests handler error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
