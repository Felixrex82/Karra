// Karra Service Worker - Push & Away Reminder Manager
// "You don't learn Karra. Karra learns your business."

const CACHE_NAME = 'karra-pwa-v3';

// Active scheduled away reminder timers
let awayReminderTimers = new Map();

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Helper function to display native OS/phone system notification
async function showKarraNotification(data) {
  const title = data.title || 'Karra Business Reminder';
  const category = data.category || 'REMINDER';
  const actionType = data.actionType || 'CHAT_KARRA';
  const actionLabel = data.actionLabel || 'Tell Karra';

  const options = {
    body: data.message || 'What happened in your business today? Tell Karra and we\'ll keep track.',
    icon: '/karra-logo.svg',
    badge: '/karra-logo.svg',
    tag: `karra-${category}-${Date.now()}`,
    data: {
      actionType,
      category,
      url: '/',
      timestamp: Date.now(),
    },
    actions: [
      {
        action: 'open_action',
        title: actionLabel,
      },
      {
        action: 'dismiss',
        title: 'Later',
      },
    ],
    // WhatsApp signature rhythmic double-buzz
    vibrate: [150, 80, 150, 80, 250],
    renotify: true,
    silent: false,
    requireInteraction: true,
  };

  return self.registration.showNotification(title, options);
}

// Push Event: Handle background web push messages from server
// Delivered when app is closed, device is locked, or merchant is away
self.addEventListener('push', (event) => {
  let data = {
    title: 'Karra Assistant',
    message: 'What’s happening in your business today? Tell Karra and let it keep track for you.',
    category: 'MORNING_REMINDER',
    actionType: 'CHAT_KARRA',
    actionLabel: 'Tell Karra',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.message = event.data.text() || data.message;
    }
  }

  event.waitUntil(showKarraNotification(data));
});

// Message Event: Display native phone notifications or schedule away reminders
self.addEventListener('message', (event) => {
  const payload = event.data;
  if (!payload || !payload.type) return;

  // 1. Schedule an away-from-app reminder
  // Fires only when the user is NOT actively looking at the app
  if (payload.type === 'SCHEDULE_AWAY_REMINDER') {
    const { id = 'default_away', delayMs = 5000, reminder, force = false } = payload;
    if (!reminder) return;

    // Clear existing timer with same ID if present
    if (awayReminderTimers.has(id)) {
      clearTimeout(awayReminderTimers.get(id));
      awayReminderTimers.delete(id);
    }

    const timer = setTimeout(async () => {
      awayReminderTimers.delete(id);

      // Check if user is currently inside and actively viewing the app
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const isUserActiveInApp = clientList.some(
        (c) => c.visibilityState === 'visible' && (c.focused || clientList.length === 1)
      );

      // If user is NOT in the app (or force is true for test triggers), deliver system notification
      if (!isUserActiveInApp || force) {
        await showKarraNotification(reminder);
      }
    }, Math.max(500, delayMs));

    awayReminderTimers.set(id, timer);
  }

  // 2. Cancel pending away reminders (e.g. user returned to app)
  if (payload.type === 'CANCEL_AWAY_REMINDERS') {
    const id = payload.id;
    if (id && awayReminderTimers.has(id)) {
      clearTimeout(awayReminderTimers.get(id));
      awayReminderTimers.delete(id);
    } else if (!id) {
      for (const [, timer] of awayReminderTimers) {
        clearTimeout(timer);
      }
      awayReminderTimers.clear();
    }
  }

  // 3. Immediate or away-only notification request
  if (payload.type === 'SHOW_PHONE_NOTIFICATION') {
    const { title, message, category, actionType, actionLabel, onlyWhenAway } = payload;

    event.waitUntil(
      (async () => {
        if (onlyWhenAway) {
          const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          const isUserActiveInApp = clientList.some(
            (c) => c.visibilityState === 'visible' && c.focused
          );
          if (isUserActiveInApp) {
            return; // Suppress notification if merchant is already in the app
          }
        }
        await showKarraNotification({ title, message, category, actionType, actionLabel });
      })()
    );
  }
});

// Notification Click Event: Focus Karra or open relevant business action
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const actionType = event.notification.data?.actionType || 'CHAT_KARRA';
  const targetUrl = `/?openAction=${encodeURIComponent(actionType)}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and post a message
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'KARRA_NOTIFICATION_ACTION',
            actionType,
          });
          return client.focus();
        }
      }
      // If no window is open, open a new window with the action param
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
