/**
 * إشعار: يتوفر تحديث للتطبيق — عند الضغط يفتح App Store / Play Store.
 * (ليس تحديثاً إجبارياً — فقط إشعار مع رابط)
 *
 * الاستخدام:
 *   npm run notify:iphone
 *   npm run notify:iphone:dry
 *   node scripts/send-iphone-update-broadcast.js --dry-run
 */

const { FIRESTORE_BASE, getAnonymousIdToken } = require('./firebase-auth');
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const IOS_STORE_URL =
  'https://apps.apple.com/us/app/%D9%85%D8%AA%D8%AC%D8%B1-%D8%AA%D9%81%D8%A7%D8%AD%D8%A9/id6763769377';
const ANDROID_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.tofahastore.app';

const DEFAULT_TITLE = 'تحديث جديد لتطبيق تفاحة 🍎';
const DEFAULT_BODY =
  'يتوفر تحديث جديد للتطبيق. اضغط هنا للانتقال إلى المتجر وتحديثه.';

function parseArgs(argv) {
  const args = {
    dryRun: false,
    title: DEFAULT_TITLE,
    body: DEFAULT_BODY,
    iosUrl: IOS_STORE_URL,
    androidUrl: ANDROID_STORE_URL,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--title' && argv[i + 1]) {
      args.title = argv[++i];
    } else if (arg === '--body' && argv[i + 1]) {
      args.body = argv[++i];
    } else if (arg === '--ios-url' && argv[i + 1]) {
      args.iosUrl = argv[++i];
    } else if (arg === '--android-url' && argv[i + 1]) {
      args.androidUrl = argv[++i];
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
      if (data.token) {
        tokens.push({
          token: data.token,
          platform: String(data.platform || '').toLowerCase(),
        });
      }
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  const byToken = new Map();
  for (const row of tokens) {
    byToken.set(row.token, row);
  }
  return [...byToken.values()];
}

async function createBroadcastNotification(title, body, url) {
  const token = await getAnonymousIdToken();
  const fields = {
    phone: toFirestoreValue(''),
    email: toFirestoreValue(''),
    title: toFirestoreValue(title),
    body: toFirestoreValue(body),
    broadcast: toFirestoreValue(true),
    read: toFirestoreValue(false),
    type: toFirestoreValue('app_update'),
    url: toFirestoreValue(url),
    createdAt: { timestampValue: new Date().toISOString() },
  };

  const res = await fetch(`${FIRESTORE_BASE}/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
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

function storeUrlForPlatform(platform, iosUrl, androidUrl) {
  if (platform === 'android') return androidUrl;
  // iOS أو غير معروف → App Store (أغلب الأجهزة عندكم)
  return iosUrl;
}

async function deliverExpoPush({ title, body, devices, iosUrl, androidUrl }) {
  if (!devices.length) return { sent: 0, errors: 0, devices: 0 };

  const messages = devices.map(({ token, platform }) => {
    const url = storeUrlForPlatform(platform, iosUrl, androidUrl);
    return {
      to: token,
      title,
      body,
      data: {
        broadcast: 'true',
        type: 'app_update',
        url,
        iosStoreUrl: iosUrl,
        androidStoreUrl: androidUrl,
      },
      sound: 'default',
      channelId: 'general',
    };
  });

  let sent = 0;
  let errors = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const result = await sendExpoPushBatch(chunk);
    sent += result.sent;
    errors += result.errors;
  }

  return { sent, errors, devices: devices.length };
}

function printHelp() {
  console.log(`
إشعار تحديث التطبيق (مع رابط المتجر — بدون إجبار)

الاستخدام:
  npm run notify:iphone
  npm run notify:iphone:dry

عند ضغط الإشعار يفتح App Store / Play Store.

النص الافتراضي:
  العنوان: ${DEFAULT_TITLE}
  النص:    ${DEFAULT_BODY}
  iOS:     ${IOS_STORE_URL}
`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('--- إشعار تحديث (رابط المتجر) ---');
  console.log('العنوان:', args.title);
  console.log('النص:   ', args.body);
  console.log('App Store:', args.iosUrl);
  console.log('Play Store:', args.androidUrl);
  if (args.dryRun) console.log('الوضع:   تجريبي (بدون إرسال)');

  const devices = await fetchAllPushTokens();
  console.log(`\nأجهزة مسجّلة: ${devices.length}`);

  if (args.dryRun) {
    console.log('\n[dry-run] تم التخطي — لم يُرسل شيء.');
    return;
  }

  // داخل التطبيق: رابط App Store (يفتح من شاشة الإشعارات)
  const notifId = await createBroadcastNotification(
    args.title,
    args.body,
    args.iosUrl,
  );
  console.log(`تم حفظ الإشعار داخل التطبيق: ${notifId}`);

  const pushResult = await deliverExpoPush({
    title: args.title,
    body: args.body,
    devices,
    iosUrl: args.iosUrl,
    androidUrl: args.androidUrl,
  });

  if (pushResult.devices === 0) {
    console.log('\nتم حفظ الإشعار داخل التطبيق — لا توجد أجهزة مسجّلة للـ Push بعد.');
    return;
  }

  console.log(`\nPush: أُرسل إلى ${pushResult.sent} جهاز`);
  if (pushResult.errors > 0) {
    console.log(`تحذير: فشل ${pushResult.errors} جهاز (توكن قديم أو غير صالح)`);
  }
  console.log('\nتم بنجاح — الضغط على الإشعار يفتح المتجر.');
}

main().catch((error) => {
  console.error('\nفشل الإرسال:', error.message || error);
  process.exit(1);
});
