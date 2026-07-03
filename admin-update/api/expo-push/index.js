const PROJECT_ID = 'basjfk-58536';
const FIRESTORE_API = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAPiiVfmJdGHje0gittK-7yFTYNTQNY6Fk';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function parseFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  return null;
}

function parseFirestoreDoc(doc) {
  const fields = doc.fields || {};
  const result = {};
  for (const key of Object.keys(fields)) {
    result[key] = parseFirestoreValue(fields[key]);
  }
  return result;
}

async function fetchAllPushTokens() {
  const tokens = [];
  let pageToken;

  do {
    const params = new URLSearchParams({ pageSize: '300', key: FIREBASE_API_KEY });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(`${FIRESTORE_API}/push_tokens?${params}`);
    if (!response.ok) {
      throw new Error(`firestore_list_failed_${response.status}`);
    }

    const json = await response.json();
    for (const doc of json.documents || []) {
      const data = parseFirestoreDoc(doc);
      if (data.token) tokens.push(data.token);
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  return [...new Set(tokens)];
}

async function sendExpoPushBatch(messages) {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`expo_push_failed_${response.status}`);
  }

  const tickets = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [data];
  const errors = tickets.filter((ticket) => ticket?.status === 'error').length;
  return { sent: messages.length - errors, errors };
}

async function deliverExpoPush({ title, body, tokens, data = {}, channelId = 'orders' }) {
  const uniqueTokens = [...new Set((tokens || []).filter(Boolean))];
  if (!uniqueTokens.length) return { sent: 0, errors: 0, devices: 0 };

  const messages = uniqueTokens.map((to) => ({
    to,
    title,
    body,
    data: data || {},
    sound: 'default',
    channelId,
  }));

  let sent = 0;
  let errors = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const result = await sendExpoPushBatch(chunk);
    sent += result.sent;
    errors += result.errors;
  }

  return { sent, errors, devices: uniqueTokens.length };
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
      message: 'expo-push API — POST with title, body, tokens[] and x-notify-secret',
    });
  }

  if (method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const secret = req.headers['x-notify-secret'];
  const expectedSecret = process.env.ADMIN_NOTIFY_SECRET || 'tufaha_notify_7f3a9c2e';
  if (!secret || secret !== expectedSecret) {
    return sendJson(res, 401, { ok: false, error: 'unauthorized' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const title = String(body.title || '').trim();
  const text = String(body.body || '').trim();
  if (!title || !text) {
    return sendJson(res, 400, { ok: false, error: 'missing_title_or_body' });
  }

  const data = body.data && typeof body.data === 'object' ? body.data : {};
  const channelId = body.channelId === 'general' ? 'general' : 'orders';

  try {
    let tokens = Array.isArray(body.tokens) ? body.tokens.filter(Boolean) : [];
    if (!tokens.length && body.all === true) {
      tokens = await fetchAllPushTokens();
    }

    const result = await deliverExpoPush({
      title,
      body: text,
      tokens,
      data,
      channelId,
    });

    return sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    console.error('[expo-push]', error);
    return sendJson(res, 500, { ok: false, error: error?.message || 'expo_push_failed' });
  }
}

module.exports = handler;
module.exports.default = handler;
