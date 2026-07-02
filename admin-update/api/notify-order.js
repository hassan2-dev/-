const webpush = require('web-push');

const PROJECT_ID = 'basjfk-58536';
const FIRESTORE_API = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAPiiVfmJdGHje0gittK-7yFTYNTQNY6Fk';

async function fetchPushSubscriptions() {
  const response = await fetch(`${FIRESTORE_API}/admin_push_subscriptions?key=${FIREBASE_API_KEY}`);
  if (!response.ok) {
    throw new Error(`firestore_list_failed_${response.status}`);
  }

  const data = await response.json();
  const documents = data.documents || [];

  return documents
    .map((docSnap) => {
      const json = docSnap.fields?.subscriptionJson?.stringValue;
      if (!json) return null;
      try {
        return JSON.parse(json);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-notify-secret');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const secret = req.headers['x-notify-secret'];
  if (!process.env.ADMIN_NOTIFY_SECRET || secret !== process.env.ADMIN_NOTIFY_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return res.status(500).json({ ok: false, error: 'missing_vapid_env' });
  }

  webpush.setVapidDetails('mailto:admin@tofahastore.app', publicKey, privateKey);

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const title = body.title || '📦 طلب جديد';
  const text = body.body || '';
  const data = body.data || {};

  try {
    const subscriptions = await fetchPushSubscriptions();
    if (!subscriptions.length) {
      return res.json({ ok: true, sent: 0, message: 'no_subscriptions' });
    }

    const payload = JSON.stringify({
      title,
      body: text,
      icon: '/assets/icon.png',
      data,
    });

    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(subscription, payload);
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error('[notify-order] push failed', error?.statusCode || error?.message);
      }
    }

    return res.json({ ok: true, sent, failed });
  } catch (error) {
    console.error('[notify-order]', error);
    return res.status(500).json({ ok: false, error: error?.message || 'notify_failed' });
  }
};
