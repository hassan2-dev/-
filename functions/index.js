const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const STATUS_LABELS = {
  pending: 'قيد الانتظار',
  accepted: 'تمت الموافقة',
  preparing: 'قيد التجهيز',
  on_the_way: 'في التوصيل',
};

async function getAdminFcmTokens() {
  const snap = await getFirestore().collection('admin_push_tokens').get();
  const tokens = [];
  snap.forEach((docSnap) => {
    const token = docSnap.data()?.token;
    if (token) tokens.push(token);
  });
  return [...new Set(tokens)];
}

async function notifyAdmins(title, body, data = {}) {
  const tokens = await getAdminFcmTokens();
  if (!tokens.length) return { sent: 0 };

  const stringData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value ?? '')])
  );

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: stringData,
    webpush: {
      notification: {
        icon: '/assets/icon.png',
        badge: '/assets/icon.png',
      },
      fcmOptions: {
        link: '/',
      },
    },
  });

  return { sent: response.successCount, failed: response.failureCount };
}

exports.notifyAdminOnNewOrder = onDocumentCreated('orders/{orderId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const status = data.status || 'pending';
  if (status !== 'pending') return;

  const name = data.name || 'زبون';
  const total = Number(data.total || 0).toLocaleString('ar-IQ');

  await notifyAdmins('📦 طلب جديد', `${name} — ${total} د.ع`, {
    orderId: event.params.orderId,
    type: 'new_order',
  });
});

exports.notifyAdminOnOrderUpdate = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!before || !after) return;
  if (before.status === after.status) return;
  if (after.updatedBy === 'admin') return;

  const name = after.name || 'زبون';
  const prev = STATUS_LABELS[before.status] || before.status || '—';
  const next = STATUS_LABELS[after.status] || after.status || '—';

  await notifyAdmins('🔄 تحديث طلب', `${name}: ${prev} → ${next}`, {
    orderId: event.params.orderId,
    type: 'order_update',
    status: after.status || '',
  });
});
