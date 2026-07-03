const webpush = require('web-push');

const PROJECT_ID = 'basjfk-58536';
const FIRESTORE_API = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAPiiVfmJdGHje0gittK-7yFTYNTQNY6Fk';

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

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

async function handler(req, res) {
  const method = String(req.method || 'GET').toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-notify-secret');

  if (method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      message: 'notify-order API is live — use POST with JSON body and x-notify-secret header',
    });
  }

  if (method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed', method });
  }

  const secret = req.headers['x-notify-secret'];
  if (!process.env.ADMIN_NOTIFY_SECRET || secret !== process.env.ADMIN_NOTIFY_SECRET) {
    return sendJson(res, 401, { ok: false, error: 'unauthorized' });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return sendJson(res, 500, { ok: false, error: 'missing_vapid_env' });
  }

  webpush.setVapidDetails('mailto:admin@tofahastore.app', publicKey, privateKey);

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const title = body.title || '📦 طلب جديد';
  const text = body.body || '';
  const data = body.data || {};

  try {
    const subscriptions = await fetchPushSubscriptions();
    if (!subscriptions.length) {
      return sendJson(res, 200, { ok: true, sent: 0, message: 'no_subscriptions' });
    }

    const seenEndpoints = new Set();
    const uniqueSubscriptions = subscriptions.filter((subscription) => {
      const endpoint = subscription?.endpoint;
      if (!endpoint || seenEndpoints.has(endpoint)) return false;
      seenEndpoints.add(endpoint);
      return true;
    });

    const payload = JSON.stringify({
      title,
      body: text,
      icon: '/assets/icon.png',
      data,
    });

    let sent = 0;
    let failed = 0;

    for (const subscription of uniqueSubscriptions) {
      try {
        await webpush.sendNotification(subscription, payload);
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error('[notify-order] push failed', error?.statusCode || error?.message);
      }
    }

    return sendJson(res, 200, { ok: true, sent, failed });
  } catch (error) {
    console.error('[notify-order]', error);
    return sendJson(res, 500, { ok: false, error: error?.message || 'notify_failed' });
  }
}

module.exports = handler;
module.exports.default = handler;
