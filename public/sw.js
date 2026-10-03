// Karra Service Worker - Push & Notification Manager
// "You don't learn Karra. Karra learns your business."

const CACHE_NAME = 'karra-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push Event: Handle background push messages
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

  const options = {
    body: data.message,
    icon: '/karra-logo.svg',
    badge: '/karra-logo.svg',
    tag: `karra-${data.category || 'reminder'}-${Date.now()}`,
    data: {
      actionType: data.actionType || 'CHAT_KARRA',
      category: data.category,
      url: '/',
    },
    actions: [
      {
        action: 'open_action',
        title: data.actionLabel || 'Open Karra',
      },
      {
        action: 'dismiss',
        title: 'Later',
      },
    ],
    vibrate: [100, 50, 100],
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification Click Event: Focus Karra or trigger action
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
