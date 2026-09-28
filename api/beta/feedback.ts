import { setCorsHeaders, parseBody } from '../_auth';
import { submitFeedback } from '../../server/betaStore';

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
    const { userId, userEmail, businessName, type, message, context } = body;
    if (!userId || !type || !message) {
      return res.status(400).json({ error: 'userId, type, and message are required.' });
    }

    const feedback = submitFeedback({
      userId,
      userEmail: userEmail || '',
      businessName: businessName || '',
      type,
      message,
      context,
    });

    return res.status(200).json({
      success: true,
      message: 'Thank you! Your feedback has been received and logged directly for the founder.',
      feedbackId: feedback.id,
    });
  } catch (err: any) {
    console.error('Feedback error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
