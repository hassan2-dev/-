export function normalizeIraqiPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('964')) {
    const local = digits.slice(3);
    if (/^7\d{9}$/.test(local)) return `0${local}`;
  }
  if (/^07\d{9}$/.test(digits)) return digits;
  if (/^7\d{9}$/.test(digits)) return `0${digits}`;
  return null;
}

export function isValidIraqiPhone(input: string): boolean {
  return normalizeIraqiPhone(input) !== null;
}
