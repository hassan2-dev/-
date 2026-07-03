/**
 * إرسال إشعار ترحيب لجميع مستخدمي التطبيق (داخل التطبيق + Push).
 *
 * الاستخدام:
 *   node scripts/send-welcome-broadcast.js
 *   node scripts/send-welcome-broadcast.js --title "عنوان" --body "النص"
 *   node scripts/send-welcome-broadcast.js --dry-run
 */

const PROJECT_ID = 'basjfk-58536';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const DEFAULT_TITLE = 'أهلاً بك في متجر تفاحة 🍎';
const DEFAULT_BODY =
  'شكراً لتنزيل التطبيق! تسوّق بسهولة، تابع طلباتك، واستمتع بعروضنا الجديدة.';

function parseArgs(argv) {
  const args = { dryRun: false, title: DEFAULT_TITLE, body: DEFAULT_BODY };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--title' && argv[i + 1]) {
      args.title = argv[++i];
    } else if (arg === '--body' && argv[i + 1]) {
      args.body = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  return args;
}

function parseFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
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

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  return { stringValue: String(value) };
}

async function fetchAllPushTokens() {
  const tokens = [];
  let pageToken;

  do {
    const params = new URLSearchParams({ pageSize: '300' });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${FIRESTORE_BASE}/push_tokens?${params}`);
    if (!res.ok) {
      throw new Error(`تعذر قراءة push_tokens (${res.status})`);
    }

    const json = await res.json();
    for (const doc of json.documents || []) {
      const data = parseFirestoreDoc(doc);
      if (data.token) tokens.push(data.token);
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  return [...new Set(tokens)];
}

async function createBroadcastNotification(title, body) {
  const fields = {
    phone: toFirestoreValue(''),
    email: toFirestoreValue(''),
    title: toFirestoreValue(title),
    body: toFirestoreValue(body),
    broadcast: toFirestoreValue(true),
    read: toFirestoreValue(false),
    createdAt: { timestampValue: new Date().toISOString() },
  };

  const res = await fetch(`${FIRESTORE_BASE}/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`تعذر حفظ الإشعار في Firestore (${res.status}): ${text}`);
  }

  const json = await res.json();
  const nameParts = String(json.name || '').split('/');
  return nameParts[nameParts.length - 1] || 'unknown';
}

async function sendExpoPushBatch(messages) {
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Expo Push API error (${res.status}): ${JSON.stringify(data)}`);
  }

  const tickets = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [data];
  const errors = tickets.filter((ticket) => ticket?.status === 'error').length;
  return { sent: messages.length - errors, errors };
}

async function deliverExpoPush({ title, body, tokens }) {
  const uniqueTokens = [...new Set(tokens.filter(Boolean))];
  if (!uniqueTokens.length) return { sent: 0, errors: 0, devices: 0 };

  const messages = uniqueTokens.map((to) => ({
    to,
    title,
    body,
    data: { broadcast: 'true', type: 'welcome' },
    sound: 'default',
    channelId: 'general',
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

function printHelp() {
  console.log(`
إرسال إشعار ترحيب لجميع مستخدمي التطبيق

الاستخدام:
  node scripts/send-welcome-broadcast.js
  node scripts/send-welcome-broadcast.js --title "عنوان" --body "النص"
  node scripts/send-welcome-broadcast.js --dry-run

الخيارات:
  --title   عنوان الإشعار (افتراضي: ترحيب متجر تفاحة)
  --body    نص الإشعار
  --dry-run يعرض المعلومات بدون إرسال فعلي
`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('--- إشعار ترحيب للجميع ---');
  console.log('العنوان:', args.title);
  console.log('النص:   ', args.body);
  if (args.dryRun) console.log('الوضع:   تجريبي (بدون إرسال)');

  const tokens = await fetchAllPushTokens();
  console.log(`\nأجهزة مسجّلة: ${tokens.length}`);

  if (args.dryRun) {
    console.log('\n[dry-run] تم التخطي — لم يُرسل شيء.');
    return;
  }

  const notifId = await createBroadcastNotification(args.title, args.body);
  console.log(`تم حفظ الإشعار داخل التطبيق: ${notifId}`);

  const pushResult = await deliverExpoPush({
    title: args.title,
    body: args.body,
    tokens,
  });

  if (pushResult.devices === 0) {
    console.log('\nتم حفظ الإشعار داخل التطبيق — لا توجد أجهزة مسجّلة للـ Push بعد.');
    return;
  }

  console.log(`\nPush: أُرسل إلى ${pushResult.sent} جهاز`);
  if (pushResult.errors > 0) {
    console.log(`تحذير: فشل ${pushResult.errors} جهاز (توكن قديم أو غير صالح)`);
  }
  console.log('\nتم بنجاح.');
}

main().catch((error) => {
  console.error('\nفشل الإرسال:', error.message || error);
  process.exit(1);
});
