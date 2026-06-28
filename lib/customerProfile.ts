import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ApartmentSelection,
  buildApartmentCode,
  isApartmentSelectionComplete,
  parseApartmentCode,
} from './apartmentCode';
import { UserProfile } from './types';

export const PROFILE_KEY = 'customer_profile_v1';
export const LEGACY_PROFILE_KEY = 'user_profile';

export async function loadCustomerProfile(): Promise<Partial<UserProfile> | null> {
  try {
    const saved =
      (await AsyncStorage.getItem(PROFILE_KEY)) ||
      (await AsyncStorage.getItem(LEGACY_PROFILE_KEY));
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export async function saveCustomerProfile(profile: Partial<UserProfile>): Promise<void> {
  const existing = (await loadCustomerProfile()) ?? {};
  const merged = { ...existing, ...profile };
  await AsyncStorage.multiSet([
    [PROFILE_KEY, JSON.stringify(merged)],
    [LEGACY_PROFILE_KEY, JSON.stringify(merged)],
  ]);
}

export function resolveApartmentFromProfile(
  profile: Partial<UserProfile> | null
): ApartmentSelection | null {
  if (!profile) return null;
  if (profile.apartment && isApartmentSelectionComplete(profile.apartment)) {
    return profile.apartment;
  }
  if (profile.address) {
    const parsed = parseApartmentCode(profile.address);
    if (parsed && isApartmentSelectionComplete(parsed)) return parsed;
  }
  return null;
}

/** عنوان محفوظ صالح فقط — بدون افتراضات أو بيانات ناقصة */
export function getSavedAddressCode(profile: Partial<UserProfile> | null | undefined): string {
  const apartment = resolveApartmentFromProfile(profile ?? null);
  if (!apartment) return '';
  return buildApartmentCode(apartment);
}

export function hasSavedAddress(profile: Partial<UserProfile> | null | undefined): boolean {
  return getSavedAddressCode(profile) !== '';
}

/** يحفظ موقع الشقة فوراً ويرجع الكود */
export async function persistApartmentSelection(
  apartment: ApartmentSelection,
  extras?: Partial<UserProfile>
): Promise<string> {
  const code = buildApartmentCode(apartment);
  await saveCustomerProfile({
    ...extras,
    address: code,
    apartment,
  });
  return code;
}

export async function persistApartmentIfComplete(
  apartment: Partial<ApartmentSelection>,
  extras?: Partial<UserProfile>
): Promise<string | null> {
  if (!isApartmentSelectionComplete(apartment)) return null;
  return persistApartmentSelection(apartment, extras);
}
