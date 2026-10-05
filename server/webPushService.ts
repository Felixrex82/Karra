import fs from 'fs';
import path from 'path';
import webpush from 'web-push';

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

interface PushSubscriptionRecord {
  userId: string;
  subscription: webpush.PushSubscription;
  createdAt: string;
  userAgent?: string;
}

const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'data')
  : path.join(process.cwd(), 'data');

const VAPID_FILE = path.join(DATA_DIR, 'vapid_keys.json');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'push_subscriptions.json');

let cachedKeys: VapidKeys | null = null;
let cachedSubscriptions: PushSubscriptionRecord[] | null = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {}
  }
}

export function getOrGenerateVapidKeys(): VapidKeys {
  if (cachedKeys) return cachedKeys;
  ensureDir();

  // 1. Check environment variables
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cachedKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY.trim(),
      privateKey: process.env.VAPID_PRIVATE_KEY.trim(),
    };
    webpush.setVapidDetails(
      'mailto:olamidefelix54@gmail.com',
      cachedKeys.publicKey,
      cachedKeys.privateKey
    );
    return cachedKeys;
  }

  // 2. Check disk file
  try {
    if (fs.existsSync(VAPID_FILE)) {
      const raw = fs.readFileSync(VAPID_FILE, 'utf-8');
      cachedKeys = JSON.parse(raw);
      if (cachedKeys?.publicKey && cachedKeys?.privateKey) {
        webpush.setVapidDetails(
          'mailto:olamidefelix54@gmail.com',
          cachedKeys.publicKey,
          cachedKeys.privateKey
        );
        return cachedKeys;
      }
    }
  } catch {}

  // 3. Generate new stable VAPID key pair
  const keys = webpush.generateVAPIDKeys();
  cachedKeys = {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
  };

  try {
    fs.writeFileSync(VAPID_FILE, JSON.stringify(cachedKeys, null, 2), 'utf-8');
  } catch {}

  webpush.setVapidDetails(
    'mailto:olamidefelix54@gmail.com',
    cachedKeys.publicKey,
    cachedKeys.privateKey
  );
  return cachedKeys;
}

export function loadSubscriptions(): PushSubscriptionRecord[] {
  if (cachedSubscriptions) return cachedSubscriptions;
  ensureDir();
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      const raw = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8');
      cachedSubscriptions = JSON.parse(raw);
      return cachedSubscriptions || [];
    }
  } catch {}
  cachedSubscriptions = [];
  return cachedSubscriptions;
}

export function getSubscribedUserIds(): string[] {
  const list = loadSubscriptions();
  return Array.from(new Set(list.map((s) => s.userId)));
}

function persistSubscriptions() {
  if (!cachedSubscriptions) return;
  ensureDir();
  try {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(cachedSubscriptions, null, 2), 'utf-8');
  } catch {}
}

export function savePushSubscription(
  userId: string,
  subscription: webpush.PushSubscription,
  userAgent?: string
): void {
  const list = loadSubscriptions();
  // Filter out identical endpoint
  const filtered = list.filter((s) => s.subscription.endpoint !== subscription.endpoint);
  filtered.push({
    userId,
    subscription,
    createdAt: new Date().toISOString(),
    userAgent,
  });
  cachedSubscriptions = filtered;
  persistSubscriptions();
}

export async function sendPushToUser(
  userId: string,
  payload: {
    title: string;
    message: string;
    category?: string;
    actionType?: string;
    actionLabel?: string;
  }
): Promise<{ sent: number; failed: number }> {
  getOrGenerateVapidKeys();
  const list = loadSubscriptions();
  const userSubs = list.filter((s) => s.userId === userId);

  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];

  const bodyData = JSON.stringify({
    title: payload.title,
    message: payload.message,
    category: payload.category || 'REMINDER',
    actionType: payload.actionType || 'CHAT_KARRA',
    actionLabel: payload.actionLabel || 'Tell Karra',
  });

  for (const item of userSubs) {
    try {
      await webpush.sendNotification(item.subscription, bodyData, {
        TTL: 60 * 60 * 24, // 24 hours
        urgency: 'high',
      });
      sent++;
    } catch (err: any) {
      failed++;
      // Clean up 404 or 410 expired subscriptions
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        expiredEndpoints.push(item.subscription.endpoint);
      }
    }
  }

  if (expiredEndpoints.length > 0) {
    cachedSubscriptions = list.filter((s) => !expiredEndpoints.includes(s.subscription.endpoint));
    persistSubscriptions();
  }

  return { sent, failed };
}

export async function sendPushToAllUsers(payload: {
  title: string;
  message: string;
  category?: string;
  actionType?: string;
  actionLabel?: string;
}): Promise<{ totalSent: number; totalFailed: number }> {
  getOrGenerateVapidKeys();
  const list = loadSubscriptions();
  let totalSent = 0;
  let totalFailed = 0;

  const uniqueUserIds = Array.from(new Set(list.map((s) => s.userId)));
  for (const uid of uniqueUserIds) {
    const res = await sendPushToUser(uid, payload);
    totalSent += res.sent;
    totalFailed += res.failed;
  }

  return { totalSent, totalFailed };
}
