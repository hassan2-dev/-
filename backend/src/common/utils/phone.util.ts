export function normalizeIraqiPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('964') && digits.length >= 12) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return digits;
  }
  if (digits.length === 10 && digits.startsWith('7')) {
    return `0${digits}`;
  }
  return digits;
}

export function isValidIraqiMobile(phone: string): boolean {
  const normalized = normalizeIraqiPhone(phone);
  return /^07[3-9]\d{8}$/.test(normalized);
}
