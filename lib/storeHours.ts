import { StoreSettings } from './types';

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  openTime: '08:30',
  closeTime: '02:00',
  timezone: 'Asia/Baghdad',
  enabled: true,
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function getBaghdadTimeParts(now = new Date()): { hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Baghdad',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hours = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minutes = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { hours, minutes };
}

export function getMinutesInBaghdad(now = new Date()): number {
  const { hours, minutes } = getBaghdadTimeParts(now);
  return hours * 60 + minutes;
}

export function isTimeWithinStoreHours(
  settings: StoreSettings,
  minutes: number
): boolean {
  const open = timeToMinutes(settings.openTime);
  const close = timeToMinutes(settings.closeTime);
  if (open === close) return true;
  if (open < close) {
    return minutes >= open && minutes < close;
  }
  return minutes >= open || minutes < close;
}

export function isStoreOpen(
  settings: StoreSettings = DEFAULT_STORE_SETTINGS,
  now = new Date()
): boolean {
  if (!settings.enabled) return true;
  return isTimeWithinStoreHours(settings, getMinutesInBaghdad(now));
}

export function formatTimeArabic(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h)) return time;
  const suffix = h >= 12 ? 'مساءً' : 'صباحاً';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function getNextOpenMessage(settings: StoreSettings = DEFAULT_STORE_SETTINGS): string {
  if (!settings.enabled) return '';
  if (isStoreOpen(settings)) return '';
  return `يفتح ${formatTimeArabic(settings.openTime)} — ${formatTimeArabic(settings.closeTime)}`;
}

export function getStoreHoursLabel(settings: StoreSettings = DEFAULT_STORE_SETTINGS): string {
  return `${formatTimeArabic(settings.openTime)} إلى ${formatTimeArabic(settings.closeTime)}`;
}

export function isScheduledTimeValid(
  settings: StoreSettings,
  scheduledAt: Date
): boolean {
  if (scheduledAt.getTime() <= Date.now() + 15 * 60 * 1000) {
    return false;
  }
  const minutes = getMinutesInBaghdad(scheduledAt);
  return isTimeWithinStoreHours(settings, minutes);
}

export function baghdadDateTimeToISO(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h - 3, min, 0)).toISOString();
}

export function getUpcomingBaghdadDates(count = 7): { label: string; value: string }[] {
  const result: { label: string; value: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.now() + i * 86400000);
    const value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad' }).format(d);
    const label = new Intl.DateTimeFormat('ar-IQ', {
      timeZone: 'Asia/Baghdad',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(d);
    result.push({ label, value });
  }
  return result;
}

export function getScheduleTimeSlots(
  settings: StoreSettings = DEFAULT_STORE_SETTINGS,
  intervalMinutes = 30
): string[] {
  const open = timeToMinutes(settings.openTime);
  const close = timeToMinutes(settings.closeTime);
  const slots: string[] = [];
  const dayMinutes = 24 * 60;

  const addSlot = (minutes: number) => {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  if (open === close) {
    for (let t = 0; t < dayMinutes; t += intervalMinutes) addSlot(t);
    return slots;
  }

  if (open < close) {
    for (let t = open; t < close; t += intervalMinutes) addSlot(t);
    return slots;
  }

  for (let t = open; t < dayMinutes; t += intervalMinutes) addSlot(t);
  for (let t = 0; t < close; t += intervalMinutes) addSlot(t);
  return slots;
}

export function formatScheduledArabic(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar-IQ', {
      timeZone: 'Asia/Baghdad',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function parseStoreSettings(raw: Record<string, unknown> | null | undefined): StoreSettings {
  if (!raw) return DEFAULT_STORE_SETTINGS;
  return {
    openTime: String(raw.openTime || DEFAULT_STORE_SETTINGS.openTime),
    closeTime: String(raw.closeTime || DEFAULT_STORE_SETTINGS.closeTime),
    timezone: String(raw.timezone || DEFAULT_STORE_SETTINGS.timezone),
    enabled: raw.enabled !== false,
  };
}
