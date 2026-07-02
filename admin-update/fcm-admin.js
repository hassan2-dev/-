import { getMessaging, getToken, onMessage, isSupported } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { FIREBASE_CONFIG, FCM_VAPID_KEY } from './firebase-config.js';

let messagingInstance = null;
let fcmReady = false;

export function isAdminFcmReady() {
  return fcmReady;
}

function tokenDocId(token) {
  return token.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

async function saveAdminFcmToken(db, token) {
  await setDoc(
    doc(db, 'admin_push_tokens', tokenDocId(token)),
    {
      token,
      platform: 'web',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function initAdminFcm(app, db, handlers = {}) {
  fcmReady = false;

  if (!(await isSupported())) {
    console.warn('[FCM] المتصفح لا يدعم Firebase Messaging');
    return { ok: false, reason: 'unsupported' };
  }

  if (!FCM_VAPID_KEY) {
    console.warn('[FCM] أضف FCM_VAPID_KEY في admin-update/firebase-config.js');
    return { ok: false, reason: 'missing_vapid' };
  }

  if (!('Notification' in window)) {
    return { ok: false, reason: 'no_notification_api' };
  }

  try {
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission !== 'granted') {
      return { ok: false, reason: 'denied' };
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    await navigator.serviceWorker.ready;

    messagingInstance = getMessaging(app);
    const token = await getToken(messagingInstance, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return { ok: false, reason: 'no_token' };
    }

    await saveAdminFcmToken(db, token);

    onMessage(messagingInstance, (payload) => {
      const title = payload.notification?.title || 'تفاحة';
      const body = payload.notification?.body || '';
      const type = payload.data?.type === 'order_update' ? 'update' : 'new';
      handlers.onForegroundMessage?.({ title, body, type, data: payload.data || {} });
    });

    fcmReady = true;
    return { ok: true, tokenPreview: token.slice(0, 24) + '...' };
  } catch (error) {
    console.error('[FCM] init failed', error);
    return { ok: false, reason: 'error', detail: error?.message || String(error) };
  }
}
