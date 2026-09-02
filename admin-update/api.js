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
    const err = new Error(
      (Array.isArray(json?.message) ? json.message.join(', ') : json?.message) ||
        json?.error ||
        `HTTP ${res.status}`,
    );
    err.status = res.status;
    err.payload = json?.data ?? json;
    throw err;
  }

  return unwrap(json);
}

function qs(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const AuthApi = {
  adminLogin: (username, password) =>
    api('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  driverLogin: (username, password) =>
    api('/auth/driver/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
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
  listAdminAll: () => api('/categories/admin/all'),
  listAdmin: (params) => api(`/categories/admin${qs(params)}`),
  create: (body) => api('/categories', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    api(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id) => api(`/categories/${id}`, { method: 'DELETE' }),
  bulkDelete: (ids) =>
    api('/categories/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
};

export const ProductsApi = {
  list: () => api('/products'),
  listAdmin: (params) => api(`/products/admin${qs(params)}`),
  exportUrl: (params) => `${API_BASE}/products/export${qs({ format: 'csv', ...params })}`,
  create: (body) => api('/products', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    api(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id) => api(`/products/${id}`, { method: 'DELETE' }),
  bulkDelete: (ids) =>
    api('/products/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
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
  mineDriver: () => api('/orders/mine-driver'),
  updateStatus: (id, status) =>
    api(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  assign: (id, driverId, confirmReassign = false) =>
    api(`/orders/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ driverId, confirmReassign }),
    }),
  resetSales: () => api('/orders/reset-sales', { method: 'POST' }),
  remove: (id) => api(`/orders/${id}`, { method: 'DELETE' }),
};

export const DriversApi = {
  list: () => api('/drivers'),
  stats: () => api('/drivers/stats'),
  todayStats: () => api('/drivers/me/today-stats'),
  orders: (id) => api(`/drivers/${id}/orders`),
  create: (body) => api('/drivers', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    api(`/drivers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  resetPassword: (id, password) =>
    api(`/drivers/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  remove: (id) => api(`/drivers/${id}`, { method: 'DELETE' }),
};

export const SettingsApi = {
  getStore: () => api('/settings/store'),
  updateStore: (body) =>
    api('/settings/store', { method: 'PATCH', body: JSON.stringify(body) }),
};

export const NotificationsApi = {
  broadcast: (title, body, data) =>
    api('/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify({ title, body, ...(data ? { data } : {}) }),
    }),
  pushTokenStats: () => api('/notifications/push-tokens/stats'),
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
