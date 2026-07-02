/** إعدادات Firebase المشتركة للوحة الإدارة */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAPiiVfmJdGHje0gittK-7yFTYNTQNY6Fk',
  authDomain: 'basjfk-58536.firebaseapp.com',
  projectId: 'basjfk-58536',
  storageBucket: 'basjfk-58536.firebasestorage.app',
  messagingSenderId: '662162908373',
  appId: '1:662162908373:web:b5a789fd0b6ca6964e2e5c',
};

/** مفتاح FCM (اختياري — يحتاج Blaze) */
export const FCM_VAPID_KEY = 'BIfg8yUPMzjDGyAZi6jggZfdz2UUJPRtSGUtiSS5WYcGtngYtqsHNkdEQao8TOtpJtWOBhwhPWJtE0E2xulyHpg';

/** Web Push مجاني — المفتاح العام (VAPID) */
export const WEB_PUSH_VAPID_PUBLIC_KEY =
  'BLZFJgxA81ikXPcCs10JhwBqJDrl5ogNXDf_ceGTLUduoI8299US-r0fqa1IRCGItsyaaxEIci7AJKRWAbqPmjE';

/** نفس القيمة في Vercel Environment Variables */
export const ADMIN_NOTIFY_SECRET = 'tufaha_notify_7f3a9c2e';

/** يُحدَّد تلقائياً من عنوان الداشبورد — أو ضعه يدوياً في app.json للتطبيق */
export const ADMIN_NOTIFY_URL = 'https://tufaha-admin.vercel.app/api/notify-order';
