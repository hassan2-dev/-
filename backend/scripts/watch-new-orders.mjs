/**
 * Watch new (pending) orders directly from Firebase Firestore.
 *
 * Usage (from backend/):
 *   node scripts/watch-new-orders.mjs           # keep watching
 *   node scripts/watch-new-orders.mjs --once    # print current pending and exit
 *
 * Env (optional):
 *   FIREBASE_API_KEY / FIREBASE_PROJECT_ID
 *   POLL_MS (default 12000)
 */
const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY || 'AIzaSyAPiiVfmJdGHje0gittK-7yFTYNTQNY6Fk';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'basjfk-58536';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const POLL_MS = Number(process.env.POLL_MS || 12_000);
const ONCE = process.argv.includes('--once');

let cachedToken = '';
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  const json = await res.json();
  if (!res.ok || !json.idToken) {
    throw new Error(`Firebase auth failed: ${json.error?.message || res.status}`);
  }
  cachedToken = json.idToken;
  tokenExpiry = Date.now() + 3500 * 1000;
  return cachedToken;
}

function decodeValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue?.values || []).map(decodeValue);
  if ('mapValue' in v) {
    const out = {};
    for (const [k, val] of Object.entries(v.mapValue?.fields || {})) {
      out[k] = decodeValue(val);
    }
    return out;
  }
  return null;
}

function parseDoc(doc) {
  const id = String(doc.name || '').split('/').pop();
  const data = { id };
  for (const [k, v] of Object.entries(doc.fields || {})) data[k] = decodeValue(v);
  return data;
}

async function fetchPendingOrders() {
  const token = await getToken();
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'orders' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'status' },
            op: 'EQUAL',
            value: { stringValue: 'pending' },
          },
        },
        limit: 200,
      },
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `runQuery HTTP ${res.status}`);
  }
  const rows = [];
  for (const entry of json) {
    if (entry.document) rows.push(parseDoc(entry.document));
  }
  rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return rows;
}

function fmtMoney(n) {
  return `${(Number(n) || 0).toLocaleString('ar-IQ')} د.ع`;
}

function fmtTime(v) {
  if (!v) return '-';
  try {
    return new Date(v).toLocaleString('ar-IQ', { hour12: false });
  } catch {
    return String(v);
  }
}

function printOrder(order, tag = 'NOW') {
  console.log(
    `[${tag}] ${order.id} | ${order.name || 'زبون'} | ${order.phone || '-'} | ${fmtMoney(order.total)} | ${fmtTime(order.createdAt)}`,
  );
  const items = Array.isArray(order.items) ? order.items : [];
  const line = items
    .slice(0, 5)
    .map((it) => `${it?.name || it?.title || '?'}×${it?.qty ?? it?.quantity ?? 1}`)
    .join(' | ');
  if (line) console.log(`         ${line}${items.length > 5 ? ' …' : ''}`);
  if (order.address) console.log(`         ${order.address}`);
}

async function main() {
  console.log(`Firebase project: ${FIREBASE_PROJECT_ID}`);
  console.log('Fetching pending orders from Firestore…\n');

  let known = new Set();
  let ready = false;

  async function tick() {
    const rows = await fetchPendingOrders();
    const ids = new Set(rows.map((o) => o.id));

    if (!ready) {
      console.log(`Baseline: ${rows.length} pending order(s)`);
      for (const o of rows) printOrder(o, 'NOW');
      if (rows.length === 0) console.log('(none)');
      known = ids;
      ready = true;
      if (ONCE) {
        console.log('\nDone (--once).');
        process.exit(0);
      }
      console.log(`\nWatching for NEW orders every ${POLL_MS / 1000}s… (Ctrl+C to stop)\n`);
      return;
    }

    for (const order of rows) {
      if (!known.has(order.id)) {
        console.log('——— طلب جديد ———');
        printOrder(order, 'NEW');
        console.log('');
      }
    }
    known = ids;
  }

  await tick();
  if (!ONCE) {
    setInterval(() => tick().catch((e) => console.error('poll error:', e.message)), POLL_MS);
  }
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
