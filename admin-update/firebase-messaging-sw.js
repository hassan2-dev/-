/* eslint-disable no-undef */
importScripts('./firebase-config-sw.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js');

firebase.initializeApp(self.FIREBASE_WEB_CONFIG);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'تفاحة — طلب جديد';
  const body = payload.notification?.body || 'راجع لوحة الإدارة';
  const data = payload.data || {};

  self.registration.showNotification(title, {
    body,
    icon: '/assets/icon.png',
    badge: '/assets/icon.png',
    tag: data.orderId ? `order-${data.orderId}` : 'tufaha-admin',
    data,
    requireInteraction: true,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
      return undefined;
    })
  );
});
