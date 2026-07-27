import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { Category, StoreSettings } from './types';
import { normalizeProduct } from './productImage';

const configuredApiUrl = Constants.expoConfig?.extra?.apiBaseUrl;
export const API_BASE_URL =
  typeof configuredApiUrl === 'string' && configuredApiUrl.trim()
    ? configuredApiUrl.replace(/\/$/, '')
    : 'https://api.tofahastore.com/api/v1';

const ACCESS_TOKEN_KEY = 'api_access_token';
const REFRESH_TOKEN_KEY = 'api_refresh_token';
const API_USER_KEY = 'api_user';
const CACHE_PREFIX = 'api_cache_';

async function getSecret(key: string): Promise<string | null> {
  return Platform.OS === 'web'
    ? AsyncStorage.getItem(key)
    : SecureStore.getItemAsync(key);
}

async function setSecret(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function deleteSecret(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export interface ApiUser {
  id: string;
  phone: string;
  name?: string | null;
  email?: string | null;
  address?: string | null;
  apartment?: Record<string, unknown> | null;
  role: 'CUSTOMER' | 'ADMIN';
}

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string | string[];
  error?: string;
}

function unwrap<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }
  return payload as T;
}

async function saveSession(session: AuthSession): Promise<void> {
  await Promise.all([
    setSecret(ACCESS_TOKEN_KEY, session.accessToken),
    setSecret(REFRESH_TOKEN_KEY, session.refreshToken),
    AsyncStorage.setItem(API_USER_KEY, JSON.stringify(session.user)),
  ]);
}

export async function getStoredApiUser(): Promise<ApiUser | null> {
  try {
    const raw = await AsyncStorage.getItem(API_USER_KEY);
    return raw ? (JSON.parse(raw) as ApiUser) : null;
  } catch {
    return null;
  }
}

export async function hasApiSession(): Promise<boolean> {
  return Boolean(await getSecret(REFRESH_TOKEN_KEY));
}

export async function clearApiSession(): Promise<void> {
  await Promise.all([
    deleteSecret(ACCESS_TOKEN_KEY),
    deleteSecret(REFRESH_TOKEN_KEY),
    AsyncStorage.removeItem(API_USER_KEY),
  ]);
}

/** Thrown when the refresh token is rejected (user must log in again). */
export class SessionExpiredError extends Error {
  constructor(message = 'انتهت الجلسة، سجّل الدخول من جديد') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = await getSecret(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      // Only wipe tokens when the server rejects the refresh (401/403).
      // 5xx / network-ish failures must keep the session for retry.
      if (response.status === 401 || response.status === 403) {
        await clearApiSession();
      }
      return false;
    }
    const session = unwrap<AuthSession>(await response.json());
    if (!session?.accessToken || !session?.refreshToken) {
      return false;
    }
    await saveSession(session);
    return true;
  } catch {
    // Network / parse errors — keep stored tokens.
    return false;
  }
}

async function apiRequest<T>(
  path: string,
  options: RequestInit & { authenticated?: boolean; retried?: boolean } = {}
): Promise<T> {
  const { authenticated = false, retried = false, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
    ...((fetchOptions.headers as Record<string, string> | undefined) || {}),
  };

  if (authenticated) {
    const accessToken = await getSecret(ACCESS_TOKEN_KEY);
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...fetchOptions, headers });
  } catch {
    throw new Error('تعذر الاتصال بالسيرفر، تحقق من الإنترنت');
  }

  if (response.status === 401 && authenticated && !retried) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, retried: true });
    }
    // Refresh rejected and tokens wiped → definitive logout.
    if (!(await hasApiSession())) {
      throw new SessionExpiredError();
    }
    // Tokens still present (e.g. refresh got 5xx) — temporary failure, keep session.
    throw new Error('تعذر التحقق من الجلسة، حاول لاحقاً');
  }

  const text = await response.text();
  let payload: ApiEnvelope<T> | T | null = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const rawMessage = (payload as ApiEnvelope<T> | null)?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join('\n')
      : rawMessage || (payload as ApiEnvelope<T> | null)?.error;
    if (response.status === 401 && authenticated) {
      // Already retried (or no refresh path) — only expire if tokens were cleared.
      if (!(await hasApiSession())) {
        throw new SessionExpiredError(
          typeof message === 'string' ? message : undefined
        );
      }
      throw new Error(
        typeof message === 'string' ? message : 'تعذر التحقق من الجلسة، حاول لاحقاً'
      );
    }
    if (response.status === 429) {
      throw new Error(
        message && !/too many requests/i.test(message)
          ? message
          : 'تجاوزت الحد المسموح لطلب رمز التحقق. حاول لاحقاً'
      );
    }
    throw new Error(message || `خطأ من السيرفر (${response.status})`);
  }

  return unwrap<T>(payload as ApiEnvelope<T> | T);
}

export async function requestPhoneOtp(phone: string): Promise<{
  phone: string;
  expiresIn: number;
  devCode?: string;
}> {
  return apiRequest('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyPhoneOtp(phone: string, code: string): Promise<ApiUser> {
  const session = await apiRequest<AuthSession>('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
  if (!session?.accessToken || !session?.refreshToken || !session?.user) {
    throw new Error('استجابة تسجيل الدخول غير مكتملة من السيرفر');
  }
  await saveSession(session);
  return session.user;
}

export async function getCurrentUser(): Promise<ApiUser> {
  const user = await apiRequest<ApiUser>('/users/me', { authenticated: true });
  await AsyncStorage.setItem(API_USER_KEY, JSON.stringify(user));
  return user;
}

export async function updateMyApiProfile(input: {
  name?: string;
  address?: string;
  email?: string;
  apartment?: Record<string, unknown>;
}): Promise<ApiUser> {
  const user = await apiRequest<ApiUser>('/users/me', {
    method: 'PATCH',
    authenticated: true,
    body: JSON.stringify(input),
  });
  await AsyncStorage.setItem(API_USER_KEY, JSON.stringify(user));
  return user;
}

export async function logoutApi(): Promise<void> {
  const refreshToken = await getSecret(REFRESH_TOKEN_KEY);
  if (refreshToken) {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Local logout must still complete.
    }
  }
  await clearApiSession();
}

function adaptCatalogItem(collection: string, raw: any): any {
  if (collection === 'products') {
    return normalizeProduct({
      ...raw,
      desc: raw.description ?? raw.desc,
      category:
        typeof raw.category === 'object' ? raw.category?.name || '' : raw.category || '',
      price: Number(raw.price) || 0,
      originalPrice:
        raw.originalPrice == null ? undefined : Number(raw.originalPrice),
    });
  }
  return raw;
}

export async function fetchApiCollection(collection: string): Promise<any[]> {
  const allowed = ['categories', 'products', 'banners', 'offers'];
  if (!allowed.includes(collection)) throw new Error('مجموعة غير مدعومة');
  const rows = await apiRequest<any[]>(`/${collection}`);
  return (rows || []).map((row) => adaptCatalogItem(collection, row));
}

export async function fetchApiCollectionCached(
  collection: string,
  force = false
): Promise<{ data: any[] }> {
  const key = `${CACHE_PREFIX}${collection}`;
  try {
    const data = await fetchApiCollection(collection);
    await AsyncStorage.setItem(key, JSON.stringify(data));
    return { data };
  } catch (error) {
    if (!force) {
      const cached = await readApiCachedCollection(collection);
      if (cached) return { data: cached };
    }
    throw error;
  }
}

export async function readApiCachedCollection(collection: string): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${collection}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearApiCatalogCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
  if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
}

export async function fetchApiCatalogVersion(): Promise<string | null> {
  try {
    const result = await apiRequest<{ updatedAt?: string }>('/settings/catalog-version');
    return result?.updatedAt || null;
  } catch {
    return null;
  }
}

export async function fetchApiStoreSettings(): Promise<StoreSettings> {
  return apiRequest<StoreSettings>('/settings/store');
}

function adaptOrder(raw: any): any {
  return {
    ...raw,
    total: Number(raw.total) || 0,
    totalDiscount: Number(raw.totalDiscount) || 0,
    status: String(raw.status || 'PENDING').toLowerCase(),
  };
}

export async function createApiOrder(body: Record<string, unknown>): Promise<any> {
  const order = await apiRequest<any>('/orders', {
    method: 'POST',
    authenticated: true,
    body: JSON.stringify(body),
  });
  return adaptOrder(order);
}

export async function fetchMyApiOrders(): Promise<any[]> {
  const rows = await apiRequest<any[]>('/orders/mine', { authenticated: true });
  return (rows || []).map(adaptOrder);
}

export async function fetchMyApiNotifications(): Promise<any[]> {
  const rows = await apiRequest<any[]>('/notifications/mine', { authenticated: true });
  return (rows || []).map((row) => ({
    ...row,
    status: row.status ? String(row.status).toLowerCase() : undefined,
  }));
}

export async function markApiNotificationRead(id: string): Promise<void> {
  await apiRequest(`/notifications/${id}/read`, {
    method: 'PATCH',
    authenticated: true,
  });
}

export async function registerApiPushToken(input: {
  token: string;
  phone?: string | null;
  platform?: string;
}): Promise<void> {
  await apiRequest('/notifications/push-token', {
    method: 'POST',
    authenticated: true,
    body: JSON.stringify({
      token: input.token,
      phone: input.phone || undefined,
      platform: input.platform,
    }),
  });
}

export type { Category };
