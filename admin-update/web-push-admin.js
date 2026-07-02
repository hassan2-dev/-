import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { WEB_PUSH_VAPID_PUBLIC_KEY } from './firebase-config.js';

let webPushReady = false;

export function isWebPushReady() {
  return webPushReady;
}

export function isStandalonePwa() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
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

async function clearConflictingServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((reg) => {
        const url = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
        return url.includes('firebase-messaging-sw');
      })
      .map((reg) => reg.unregister())
  );
}

export function describeWebPushFailure(result) {
  switch (result?.reason) {
    case 'unsupported':
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && !isStandalonePwa()) {
        return 'على الآيفون: ثبّت التطبيق (PWA) من زر «تثبيت» ثم افتحه من الشاشة الرئيسية وفعّل الإشعارات';
      }
      return 'المتصفح ما يدعم Web Push — استخدم Chrome على Android أو Edge على Windows';
    case 'missing_vapid':
      return 'مفاتيح VAPID ناقصة في الإعدادات';
    case 'denied':
      return 'اسمح بالإشعارات من إعدادات المتصفح ثم جرّب مرة ثانية';
    case 'no_notification_api':
      return 'هذا المتصفح لا يدعم إشعارات النظام';
    case 'error':
      if (result.detail?.includes('permission') || result.detail?.includes('denied')) {
        return 'تم رفض الإشعارات — فعّلها من إعدادات المتصفح';
      }
      if (result.detail?.includes('insufficient permissions')) {
        return 'صلاحيات Firebase ناقصة — أضف قاعدة كتابة لـ admin_push_subscriptions';
      }
      return result.detail || 'تعذر تفعيل الإشعارات';
    default:
      return result?.detail || 'تعذر تفعيل الإشعارات';
  }
}

export async function initWebPush(db) {
  webPushReady = false;

  if (!window.isSecureContext) {
    return { ok: false, reason: 'error', detail: 'Web Push يحتاج HTTPS' };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' };
  }

  if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && !isStandalonePwa()) {
    return { ok: false, reason: 'unsupported' };
  }

  if (!WEB_PUSH_VAPID_PUBLIC_KEY) {
    return { ok: false, reason: 'missing_vapid' };
  }

  if (!('Notification' in window)) {
    return { ok: false, reason: 'no_notification_api' };
  }

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      return { ok: false, reason: 'denied' };
    }

    await clearConflictingServiceWorkers();

    const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
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
