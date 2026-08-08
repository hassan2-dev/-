/**
 * إشعار تحديث التطبيق عبر Nest API (Postgres tokens + Expo Push).
 * عند الضغط يفتح App Store / Play Store.
 *
 * الاستخدام:
 *   set ADMIN_USERNAME=admin
 *   set ADMIN_PASSWORD=...
 *   npm run notify:iphone
 *   npm run notify:iphone:dry
 *
 * اختياري: API_BASE=https://api.tofahastore.com/api/v1
 */

const API_BASE =
  process.env.API_BASE ||
  process.env.TOFAHA_API_BASE ||
  'https://api.tofahastore.com/api/v1';

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

function printHelp() {
  console.log(`
إشعار تحديث التطبيق عبر Nest (مع رابط المتجر)

الاستخدام:
  set ADMIN_USERNAME=admin
  set ADMIN_PASSWORD=كلمة_السر
  npm run notify:iphone
  npm run notify:iphone:dry

متغيرات البيئة:
  API_BASE          افتراضي: ${API_BASE}
  ADMIN_USERNAME    مطلوب للإرسال
  ADMIN_PASSWORD    مطلوب للإرسال
`);
}

async function adminLogin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || '';
  if (!password) {
    throw new Error(
      'ضع ADMIN_PASSWORD في البيئة ثم أعد التشغيل (حساب أدمن Nest).',
    );
  }

  const res = await fetch(`${API_BASE}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `فشل تسجيل دخول الأدمن (${res.status}): ${json?.message || JSON.stringify(json)}`,
    );
  }
  const data = json?.data ?? json;
  const token = data?.accessToken;
  if (!token) throw new Error('لم يُرجع السيرفر accessToken');
  return token;
}

async function fetchPushStats(accessToken) {
  const res = await fetch(`${API_BASE}/notifications/push-tokens/stats`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `تعذر قراءة إحصائيات التوكن (${res.status}): ${json?.message || ''}`,
    );
  }
  const data = json?.data ?? json;
  return Number(data?.devices || 0);
}

async function sendBroadcast(accessToken, { title, body, data }) {
  const res = await fetch(`${API_BASE}/notifications/broadcast`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ title, body, data }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `فشل البث (${res.status}): ${json?.message || JSON.stringify(json)}`,
    );
  }
  return json?.data ?? json;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('--- إشعار تحديث (Nest API + رابط المتجر) ---');
  console.log('API:    ', API_BASE);
  console.log('العنوان:', args.title);
  console.log('النص:   ', args.body);
  console.log('App Store:', args.iosUrl);
  if (args.dryRun) console.log('الوضع:   تجريبي (بدون إرسال)');

  const accessToken = await adminLogin();
  const devices = await fetchPushStats(accessToken);
  console.log(`\nأجهزة مسجّلة (Postgres): ${devices}`);

  if (args.dryRun) {
    console.log('\n[dry-run] تم التخطي — لم يُرسل شيء.');
    return;
  }

  const result = await sendBroadcast(accessToken, {
    title: args.title,
    body: args.body,
    data: {
      type: 'app_update',
      url: args.iosUrl,
      iosStoreUrl: args.iosUrl,
      androidStoreUrl: args.androidUrl,
      openStore: 'true',
    },
  });

  const push = result?.push || {};
  console.log(`تم حفظ الإشعار: ${result?.notification?.id || 'ok'}`);
  console.log(
    `Push: أُرسل إلى ${push.sent ?? 0} من ${push.devices ?? devices} جهاز`,
  );
  if (push.errors > 0) {
    console.log(`تحذير: فشل ${push.errors} جهاز`);
  }
  console.log('\nتم بنجاح.');
}

main().catch((error) => {
  console.error('\nفشل الإرسال:', error.message || error);
  process.exit(1);
});
