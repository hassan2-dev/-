import {
  API_BASE,
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  ADMIN_USER_KEY,
} from './config.js';

function unwrap(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
}

export function getStoredAdmin() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

export function saveSession({ accessToken, refreshToken, user }) {
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (user) localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearSession();
    return false;
  }
  const data = unwrap(await res.json());
  saveSession(data);
  return true;
}

export async function api(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(options.headers || {}),
  };

  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && !options._retried) {
    const ok = await refreshAccessToken();
    if (ok) {
      return api(path, { ...options, _retried: true });
    }
  }

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }

  if (!res.ok) {
    const msg =
      (Array.isArray(json?.message) ? json.message.join(', ') : json?.message) ||
      json?.error ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return unwrap(json);
}

export const AuthApi = {
  requestOtp: (phone) =>
    api('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  verifyOtp: (phone, code) =>
    api('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),
  logout: async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        await api('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch (_) {}
    }
    clearSession();
  },
};

export const CategoriesApi = {
  list: () => api('/categories'),
  create: (body) => api('/categories', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    api(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id) => api(`/categories/${id}`, { method: 'DELETE' }),
};

export const ProductsApi = {
  list: () => api('/products'),
  create: (body) => api('/products', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    api(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id) => api(`/products/${id}`, { method: 'DELETE' }),
};

export const BannersApi = {
  list: () => api('/banners'),
  create: (body) => api('/banners', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id) => api(`/banners/${id}`, { method: 'DELETE' }),
};

export const OffersApi = {
  list: () => api('/offers'),
  create: (body) => api('/offers', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id) => api(`/offers/${id}`, { method: 'DELETE' }),
};

export const OrdersApi = {
  list: (status) =>
    api(status ? `/orders?status=${encodeURIComponent(status)}` : '/orders'),
  updateStatus: (id, status) =>
    api(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export const SettingsApi = {
  getStore: () => api('/settings/store'),
  updateStore: (body) =>
    api('/settings/store', { method: 'PATCH', body: JSON.stringify(body) }),
};

export const NotificationsApi = {
  broadcast: (title, body) =>
    api('/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify({ title, body }),
    }),
};

export async function uploadImageFile(file, folder = 'uploads') {
  const contentType = file.type || 'image/jpeg';
  const filename = file.name || `upload-${Date.now()}.jpg`;
  const presign = await api('/uploads/presign', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType, folder }),
  });

  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error('فشل رفع الصورة إلى R2');
  }
  return presign.publicUrl;
}

/** UI lowercase ↔ API UPPERCASE */
export function toApiStatus(status) {
  return String(status || 'pending').toUpperCase();
}

export function toUiStatus(status) {
  return String(status || 'PENDING').toLowerCase();
}

export function num(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    try {
      return value.toNumber();
    } catch (_) {}
  }
  return Number(value) || 0;
}
