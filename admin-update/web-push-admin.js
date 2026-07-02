import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { WEB_PUSH_VAPID_PUBLIC_KEY } from './firebase-config.js';

let webPushReady = false;

export function isWebPushReady() {
  return webPushReady;
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function subscriptionDocId(endpoint) {
  return btoa(endpoint).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export async function initWebPush(db) {
  webPushReady = false;

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' };
  }

  if (!WEB_PUSH_VAPID_PUBLIC_KEY) {
    return { ok: false, reason: 'missing_vapid' };
  }

  if (!('Notification' in window)) {
    return { ok: false, reason: 'no_notification_api' };
  }

  try {
    const permission =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();

    if (permission !== 'granted') {
      return { ok: false, reason: 'denied' };
    }

    const swUrl = new URL('./push-sw.js', window.location.href).href;
    const registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_VAPID_PUBLIC_KEY),
      });
    }

    await setDoc(
      doc(db, 'admin_push_subscriptions', subscriptionDocId(subscription.endpoint)),
      {
        subscriptionJson: JSON.stringify(subscription.toJSON()),
        endpoint: subscription.endpoint,
        platform: 'web',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    webPushReady = true;
    console.log('[WebPush] subscription saved');
    return { ok: true };
  } catch (error) {
    console.error('[WebPush] init failed', error);
    webPushReady = false;
    return { ok: false, reason: 'error', detail: error?.message || String(error) };
  }
}
