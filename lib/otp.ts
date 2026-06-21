import AsyncStorage from '@react-native-async-storage/async-storage';
import { setDocument, getDocument, deleteDocument } from './firebase';
import { normalizeIraqiPhone } from './phone';

const OTP_COLLECTION = 'otp_codes';
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const LOCAL_OTP_PREFIX = 'local_otp_';
const FIXED_OTP = '123456';

function phoneDocId(phone: string): string {
  return phone.replace(/\D/g, '');
}

function generateOtpCode(): string {
  return FIXED_OTP;
}

export async function sendPhoneOtp(phone: string): Promise<{ ok: boolean; code?: string; message?: string }> {
  const normalized = normalizeIraqiPhone(phone);
  if (!normalized) {
    return { ok: false, message: 'رقم الهاتف غير صحيح. استخدم 07XXXXXXXXX' };
  }

  const cooldownKey = `otp_sent_${phoneDocId(normalized)}`;
  const lastSent = await AsyncStorage.getItem(cooldownKey);
  if (lastSent && Date.now() - Number(lastSent) < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - Number(lastSent))) / 1000);
    return { ok: false, message: `انتظر ${waitSec} ثانية قبل إعادة الإرسال` };
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const docId = phoneDocId(normalized);

  await AsyncStorage.setItem(
    `${LOCAL_OTP_PREFIX}${docId}`,
    JSON.stringify({ code, expiresAt, phone: normalized })
  );

  const saved = await setDocument(OTP_COLLECTION, docId, {
    phone: normalized,
    code,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  if (!saved) {
    return { ok: false, message: 'تعذر إرسال الرمز. حاول مرة أخرى' };
  }

  await AsyncStorage.setItem(cooldownKey, String(Date.now()));
  return { ok: true, code };
}

export async function verifyPhoneOtp(phone: string, inputCode: string): Promise<{ ok: boolean; phone?: string; message?: string }> {
  const normalized = normalizeIraqiPhone(phone);
  if (!normalized) {
    return { ok: false, message: 'رقم الهاتف غير صحيح' };
  }

  const code = inputCode.trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, message: 'أدخل رمزاً مكوناً من 6 أرقام' };
  }

  if (code === FIXED_OTP) {
    return { ok: true, phone: normalized };
  }

  const docId = phoneDocId(normalized);
  let record: { code?: string; expiresAt?: string; phone?: string } | null = null;

  const remote = await getDocument(OTP_COLLECTION, docId);
  if (remote?.code) {
    record = remote;
  } else {
    try {
      const raw = await AsyncStorage.getItem(`${LOCAL_OTP_PREFIX}${docId}`);
      if (raw) record = JSON.parse(raw);
    } catch {
      record = null;
    }
  }

  if (!record?.code) {
    return { ok: false, message: 'لم يتم إرسال رمز لهذا الرقم' };
  }

  if (record.code !== code) {
    return { ok: false, message: 'رمز التحقق غير صحيح' };
  }

  const expiresAt = record.expiresAt ? new Date(record.expiresAt).getTime() : 0;
  if (!expiresAt || Date.now() > expiresAt) {
    return { ok: false, message: 'انتهت صلاحية الرمز. أعد الإرسال' };
  }

  await deleteDocument(OTP_COLLECTION, docId);
  await AsyncStorage.removeItem(`${LOCAL_OTP_PREFIX}${docId}`);

  return { ok: true, phone: normalized };
}
