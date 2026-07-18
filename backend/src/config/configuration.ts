export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '30d',
  },
  otp: {
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
    expiresSeconds: parseInt(process.env.OTP_EXPIRES_SECONDS || '300', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
    devMode: process.env.OTP_DEV_MODE === 'true',
    devCode: process.env.OTP_DEV_CODE || '123456',
  },
  sms: {
    provider: process.env.SMS_PROVIDER || 'console',
    httpUrl: process.env.SMS_HTTP_URL,
    httpApiKey: process.env.SMS_HTTP_API_KEY,
    senderName: process.env.SMS_SENDER_NAME || 'Tofaha',
  },
  otpiq: {
    apiKey: process.env.OTPIQ_API_KEY,
    provider: process.env.OTPIQ_PROVIDER || 'whatsapp-sms',
    templateName: process.env.OTPIQ_TEMPLATE_NAME,
    whatsappAccountId: process.env.OTPIQ_WHATSAPP_ACCOUNT_ID,
    whatsappPhoneId: process.env.OTPIQ_WHATSAPP_PHONE_ID,
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET || 'tofaha',
    publicUrl: process.env.R2_PUBLIC_URL,
    endpoint: process.env.R2_ENDPOINT,
  },
  adminPhones: (process.env.ADMIN_PHONES || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),
  adminLogin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || '',
  },
  // Fixed account for Apple App Review only: logs in with a static OTP,
  // never sends a real SMS. All other phones use the real OTP flow.
  reviewAccount: {
    phone: process.env.REVIEW_PHONE || '07800000000',
    code: process.env.REVIEW_OTP_CODE || '123456',
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL_MS || '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },
});
