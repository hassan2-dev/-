import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY = 'AIzaSyAPiiVfmJdGHje0gittK-7yFTYNTQNY6Fk';
const PROJECT_ID = 'basjfk-58536';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_BASE = 'https://identitytoolkit.googleapis.com/v1';

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const refreshToken = await AsyncStorage.getItem('firebase_refresh_token');
    if (refreshToken) {
      try {
        const res = await fetch(
          `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }),
          }
        );
        const data = await res.json();
        if (res.ok && data.id_token) {
          cachedToken = data.id_token;
          tokenExpiry = Date.now() + 3500 * 1000;
          await AsyncStorage.setItem('firebase_refresh_token', data.refresh_token);
          return cachedToken!;
        }
      } catch (e) {
        // Refresh failed, sign in again
      }
    }

    const res = await fetch(
      `${AUTH_BASE}/accounts:signUp?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnSecureToken: true }),
      }
    );
    const data = await res.json();
    if (res.ok) {
      cachedToken = data.idToken;
      tokenExpiry = Date.now() + 3500 * 1000;
      if (data.refreshToken) {
        await AsyncStorage.setItem('firebase_refresh_token', data.refreshToken);
      }
      return cachedToken!;
    }
    return '';
  } catch (error) {
    console.error('Auth error:', error);
    return '';
  }
}

function parseFirestoreValue(value: any): any {
  if (value === undefined || value === null) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(parseFirestoreValue);
  }
  if ('mapValue' in value) {
    const result: any = {};
    const fields = value.mapValue.fields || {};
    for (const key of Object.keys(fields)) {
      result[key] = parseFirestoreValue(fields[key]);
    }
    return result;
  }
  return null;
}

function parseFirestoreDoc(doc: any): any {
  const fields = doc.fields || {};
  const result: any = {};
  for (const key of Object.keys(fields)) {
    result[key] = parseFirestoreValue(fields[key]);
  }
  const nameParts = doc.name.split('/');
  result.id = nameParts[nameParts.length - 1];
  return result;
}

function toFirestoreValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    const fields: any = {};
    for (const key of Object.keys(value)) {
      fields[key] = toFirestoreValue(value[key]);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

export async function fetchCollection(collectionName: string): Promise<any[]> {
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const allDocs: any[] = [];
    let pageToken: string | undefined = undefined;
    const pageSize = 300;

    do {
      const params = new URLSearchParams({ pageSize: String(pageSize) });
      if (pageToken) params.append('pageToken', pageToken);
      const url = `${FIRESTORE_BASE}/${collectionName}?${params.toString()}`;

      let res = await fetch(url, { headers });

      if (!res.ok && (res.status === 401 || res.status === 403)) {
        res = await fetch(url);
      }

      if (!res.ok) {
        console.error(`Fetch ${collectionName} failed: ${res.status}`);
        break;
      }

      const json = await res.json();
      const documents = json.documents || [];
      for (const d of documents) allDocs.push(parseFirestoreDoc(d));
      pageToken = json.nextPageToken;
    } while (pageToken);

    return allDocs;
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return [];
  }
}

export async function fetchNotificationsForPhone(phone: string): Promise<any[]> {
  if (!phone?.trim()) return [];
  const normalized = phone.trim();
  try {
    const all = await fetchCollection('notifications');
    return all
      .filter((n) => String(n.phone || '').trim() === normalized)
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
  } catch {
    return [];
  }
}

export async function setDocument(collectionName: string, docId: string, data: any): Promise<boolean> {
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const fields: any = {};
    for (const key of Object.keys(data)) {
      fields[key] = toFirestoreValue(data[key]);
    }

    const res = await fetch(
      `${FIRESTORE_BASE}/${collectionName}/${encodeURIComponent(docId)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields }),
      }
    );
    return res.ok;
  } catch (error) {
    console.error(`Error setting ${collectionName}/${docId}:`, error);
    return false;
  }
}

export async function getDocument(collectionName: string, docId: string): Promise<any | null> {
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(
      `${FIRESTORE_BASE}/${collectionName}/${encodeURIComponent(docId)}?alt=json`,
      { headers }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return parseFirestoreDoc(json);
  } catch (error) {
    console.error(`Error getting ${collectionName}/${docId}:`, error);
    return null;
  }
}

export async function deleteDocument(collectionName: string, docId: string): Promise<void> {
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch(
      `${FIRESTORE_BASE}/${collectionName}/${encodeURIComponent(docId)}`,
      { method: 'DELETE', headers }
    );
  } catch (error) {
    console.error(`Error deleting ${collectionName}/${docId}:`, error);
  }
}

export async function addDocument(collectionName: string, data: any): Promise<boolean> {
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const fields: any = {};
    for (const key of Object.keys(data)) {
      if (key === 'createdAt') {
        fields[key] = { timestampValue: new Date().toISOString() };
      } else {
        fields[key] = toFirestoreValue(data[key]);
      }
    }

    const res = await fetch(
      `${FIRESTORE_BASE}/${collectionName}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ fields }),
      }
    );
    return res.ok;
  } catch (error) {
    console.error(`Error adding to ${collectionName}:`, error);
    return false;
  }
}

export async function signInWithGoogleToken(googleIdToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${AUTH_BASE}/accounts:signInWithIdp?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postBody: `id_token=${googleIdToken}&providerId=google.com`,
          requestUri: 'http://localhost',
          returnSecureToken: true,
          returnIdpCredential: true,
        }),
      }
    );
    const data = await res.json();
    if (res.ok && data.idToken) {
      cachedToken = data.idToken;
      tokenExpiry = Date.now() + 3500 * 1000;
      if (data.refreshToken) {
        await AsyncStorage.setItem('firebase_refresh_token', data.refreshToken);
      }
      return true;
    }
    console.error('Firebase signInWithIdp failed:', JSON.stringify(data));
    return false;
  } catch (error) {
    console.error('Firebase Google sign-in error:', error);
    return false;
  }
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHED_COLLECTIONS = ['categories', 'products', 'banners', 'offers'];
const RETRY_COOLDOWN_MS = 30 * 1000;
const CACHE_SCHEMA_VERSION = '2';
const lastFailureAt: Record<string, number> = {};

async function fetchCollectionWithStatus(collectionName: string): Promise<{ data: any[]; ok: boolean }> {
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const allDocs: any[] = [];
    let pageToken: string | undefined = undefined;
    const pageSize = 300;
    let ok = true;

    do {
      const params = new URLSearchParams({ pageSize: String(pageSize) });
      if (pageToken) params.append('pageToken', pageToken);
      const url = `${FIRESTORE_BASE}/${collectionName}?${params.toString()}`;

      // Retry on 429 with exponential backoff
      let res: Response | null = null;
      const backoffs = [0, 800, 1800, 3500];
      for (let i = 0; i < backoffs.length; i++) {
        if (backoffs[i] > 0) await new Promise(r => setTimeout(r, backoffs[i]));
        res = await fetch(url, { headers });
        if (res.ok) break;
        if (res.status === 401 || res.status === 403) {
          res = await fetch(url);
          if (res.ok) break;
        }
        if (res.status !== 429) break; // only retry on rate limit
      }

      if (!res || !res.ok) {
        console.error(`Fetch ${collectionName} failed: ${res?.status ?? 'no-response'}`);
        ok = false;
        break;
      }

      const json = await res.json();
      const documents = json.documents || [];
      for (const d of documents) allDocs.push(parseFirestoreDoc(d));
      pageToken = json.nextPageToken;
    } while (pageToken);

    return { data: allDocs, ok };
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return { data: [], ok: false };
  }
}

export async function fetchCollectionCached(
  collectionName: string,
  ttlMs: number = CACHE_TTL_MS
): Promise<{ data: any[]; fromCache: boolean }> {
  const dataKey = `cache_${collectionName}`;
  const tsKey = `cache_ts_${collectionName}`;
  const versionKey = `cache_v_${collectionName}`;

  // One-time migration: if old cache exists with wrong/no version, drop it
  try {
    const v = await AsyncStorage.getItem(versionKey);
    if (v !== CACHE_SCHEMA_VERSION) {
      await AsyncStorage.removeItem(dataKey);
      await AsyncStorage.removeItem(tsKey);
      await AsyncStorage.setItem(versionKey, CACHE_SCHEMA_VERSION);
    }
  } catch (e) {}

  // Read existing cache as a real array
  let cachedData: any[] = [];
  try {
    const raw = await AsyncStorage.getItem(dataKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) cachedData = parsed;
    }
  } catch (e) {}

  let cacheTs = 0;
  try {
    const ts = await AsyncStorage.getItem(tsKey);
    if (ts) cacheTs = Number(ts) || 0;
  } catch (e) {}

  const cacheFresh = cacheTs > 0 && Date.now() - cacheTs < ttlMs;

  // Only trust cache if it actually has content AND is fresh
  if (cachedData.length > 0 && cacheFresh) {
    return { data: cachedData, fromCache: true };
  }

  // If we just failed AND we have a usable cache, avoid hammering the server
  const lastFail = lastFailureAt[collectionName] || 0;
  if (Date.now() - lastFail < RETRY_COOLDOWN_MS && cachedData.length > 0) {
    return { data: cachedData, fromCache: true };
  }

  // Try fresh fetch
  const { data: fresh, ok } = await fetchCollectionWithStatus(collectionName);

  if (!ok) {
    // Network/HTTP failure (e.g. 429): never blank a good cache, never poison cache with [].
    lastFailureAt[collectionName] = Date.now();
    return { data: cachedData, fromCache: true };
  }

  // Server says empty but we have cache: keep cache (do not blank UI on transient anomalies)
  if (fresh.length === 0 && cachedData.length > 0) {
    return { data: cachedData, fromCache: true };
  }

  // Only write to cache when we actually have content
  if (fresh.length > 0) {
    try {
      await AsyncStorage.setItem(dataKey, JSON.stringify(fresh));
      await AsyncStorage.setItem(tsKey, String(Date.now()));
    } catch (e) {}
  }

  return { data: fresh, fromCache: false };
}

export async function clearCollectionCache(collectionName?: string): Promise<void> {
  try {
    const targets = collectionName ? [collectionName] : CACHED_COLLECTIONS;
    for (const name of targets) {
      await AsyncStorage.removeItem(`cache_${name}`);
      await AsyncStorage.removeItem(`cache_ts_${name}`);
    }
    if (!collectionName) {
      await AsyncStorage.removeItem('data_version');
    }
  } catch (e) {}
}

/** جلب مباشر من السيرفر؛ الكاش احتياطي فقط عند فشل الشبكة */
export async function fetchCollectionFresh(
  collectionName: string
): Promise<{ data: any[]; fromCache: boolean }> {
  const dataKey = `cache_${collectionName}`;
  const tsKey = `cache_ts_${collectionName}`;

  const { data: fresh, ok } = await fetchCollectionWithStatus(collectionName);

  if (ok) {
    if (fresh.length > 0) {
      try {
        await AsyncStorage.setItem(dataKey, JSON.stringify(fresh));
        await AsyncStorage.setItem(tsKey, String(Date.now()));
      } catch (e) {}
    }
    return { data: fresh, fromCache: false };
  }

  const cached = await readCachedCollection(collectionName);
  return { data: cached || [], fromCache: true };
}

export async function fetchServerVersion(): Promise<string | null> {
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${FIRESTORE_BASE}/meta/version?alt=json`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    const rawVersion = json?.fields?.updatedAt;
    const version = parseFirestoreValue(rawVersion);
    return version !== null && version !== undefined ? String(version) : null;
  } catch (e) {
    console.error('fetchServerVersion failed', e);
  }
  return null;
}

export async function readCachedCollection(collectionName: string): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`cache_${collectionName}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

// ============================================================
// Incremental Sync (read-efficient)
// ============================================================

async function runQueryWithFilter(
  collectionId: string,
  fieldPath: string,
  op: string,
  timestampMs: number
): Promise<{ data: any[]; ok: boolean; status: number }> {
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const body = {
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op,
            value: { timestampValue: new Date(timestampMs).toISOString() },
          },
        },
      },
    };

    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

    let res: Response | null = null;
    const backoffs = [0, 800, 1800, 3500];
    for (let i = 0; i < backoffs.length; i++) {
      if (backoffs[i] > 0) await new Promise((r) => setTimeout(r, backoffs[i]));
      res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (res.ok) break;
      if (res.status !== 429) break;
    }

    if (!res || !res.ok) {
      return { data: [], ok: false, status: res?.status ?? 0 };
    }

    const json = await res.json();
    const docs: any[] = [];
    if (Array.isArray(json)) {
      for (const r of json) {
        if (r && r.document) docs.push(parseFirestoreDoc(r.document));
      }
    }
    return { data: docs, ok: true, status: 200 };
  } catch (e) {
    console.error('runQueryWithFilter error', collectionId, e);
    return { data: [], ok: false, status: 0 };
  }
}

/**
 * Fetch only docs whose `updatedAt` changed after `sinceMs`.
 * Requires admin to write `updatedAt: serverTimestamp()` on every save.
 * Returns 0 docs if no `updatedAt` field exists on docs (graceful fallback).
 */
export async function fetchIncrementalUpdates(
  collectionName: string,
  sinceMs: number
): Promise<{ updates: any[]; ok: boolean }> {
  const r = await runQueryWithFilter(collectionName, 'updatedAt', 'GREATER_THAN', sinceMs);
  return { updates: r.data, ok: r.ok };
}

/**
 * Fetch deletion tombstones from `deletions` collection.
 * Each tombstone has shape: { collection: string, docId: string, deletedAt: Timestamp }
 * Requires admin to write a tombstone before deleting.
 */
export async function fetchDeletions(
  sinceMs: number,
  collectionFilter?: string
): Promise<{ deletions: { collection: string; docId: string }[]; ok: boolean }> {
  const r = await runQueryWithFilter('deletions', 'deletedAt', 'GREATER_THAN', sinceMs);
  if (!r.ok) return { deletions: [], ok: false };
  const all = r.data
    .filter((d: any) => d && d.collection && d.docId)
    .map((d: any) => ({ collection: String(d.collection), docId: String(d.docId) }));
  const filtered = collectionFilter
    ? all.filter((d) => d.collection === collectionFilter)
    : all;
  return { deletions: filtered, ok: true };
}

/**
 * Persist incremental sync result for a collection: merge updates and deletions
 * into existing cached array, then save back.
 */
export async function applyIncrementalToCache(
  collectionName: string,
  updates: any[],
  deletedIds: string[]
): Promise<any[]> {
  const existing = (await readCachedCollection(collectionName)) || [];
  const map = new Map<string, any>();
  for (const d of existing) {
    if (d && d.id) map.set(d.id, d);
  }
  for (const u of updates) {
    if (u && u.id) map.set(u.id, u);
  }
  for (const id of deletedIds) {
    map.delete(id);
  }
  const merged = Array.from(map.values());
  try {
    await AsyncStorage.setItem(`cache_${collectionName}`, JSON.stringify(merged));
    await AsyncStorage.setItem(`cache_ts_${collectionName}`, String(Date.now()));
  } catch (e) {}
  return merged;
}