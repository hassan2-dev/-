self.addEventListener('install', (event) => {
  const CACHE = 'tufaha-admin-v1';
  const SHELL = ['/', '/index.html', '/admin.css', '/manifest.webmanifest', '/assets/icon.png'];
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'تفاحة — طلب جديد';
  const body = payload.body || 'راجع لوحة الإدارة';
  const icon = payload.icon || '/assets/icon.png';
  const orderId = payload.data?.orderId || '';
  const tag = orderId ? `tufaha-new-${orderId}` : 'tufaha-admin';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const dashboardVisible = clientList.some(
        (client) =>
          client.visibilityState === 'visible' &&
          client.url &&
          new URL(client.url).origin === self.location.origin
      );
      if (dashboardVisible) return;

      return self.registration.showNotification(title, {
        body,
        icon,
        badge: icon,
        data: payload.data || {},
        tag,
        renotify: false,
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
      return undefined;
    })
  );
});
