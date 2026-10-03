// Karra Service Worker - Push & Notification Manager
// "You don't learn Karra. Karra learns your business."

const CACHE_NAME = 'karra-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push Event: Handle background web push messages from server
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
    // WhatsApp-style rhythmic double-buzz
    vibrate: [150, 80, 150, 80, 250],
    renotify: true,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Message Event: Display native phone notification requested from app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_PHONE_NOTIFICATION') {
    const { title, message, category, actionType, actionLabel } = event.data;
    const options = {
      body: message,
      icon: '/karra-logo.svg',
      badge: '/karra-logo.svg',
      tag: `karra-${category || 'reminder'}-${Date.now()}`,
      data: {
        actionType: actionType || 'CHAT_KARRA',
        category,
        url: '/',
      },
      actions: [
        {
          action: 'open_action',
          title: actionLabel || 'Open Karra',
        },
      ],
      // WhatsApp-style rhythmic buzz
      vibrate: [150, 80, 150, 80, 250],
      renotify: true,
      silent: false,
    };

    event.waitUntil(self.registration.showNotification(title, options));
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
