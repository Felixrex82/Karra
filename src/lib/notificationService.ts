import {
  NotificationItem,
  NotificationPreferences,
  NotificationDecision,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../types/notification';
import { evaluateNotificationDecision } from '../engine/notificationEngine';

const STORAGE_KEY_PREFS = 'karra_notification_preferences_v1';
const STORAGE_KEY_NOTIFS = 'karra_notifications_history_v1';

// -------------------------------------------------------------
// Audio Chime (Warm, calm marimba sound synthesized via Web Audio)
// -------------------------------------------------------------
export function playCalmNotificationChime() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Primary warm tone (E4 / 329.6 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(329.63, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Secondary resonant harmonic (G#4 / 415.3 Hz) with subtle delay
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(415.3, now + 0.12);
    gain2.gain.setValueAtTime(0.09, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.7);
  } catch (err) {
    // Audio context may require prior user interaction
  }
}

// -------------------------------------------------------------
// Service Worker & Permission Helpers
// -------------------------------------------------------------

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('[NotificationService] ServiceWorker registration skipped:', err);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribePhonePushNotifications(userId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg?.pushManager) return false;

    // Check if already subscribed
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      // Fetch VAPID public key
      const keyRes = await fetch('/api/push/vapid-public-key');
      const keyData = await keyRes.json();
      if (!keyData?.publicKey) return false;

      const convertedKey = urlBase64ToUint8Array(keyData.publicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    // Register subscription on backend
    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscription: sub.toJSON ? sub.toJSON() : sub,
        }),
      });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[NotificationService] Push subscription registration notice:', err);
    return false;
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('[NotificationService] Permission request failed:', err);
    return 'denied';
  }
}

export function getBrowserNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

// -------------------------------------------------------------
// Preferences & In-App Storage
// -------------------------------------------------------------

export function loadNotificationPreferences(userId?: string): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const key = userId ? `${STORAGE_KEY_PREFS}_${userId}` : STORAGE_KEY_PREFS;
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export function saveNotificationPreferences(
  prefs: NotificationPreferences,
  userId?: string
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = userId ? `${STORAGE_KEY_PREFS}_${userId}` : STORAGE_KEY_PREFS;
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch (err) {
    console.error('[NotificationService] Failed to save preferences:', err);
  }
}

export function loadStoredNotifications(userId?: string): NotificationItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = userId ? `${STORAGE_KEY_NOTIFS}_${userId}` : STORAGE_KEY_NOTIFS;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveStoredNotifications(
  items: NotificationItem[],
  userId?: string
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = userId ? `${STORAGE_KEY_NOTIFS}_${userId}` : STORAGE_KEY_NOTIFS;
    // Keep maximum 60 most recent notifications
    const trimmed = items.slice(0, 60);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch (err) {
    console.error('[NotificationService] Failed to save notifications:', err);
  }
}

// -------------------------------------------------------------
// Notification Dispatcher
// -------------------------------------------------------------

export async function deliverNotification(
  notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>,
  userId?: string,
  preferences?: NotificationPreferences
): Promise<NotificationItem> {
  const prefs = preferences || loadNotificationPreferences(userId);
  const newItem: NotificationItem = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    userId: userId || 'anonymous',
    timestamp: new Date().toISOString(),
    read: false,
    deliveryChannel:
      prefs.channels.browserPush && prefs.channels.inApp
        ? 'both'
        : prefs.channels.browserPush
        ? 'browser_push'
        : 'in_app',
  };

  // 1. Save to in-app notification inbox
  if (prefs.channels.inApp) {
    const existing = loadStoredNotifications(userId);
    const updated = [newItem, ...existing];
    saveStoredNotifications(updated, userId);
  }

  // 2. Play subtle chime & trigger phone vibration if enabled
  if (prefs.soundEnabled) {
    playCalmNotificationChime();
  }

  // Trigger native phone haptic vibration (WhatsApp signature rhythm)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([150, 80, 150, 80, 250]);
    } catch {}
  }

  // 3. Dispatch native Phone / Browser Push Notification if enabled & permitted
  if (
    prefs.channels.browserPush &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      if ('serviceWorker' in navigator) {
        // Send message to active Service Worker controller
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_PHONE_NOTIFICATION',
            title: newItem.title,
            message: newItem.message,
            category: newItem.category,
            actionType: newItem.actionType,
            actionLabel: newItem.actionLabel,
          });
        }

        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          const swOptions: any = {
            body: newItem.message,
            icon: '/karra-logo.svg',
            badge: '/karra-logo.svg',
            tag: `karra-${newItem.category}`,
            vibrate: [150, 80, 150, 80, 250],
            renotify: true,
            silent: false,
            data: {
              actionType: newItem.actionType,
              category: newItem.category,
            },
            actions: [
              {
                action: 'open_action',
                title: newItem.actionLabel || 'Open Karra',
              },
            ],
          };
          await reg.showNotification(newItem.title, swOptions);
          return newItem;
        }
      }
      // Desktop / direct fallback
      new Notification(newItem.title, {
        body: newItem.message,
        icon: '/karra-logo.svg',
        vibrate: [150, 80, 150, 80, 250],
      } as any);
    } catch (err) {
      console.warn('[NotificationService] Browser notification delivery failed:', err);
    }
  }

  return newItem;
}
