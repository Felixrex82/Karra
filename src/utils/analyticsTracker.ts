import { auth, db, sanitizeForFirestore } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export interface TrackingMetadata {
  amount?: number;
  currency?: string;
  source?: 'text' | 'voice' | 'quick_chip' | 'form';
  feature?: string;
  count?: number;
  businessName?: string;
  [key: string]: any;
}

/**
 * Centrally track product events for admin command center.
 * Strictly non-blocking and fail-safe.
 */
export async function trackAppEvent(
  eventName: string,
  metadata?: TrackingMetadata,
  userOverride?: { userId?: string; email?: string; businessName?: string }
): Promise<void> {
  try {
    const currentUser = auth.currentUser;
    const userId = userOverride?.userId || currentUser?.uid || 'guest';
    const userEmail = userOverride?.email || currentUser?.email || '';
    const businessName = userOverride?.businessName || '';

    const payload = {
      userId,
      userEmail,
      businessName,
      eventName,
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
    };

    // 1. Post to backend server endpoint
    fetch('/api/beta/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Ignore network errors in tracking
    });

    // 2. Best-effort Firestore write if user is signed in
    if (currentUser && !currentUser.isAnonymous && db) {
      try {
        const eventsCol = collection(db, 'beta_events');
        await addDoc(eventsCol, sanitizeForFirestore({
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          ...payload,
        }));
      } catch {
        // Safe to ignore if permissions or offline
      }
    }
  } catch {
    // Non-blocking fail-safe
  }
}
