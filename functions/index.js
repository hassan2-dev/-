const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');

initializeApp();

/**
 * إشعارات الأدمن تُرسل عبر Web Push API (notify-order) من تطبيق الزبون.
 * هذه الدوال معطّلة لتجنّب تكرار الإشعار 2–3 مرات لنفس الطلب.
 */
exports.notifyAdminOnNewOrder = onDocumentCreated('orders/{orderId}', async () => {
  return null;
});

exports.notifyAdminOnOrderUpdate = onDocumentUpdated('orders/{orderId}', async () => {
  return null;
});
