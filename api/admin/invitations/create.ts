import { verifyAdminRequest, setCorsHeaders, parseBody, FOUNDER_EMAIL } from '../../_auth';
import { createInvitation } from '../../../server/betaStore';

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
    const { maxUses, notes, expiresAt, customCode } = body;
    const adminEmail = (req.headers['x-admin-email'] as string) || FOUNDER_EMAIL;

    const invitation = createInvitation({
      maxUses: Number(maxUses) || 1,
      notes,
      expiresAt,
      customCode,
      createdBy: adminEmail,
    });

    return res.status(200).json({
      success: true,
      invitation,
    });
  } catch (err: any) {
    console.error('Error generating invitation code:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to generate invitation code.',
    });
  }
}
