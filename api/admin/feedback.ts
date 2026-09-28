import { verifyAdminRequest, setCorsHeaders } from '../_auth';
import { listFeedback } from '../../server/betaStore';

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
    const feedback = listFeedback();
    return res.status(200).json({ feedback });
  } catch (err: any) {
    console.error('Feedback handler error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
