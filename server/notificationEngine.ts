import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  NotificationItem,
  NotificationPreferences,
  NotificationDecision,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../src/types/notification';
import {
  evaluateNotificationDecision,
  MORNING_TEMPLATES,
  DAY_TEMPLATES,
  NIGHT_TEMPLATES,
  CONTEXTUAL_TEMPLATES,
} from '../src/engine/notificationEngine';
import { sendPushToUser, getSubscribedUserIds } from './webPushService';

export interface UserPresenceRecord {
  userId: string;
  userEmail?: string;
  businessName?: string;
  lastActiveTimestamp: string;
  eventsTodayCount?: number;
  isAway?: boolean;
}

interface NotificationStoreData {
  notifications: NotificationItem[];
  preferences: Record<string, NotificationPreferences>;
  evaluationLogs: Array<{
    id: string;
    userId: string;
    userEmail?: string;
    evaluatedAt: string;
    decision: NotificationDecision;
  }>;
  userPresence?: Record<string, UserPresenceRecord>;
}

const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'data')
  : path.join(process.cwd(), 'data');
const NOTIF_STORE_FILE = path.join(DATA_DIR, 'notification_data.json');

let cachedStore: NotificationStoreData | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      // directory creation guard
    }
  }
}

function loadStore(): NotificationStoreData {
  if (cachedStore) return cachedStore;
  ensureDataDir();
  try {
    if (fs.existsSync(NOTIF_STORE_FILE)) {
      const raw = fs.readFileSync(NOTIF_STORE_FILE, 'utf-8');
      cachedStore = JSON.parse(raw);
      return cachedStore!;
    }
  } catch (err) {
    console.warn('[NotificationEngine] Error loading store file:', err);
  }

  cachedStore = {
    notifications: [],
    preferences: {},
    evaluationLogs: [],
    userPresence: {},
  };
  return cachedStore;
}

export function updateUserPresence(presence: UserPresenceRecord) {
  const store = loadStore();
  if (!store.userPresence) store.userPresence = {};
  store.userPresence[presence.userId] = {
    ...store.userPresence[presence.userId],
    ...presence,
    lastActiveTimestamp: presence.lastActiveTimestamp || new Date().toISOString(),
  };
  persistStore();
}

function persistStore() {
  if (!cachedStore) return;
  ensureDataDir();
  try {
    fs.writeFileSync(NOTIF_STORE_FILE, JSON.stringify(cachedStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[NotificationEngine] Error persisting store:', err);
  }
}

export function getUserNotificationPreferences(userId: string): NotificationPreferences {
  const store = loadStore();
  return store.preferences[userId] || DEFAULT_NOTIFICATION_PREFERENCES;
}

export function updateUserNotificationPreferences(
  userId: string,
  updates: Partial<NotificationPreferences>
): NotificationPreferences {
  const store = loadStore();
  const current = store.preferences[userId] || DEFAULT_NOTIFICATION_PREFERENCES;
  const merged: NotificationPreferences = {
    ...current,
    ...updates,
    channels: { ...current.channels, ...(updates.channels || {}) },
    windows: {
      morning: { ...current.windows.morning, ...(updates.windows?.morning || {}) },
      day: { ...current.windows.day, ...(updates.windows?.day || {}) },
      night: { ...current.windows.night, ...(updates.windows?.night || {}) },
    },
    quietHours: { ...current.quietHours, ...(updates.quietHours || {}) },
  };
  store.preferences[userId] = merged;
  persistStore();
  return merged;
}

export function listUserNotifications(userId: string): NotificationItem[] {
  const store = loadStore();
  return store.notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function markNotificationsAsRead(userId: string, notificationIds?: string[]): number {
  const store = loadStore();
  let count = 0;
  const now = new Date().toISOString();

  store.notifications = store.notifications.map((item) => {
    if (item.userId === userId) {
      if (!notificationIds || notificationIds.includes(item.id)) {
        if (!item.read) {
          count++;
          return { ...item, read: true, readAt: now };
        }
      }
    }
    return item;
  });

  if (count > 0) {
    persistStore();
  }
  return count;
}

export function createNotification(
  userId: string,
  params: {
    category: NotificationItem['category'];
    title: string;
    message: string;
    actionType?: NotificationItem['actionType'];
    actionLabel?: NotificationItem['actionLabel'];
    deliveryChannel?: 'in_app' | 'browser_push' | 'both';
    contextMeta?: NotificationItem['contextMeta'];
  }
): NotificationItem {
  const store = loadStore();
  const prefs = getUserNotificationPreferences(userId);

  const item: NotificationItem = {
    id: `notif_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    userId,
    category: params.category,
    title: params.title,
    message: params.message,
    actionType: params.actionType,
    actionLabel: params.actionLabel,
    timestamp: new Date().toISOString(),
    read: false,
    deliveryChannel:
      params.deliveryChannel ||
      (prefs.channels.browserPush && prefs.channels.inApp
        ? 'both'
        : prefs.channels.browserPush
        ? 'browser_push'
        : 'in_app'),
    contextMeta: params.contextMeta,
  };

  store.notifications.unshift(item);
  // Cap history at 500
  if (store.notifications.length > 500) {
    store.notifications = store.notifications.slice(0, 500);
  }
  persistStore();

  // Send real background push notification to merchant's phone if push enabled
  if (prefs.channels.browserPush) {
    sendPushToUser(userId, {
      title: params.title,
      message: params.message,
      category: params.category,
      actionType: params.actionType,
      actionLabel: params.actionLabel,
    }).catch((err) => {
      console.warn('[NotificationEngine] Background push dispatch note:', err?.message);
    });
  }

  return item;
}

/**
 * Execute server evaluation for a specific user and dispatch notification if due
 */
export function evaluateAndDispatchForUser(context: {
  userId: string;
  userEmail?: string;
  businessName?: string;
  signupTimestamp?: string;
  lastActiveTimestamp?: string;
  isUserAway?: boolean;
  eventsToday?: any[];
  lifetimeEventsCount?: number;
  nowIso?: string;
}): { decision: NotificationDecision; notification?: NotificationItem } {
  const store = loadStore();
  const prefs = getUserNotificationPreferences(context.userId);

  const todayStr = (context.nowIso ? new Date(context.nowIso) : new Date())
    .toISOString()
    .split('T')[0];

  const recentNotificationsToday = store.notifications.filter(
    (n) => n.userId === context.userId && n.timestamp.startsWith(todayStr)
  );

  const decision = evaluateNotificationDecision({
    userId: context.userId,
    userEmail: context.userEmail,
    businessName: context.businessName,
    signupTimestamp: context.signupTimestamp,
    lastActiveTimestamp: context.lastActiveTimestamp,
    isUserAway: context.isUserAway ?? true,
    preferences: prefs,
    todayDateStr: todayStr,
    eventsToday: context.eventsToday || [],
    lifetimeEventsCount: context.lifetimeEventsCount || 0,
    recentNotificationsToday,
    nowIso: context.nowIso,
  });

  // Log evaluation
  store.evaluationLogs.unshift({
    id: `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    userId: context.userId,
    userEmail: context.userEmail,
    evaluatedAt: new Date().toISOString(),
    decision,
  });
  if (store.evaluationLogs.length > 300) {
    store.evaluationLogs = store.evaluationLogs.slice(0, 300);
  }

  let createdItem: NotificationItem | undefined = undefined;

  if (decision.shouldSend && decision.title && decision.message && decision.category) {
    createdItem = createNotification(context.userId, {
      category: decision.category,
      title: decision.title,
      message: decision.message,
      actionType: decision.actionType,
      actionLabel: decision.actionLabel,
      contextMeta: {
        window: decision.window,
        reason: decision.reason,
      },
    });
  }

  persistStore();
  return { decision, notification: createdItem };
}

/**
 * Create a live test notification for verification
 */
export function sendTestNotification(
  userId: string,
  type: 'morning' | 'day' | 'night' | 'first_use' | 'inactive' | 'sale_no_expense' | 'several_recorded'
): NotificationItem {
  let title = 'Good morning 👋';
  let message = 'What’s happening in your business today? Tell Karra and let it keep track for you.';
  let category: NotificationItem['category'] = 'MORNING_REMINDER';
  let actionType: NotificationItem['actionType'] = 'CHAT_KARRA';
  let actionLabel = 'Tell Karra';

  if (type === 'morning') {
    const t = MORNING_TEMPLATES[0];
    title = t.title;
    message = t.message;
    category = 'MORNING_REMINDER';
    actionType = t.actionType;
    actionLabel = t.actionLabel;
  } else if (type === 'day') {
    const t = DAY_TEMPLATES[0];
    title = t.title;
    message = t.message;
    category = 'DAY_REMINDER';
    actionType = t.actionType;
    actionLabel = t.actionLabel;
  } else if (type === 'night') {
    const t = NIGHT_TEMPLATES[0];
    title = t.title;
    message = t.message;
    category = 'NIGHT_REMINDER';
    actionType = t.actionType;
    actionLabel = t.actionLabel;
  } else if (type === 'first_use') {
    const t = CONTEXTUAL_TEMPLATES.firstUse;
    title = t.title;
    message = t.message;
    category = 'FIRST_USE_REMINDER';
    actionType = t.actionType;
    actionLabel = t.actionLabel;
  } else if (type === 'inactive') {
    const t = CONTEXTUAL_TEMPLATES.inactiveUser;
    title = t.title;
    message = t.message;
    category = 'INACTIVE_USER_REMINDER';
    actionType = t.actionType;
    actionLabel = t.actionLabel;
  } else if (type === 'sale_no_expense') {
    const t = CONTEXTUAL_TEMPLATES.saleNoExpense;
    title = t.title;
    message = t.message;
    category = 'CONTEXTUAL_FOLLOWUP';
    actionType = t.actionType;
    actionLabel = t.actionLabel;
  } else if (type === 'several_recorded') {
    const t = CONTEXTUAL_TEMPLATES.severalTransactionsRecorded;
    title = t.title;
    message = t.message;
    category = 'CONTEXTUAL_FOLLOWUP';
    actionType = t.actionType;
    actionLabel = t.actionLabel;
  }

  return createNotification(userId, {
    category,
    title,
    message,
    actionType,
    actionLabel,
    contextMeta: {
      reason: `test_preview_${type}`,
    },
  });
}

/**
 * Get notification statistics for Admin Dashboard
 */
export function getNotificationAnalytics() {
  const store = loadStore();
  const totalDispatched = store.notifications.length;
  const totalRead = store.notifications.filter((n) => n.read).length;
  const totalUnread = totalDispatched - totalRead;

  const totalEvaluations = store.evaluationLogs.length;
  const totalSent = store.evaluationLogs.filter((l) => l.decision.shouldSend).length;
  const suppressedQuietHours = store.evaluationLogs.filter(
    (l) => l.decision.reason === 'quiet_hours'
  ).length;
  const suppressedActiveUser = store.evaluationLogs.filter(
    (l) => l.decision.reason === 'recently_active' || l.decision.reason === 'night_activity_already_complete'
  ).length;
  const suppressedAlreadySent = store.evaluationLogs.filter(
    (l) => l.decision.reason === 'already_sent_in_window'
  ).length;

  return {
    totalDispatched,
    totalRead,
    totalUnread,
    readRate: totalDispatched > 0 ? Math.round((totalRead / totalDispatched) * 100) : 0,
    totalEvaluations,
    totalSent,
    suppressedQuietHours,
    suppressedActiveUser,
    suppressedAlreadySent,
    recentDispatches: store.notifications.slice(0, 50),
    recentLogs: store.evaluationLogs.slice(0, 50),
  };
}

let backgroundWorkerTimer: NodeJS.Timeout | null = null;

/**
 * Start the background reminder worker that checks reminder windows
 * for all merchants and dispatches real push notifications even when
 * the merchant is not currently in the app.
 */
export function startBackgroundNotificationWorker() {
  if (backgroundWorkerTimer) return;

  console.log('[NotificationEngine] Background reminder worker active. Monitoring reminder windows for all merchants...');

  const runEvaluationCycle = async () => {
    try {
      const store = loadStore();
      const subscribedUserIds = getSubscribedUserIds();
      const presenceUserIds = Object.keys(store.userPresence || {});
      const preferenceUserIds = Object.keys(store.preferences || {});

      const allUserIds = Array.from(new Set([...subscribedUserIds, ...presenceUserIds, ...preferenceUserIds]));

      for (const userId of allUserIds) {
        const prefs = getUserNotificationPreferences(userId);
        if (!prefs.enabled) continue;

        const presence = store.userPresence?.[userId];
        const lastActiveTimestamp = presence?.lastActiveTimestamp;
        const eventsTodayCount = presence?.eventsTodayCount || 0;
        const businessName = presence?.businessName;
        const userEmail = presence?.userEmail;

        const mockEventsToday = Array.from({ length: eventsTodayCount }, (_, i) => ({
          id: `ev_${i}`,
          type: 'SALE',
          timestamp: lastActiveTimestamp || new Date().toISOString(),
        }));

        evaluateAndDispatchForUser({
          userId,
          userEmail,
          businessName,
          lastActiveTimestamp,
          isUserAway: presence?.isAway !== false,
          eventsToday: mockEventsToday,
          lifetimeEventsCount: eventsTodayCount,
        });
      }
    } catch (err: any) {
      console.warn('[NotificationEngine] Background evaluation warning:', err?.message);
    }
  };

  // Run initial check after 8s, then every 60 seconds
  setTimeout(runEvaluationCycle, 8000);
  backgroundWorkerTimer = setInterval(runEvaluationCycle, 60 * 1000);
}

/**
 * Schedule a delayed push notification (e.g. 5 seconds delay)
 * so the merchant can switch tabs or lock their phone to verify
 * that notifications arrive when they are away from the app.
 */
export function scheduleDelayedPush(
  userId: string,
  delaySeconds: number = 5,
  type: 'morning' | 'day' | 'night' | 'first_use' = 'night'
): Promise<NotificationItem> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const item = sendTestNotification(userId, type);
      resolve(item);
    }, Math.max(1, delaySeconds) * 1000);
  });
}
