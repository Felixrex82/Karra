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

  // 2. Play subtle chime if enabled
  if (prefs.soundEnabled) {
    playCalmNotificationChime();
  }

  // 3. Dispatch Browser Push / Notification API if enabled & permitted
  if (
    prefs.channels.browserPush &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          reg.showNotification(newItem.title, {
            body: newItem.message,
            icon: '/karra-logo.svg',
            badge: '/karra-logo.svg',
            tag: `karra-${newItem.category}`,
            data: {
              actionType: newItem.actionType,
              category: newItem.category,
            },
          });
          return newItem;
        }
      }
      // Fallback
      new Notification(newItem.title, {
        body: newItem.message,
        icon: '/karra-logo.svg',
      });
    } catch (err) {
      console.warn('[NotificationService] Browser notification delivery failed:', err);
    }
  }

  return newItem;
}
