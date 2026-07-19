/**
 * Catalog tables + drivers UI (imported by app-api.js).
 */
import {
  AuthApi,
  CategoriesApi,
  ProductsApi,
  OrdersApi,
  DriversApi,
  clearSession,
  saveSession,
  toUiStatus,
  num,
  getAccessToken,
} from './api.js';
import { API_BASE } from './config.js';

let loginMode = 'admin';
let prodPage = 1;
let catPage = 1;
let assignOrderId = null;
let assignCurrentDriverId = null;
let driverPollTimer = null;

const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const jsStr = (str) => String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const formatDt = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-IQ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
};

const relativeTime = (value) => {
  if (!value) return 'لا يوجد';
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  return formatDt(value);
};

const availabilityLabel = (a) => {
  if (a === 'available') return { text: 'فارغ', cls: 'avail-available', icon: '🟢' };
  if (a === 'busy') return { text: 'يوصل طلب', cls: 'avail-busy', icon: '🟠' };
  return { text: 'غير متصل', cls: 'avail-offline', icon: '🔴' };
};

const productStatusLabel = (p) => {
  if (!p.isActive) return { text: 'مخفي', cls: 'status-hidden' };
  if ((p.stock ?? 0) <= 0) return { text: 'نافد', cls: 'status-oos' };
  return { text: 'نشط', cls: 'status-active' };
};

function renderPagination(elId, meta, onPage) {
  const el = document.getElementById(elId);
  if (!el || !meta) return;
  const { page, totalPages, total, hasPrev, hasNext } = meta;
  el.innerHTML = `
    <span>صفحة ${page} من ${totalPages} — ${total} نتيجة</span>
    <div class="pagination-actions">
      <button type="button" ${hasPrev ? '' : 'disabled'} data-page="${page - 1}">السابق</button>
      <button type="button" ${hasNext ? '' : 'disabled'} data-page="${page + 1}">التالي</button>
    </div>`;
  el.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.onclick = () => {
      if (btn.disabled) return;
      onPage(Number(btn.dataset.page));
    };
  });
}

export function applyRoleUi(role) {
  const isDriver = role === 'DRIVER';
  document.querySelectorAll('.nav-admin-only').forEach((el) => {
    el.classList.toggle('hidden', isDriver);
  });
  document.querySelectorAll('.nav-driver-only').forEach((el) => {
    el.classList.toggle('hidden', !isDriver);
  });
  // Hide non-driver admin sections for drivers
  const adminOnlyTabs = [
    'orders',
    'accepted-orders',
    'sales',
    'categories',
    'products',
    'discount-offers',
    'offers',
    'banners',
    'notifications',
    'store-settings',
    'drivers',
  ];
  document.querySelectorAll('.nav-item').forEach((btn) => {
    const onclick = btn.getAttribute('onclick') || '';
    const hideForDriver = adminOnlyTabs.some((t) => onclick.includes(`'${t}'`));
    if (isDriver && hideForDriver && !btn.classList.contains('nav-driver-only')) {
      btn.classList.add('hidden');
    } else if (!isDriver && !btn.classList.contains('nav-driver-only')) {
      btn.classList.remove('hidden');
    }
  });
  const badge = document.getElementById('role-badge');
  if (badge) {
    badge.innerHTML = isDriver
      ? '<i class="fa-solid fa-motorcycle"></i> مندوب'
      : '<i class="fa-solid fa-shield-halved"></i> أدمن';
  }
}

export function wireLoginMode() {
  window.setLoginMode = (mode) => {
    loginMode = mode === 'driver' ? 'driver' : 'admin';
    document.getElementById('login-tab-admin')?.classList.toggle('active', loginMode === 'admin');
    document.getElementById('login-tab-driver')?.classList.toggle('active', loginMode === 'driver');
    const btn = document.getElementById('btn-admin-login');
    if (btn) {
      btn.innerHTML =
        loginMode === 'driver'
          ? '<i class="fa-solid fa-motorcycle"></i> دخول المندوب'
          : '<i class="fa-solid fa-right-to-bracket"></i> دخول للوحة';
    }
  };
}

export async function handleUnifiedLogin(enterDashboard) {
  const username = document.getElementById('admin-username')?.value?.trim();
  const password = document.getElementById('admin-password')?.value;
  if (!username || !password) {
    window.showCustomAlert?.('أدخل اسم المستخدم وكلمة المرور');
    return;
  }
  const btn = document.getElementById('btn-admin-login');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الدخول...';
  }
  try {
    if (loginMode === 'driver') {
      const session = await AuthApi.driverLogin(username, password);
      if (session.user?.role !== 'DRIVER') {
        clearSession();
        throw new Error('هذا الحساب ليس مندوب');
      }
      saveSession(session);
      applyRoleUi('DRIVER');
      enterDashboard('driver-orders', { isDriver: true });
    } else {
      const session = await AuthApi.adminLogin(username, password);
      if (session.user?.role !== 'ADMIN') {
        clearSession();
        throw new Error('هذا الحساب ليس أدمن');
      }
      saveSession(session);
      applyRoleUi('ADMIN');
      enterDashboard('orders', { isDriver: false });
    }
  } catch (e) {
    window.showCustomAlert?.(e.message || 'بيانات الدخول غير صحيحة');
  } finally {
    if (btn) {
      btn.disabled = false;
      window.setLoginMode?.(loginMode);
    }
  }
}

// ─── Categories table ───
export async function loadCategoriesTable() {
  const list = document.getElementById('categories-list');
  if (!list) return;
  list.innerHTML = `<tr><td colspan="7">جاري التحميل...</td></tr>`;
  try {
    const params = {
      page: catPage,
      limit: document.getElementById('cat-page-size')?.value || 25,
      q: document.getElementById('cat-search')?.value || '',
      status: document.getElementById('cat-filter-status')?.value || '',
      sort: document.getElementById('cat-sort')?.value || 'newest',
    };
    const data = await CategoriesApi.listAdmin(params);
    const items = data.items || [];
    if (!items.length) {
      list.innerHTML = `<tr><td colspan="7">لا توجد أقسام</td></tr>`;
    } else {
      list.innerHTML = items
        .map((c) => {
          const st = c.isActive === false ? 'مخفي' : 'نشط';
          return `<tr>
            <td><input type="checkbox" class="cat-check" value="${c.id}" /></td>
            <td><img class="table-thumb" src="${escapeHtml(c.image || '')}" alt="" onerror="this.style.opacity=0.2" /></td>
            <td>${escapeHtml(c.name)}</td>
            <td>${c._count?.products ?? 0}</td>
            <td><span class="pill ${c.isActive === false ? 'status-hidden' : 'status-active'}">${st}</span></td>
            <td>${formatDt(c.createdAt)}</td>
            <td class="table-actions">
              <button class="btn-action edit" onclick="editCategory('${c.id}', '${jsStr(c.name)}', '${jsStr(c.parentId || '')}')"><i class="fa-solid fa-pen"></i></button>
              <button class="btn-action edit" onclick="quickToggleCategory('${c.id}', ${c.isActive !== false})">${c.isActive === false ? 'تفعيل' : 'إخفاء'}</button>
              <button class="btn-action delete" onclick="deleteDocItem('categories', '${c.id}', null, loadCategories)"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>`;
        })
        .join('');
    }
    renderPagination('cat-pagination', data, (p) => {
      catPage = p;
      loadCategoriesTable();
    });
  } catch (e) {
    list.innerHTML = `<tr><td colspan="7">${escapeHtml(e.message)}</td></tr>`;
  }
}

window.quickToggleCategory = async (id, currentlyActive) => {
  try {
    await CategoriesApi.update(id, { isActive: !currentlyActive });
    loadCategoriesTable();
  } catch (e) {
    window.showCustomAlert?.(e.message);
  }
};

window.bulkDeleteCategories = async () => {
  const ids = [...document.querySelectorAll('.cat-check:checked')].map((el) => el.value);
  if (!ids.length) return window.showCustomAlert?.('حدد أقساماً أولاً');
  if (!confirm(`حذف ${ids.length} قسم؟`)) return;
  try {
    await CategoriesApi.bulkDelete(ids);
    loadCategoriesTable();
  } catch (e) {
    window.showCustomAlert?.(e.message);
  }
};

window.toggleCatSelectAll = (checked) => {
  document.querySelectorAll('.cat-check').forEach((el) => {
    el.checked = checked;
  });
};

// ─── Products table ───
export async function loadProductsTable() {
  const list = document.getElementById('products-list');
  if (!list) return;
  list.innerHTML = `<tr><td colspan="9">جاري التحميل...</td></tr>`;
  try {
    const params = {
      page: prodPage,
      limit: document.getElementById('prod-page-size')?.value || 25,
      q: document.getElementById('prod-search')?.value || '',
      categoryId: document.getElementById('prod-filter-cat')?.value || '',
      status: document.getElementById('prod-filter-status')?.value || '',
      sort: document.getElementById('prod-sort')?.value || 'newest',
    };
    const data = await ProductsApi.listAdmin(params);
    const items = data.items || [];
    if (!items.length) {
      list.innerHTML = `<tr><td colspan="9">لا توجد منتجات</td></tr>`;
    } else {
      list.innerHTML = items
        .map((p) => {
          const img =
            (p.images && p.images[0]?.data) || p.image1 || p.image || '';
          const st = productStatusLabel(p);
          return `<tr>
            <td><input type="checkbox" class="prod-check" value="${p.id}" /></td>
            <td><img class="table-thumb" src="${escapeHtml(img)}" alt="" onerror="this.style.opacity=0.2" /></td>
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.category?.name || '')}</td>
            <td>
              <input type="number" class="inline-input" value="${num(p.price)}" min="0"
                onchange="quickUpdateProduct('${p.id}', { price: Number(this.value) })" />
            </td>
            <td><span class="pill ${st.cls}">${st.text}</span></td>
            <td>
              <input type="number" class="inline-input" value="${p.stock ?? 0}" min="0"
                onchange="quickUpdateProduct('${p.id}', { stock: Number(this.value) })" />
            </td>
            <td>${formatDt(p.createdAt)}</td>
            <td class="table-actions">
              <button class="btn-action edit" onclick="editProduct('${p.id}', '${jsStr(p.name)}', '${jsStr(p.categoryId)}', '${jsStr(p.description || '')}', '${num(p.price)}', ${p.stock ?? 0}, '${jsStr(p.sku || '')}', '${jsStr(p.barcode || '')}')"><i class="fa-solid fa-pen"></i></button>
              <button class="btn-action edit" onclick="quickUpdateProduct('${p.id}', { isActive: ${p.isActive ? 'false' : 'true'} })">${p.isActive ? 'إخفاء' : 'تفعيل'}</button>
              <button class="btn-action delete" onclick="deleteDocItem('products', '${p.id}', null, loadProducts)"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>`;
        })
        .join('');
    }
    renderPagination('prod-pagination', data, (p) => {
      prodPage = p;
      loadProductsTable();
    });
  } catch (e) {
    list.innerHTML = `<tr><td colspan="9">${escapeHtml(e.message)}</td></tr>`;
  }
}

window.quickUpdateProduct = async (id, body) => {
  try {
    await ProductsApi.update(id, body);
    loadProductsTable();
  } catch (e) {
    window.showCustomAlert?.(e.message);
  }
};

window.bulkDeleteProducts = async () => {
  const ids = [...document.querySelectorAll('.prod-check:checked')].map((el) => el.value);
  if (!ids.length) return window.showCustomAlert?.('حدد منتجات أولاً');
  if (!confirm(`حذف ${ids.length} منتج؟`)) return;
  try {
    await ProductsApi.bulkDelete(ids);
    loadProductsTable();
  } catch (e) {
    window.showCustomAlert?.(e.message);
  }
};

window.toggleProdSelectAll = (checked) => {
  document.querySelectorAll('.prod-check').forEach((el) => {
    el.checked = checked;
  });
};

window.exportProductsCsv = async () => {
  const params = new URLSearchParams({
    format: 'csv',
    q: document.getElementById('prod-search')?.value || '',
    categoryId: document.getElementById('prod-filter-cat')?.value || '',
    status: document.getElementById('prod-filter-status')?.value || '',
    sort: document.getElementById('prod-sort')?.value || 'newest',
  });
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/products/export?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    window.showCustomAlert?.('فشل التصدير');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'products.csv';
  a.click();
  URL.revokeObjectURL(url);
};

export async function fillProductCategoryFilter() {
  const select = document.getElementById('prod-filter-cat');
  if (!select) return;
  const cats = (await CategoriesApi.listAdminAll()) || [];
  const current = select.value;
  select.innerHTML = '<option value="">كل الأقسام</option>';
  cats.forEach((c) => {
    select.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
  });
  select.value = current;
}

export function wireCatalogFilters() {
  const reloadProd = () => {
    prodPage = 1;
    loadProductsTable();
  };
  const reloadCat = () => {
    catPage = 1;
    loadCategoriesTable();
  };
  ['prod-search', 'prod-filter-cat', 'prod-filter-status', 'prod-sort', 'prod-page-size'].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(id === 'prod-search' ? 'input' : 'change', () => {
        clearTimeout(el._t);
        el._t = setTimeout(reloadProd, id === 'prod-search' ? 350 : 0);
      });
    },
  );
  ['cat-search', 'cat-filter-status', 'cat-sort', 'cat-page-size'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(id === 'cat-search' ? 'input' : 'change', () => {
      clearTimeout(el._t);
      el._t = setTimeout(reloadCat, id === 'cat-search' ? 350 : 0);
    });
  });
}

// ─── Drivers ───
export async function loadDriversStats() {
  const el = document.getElementById('drivers-stats');
  if (!el) return;
  try {
    const s = await DriversApi.stats();
    el.innerHTML = `
      <div class="stat-card"><div class="stat-value">${s.driversTotal}</div><div class="stat-label">المندوبون</div></div>
      <div class="stat-card"><div class="stat-value">${s.available}</div><div class="stat-label">متاحون</div></div>
      <div class="stat-card"><div class="stat-value">${s.busy}</div><div class="stat-label">مشغولون</div></div>
      <div class="stat-card"><div class="stat-value">${s.offline}</div><div class="stat-label">غير متصلين</div></div>
      <div class="stat-card"><div class="stat-value">${s.online}</div><div class="stat-label">أونلاين</div></div>
      <div class="stat-card"><div class="stat-value">${s.todayOrders}</div><div class="stat-label">طلبات اليوم</div></div>
      <div class="stat-card"><div class="stat-value">${s.todayDelivered}</div><div class="stat-label">مسلّمة اليوم</div></div>
      <div class="stat-card"><div class="stat-value">${s.todayFailed}</div><div class="stat-label">فاشلة اليوم</div></div>
      <div class="stat-card"><div class="stat-value">${s.averageDeliveryMinutes ?? '—'}</div><div class="stat-label">متوسط التوصيل (د)</div></div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="order-meta">${escapeHtml(e.message)}</div>`;
  }
}

export async function loadDriversTable() {
  const list = document.getElementById('drivers-list');
  if (!list) return;
  list.innerHTML = `<tr><td colspan="7">جاري التحميل...</td></tr>`;
  try {
    const rows = (await DriversApi.list()) || [];
    if (!rows.length) {
      list.innerHTML = `<tr><td colspan="7">لا يوجد مندوبون</td></tr>`;
      return;
    }
    list.innerHTML = rows
      .map((d) => {
        const av = availabilityLabel(d.availability);
        return `<tr>
          <td>${escapeHtml(d.name || '')}</td>
          <td>${escapeHtml(d.username || '')}</td>
          <td>${escapeHtml(d.phone || '')}</td>
          <td><span class="pill ${av.cls}">${av.icon} ${av.text}</span>${d.isActive ? '' : ' (معطّل)'}</td>
          <td>${relativeTime(d.lastSeen)}</td>
          <td>${d.activeOrdersCount ?? 0}</td>
          <td class="table-actions">
            <button class="btn-action edit" onclick="editDriver('${d.id}', '${jsStr(d.name)}', '${jsStr(d.username)}', '${jsStr(d.phone)}')">تعديل</button>
            <button class="btn-action edit" onclick="resetDriverPassword('${d.id}')">باسورد</button>
            <button class="btn-action edit" onclick="toggleDriverActive('${d.id}', ${d.isActive})">${d.isActive ? 'تعطيل' : 'تفعيل'}</button>
            <button class="btn-action delete" onclick="deleteDriver('${d.id}')">حذف</button>
          </td>
        </tr>`;
      })
      .join('');
  } catch (e) {
    list.innerHTML = `<tr><td colspan="7">${escapeHtml(e.message)}</td></tr>`;
  }
}

window.saveDriver = async () => {
  const id = document.getElementById('driver-id')?.value;
  const name = document.getElementById('driver-name')?.value?.trim();
  const username = document.getElementById('driver-username')?.value?.trim();
  const phone = document.getElementById('driver-phone')?.value?.trim();
  const password = document.getElementById('driver-password')?.value;
  if (!name || !phone) return window.showCustomAlert?.('أكمل الاسم والهاتف');
  try {
    if (id) {
      await DriversApi.update(id, { name, phone });
      if (password) await DriversApi.resetPassword(id, password);
    } else {
      if (!username || !password) return window.showCustomAlert?.('اليوزر والباسورد مطلوبان');
      await DriversApi.create({ name, username, phone, password });
    }
    window.showCustomAlert?.('تم حفظ المندوب');
    document.getElementById('driver-id').value = '';
    document.getElementById('driver-name').value = '';
    document.getElementById('driver-username').value = '';
    document.getElementById('driver-phone').value = '';
    document.getElementById('driver-password').value = '';
    document.getElementById('driver-username').disabled = false;
    loadDriversTable();
    loadDriversStats();
  } catch (e) {
    window.showCustomAlert?.(e.message);
  }
};

window.editDriver = (id, name, username, phone) => {
  document.getElementById('driver-id').value = id;
  document.getElementById('driver-name').value = name;
  document.getElementById('driver-username').value = username;
  document.getElementById('driver-username').disabled = true;
  document.getElementById('driver-phone').value = phone;
  document.getElementById('driver-password').value = '';
};

window.resetDriverPassword = async (id) => {
  const password = prompt('كلمة المرور الجديدة:');
  if (!password) return;
  try {
    await DriversApi.resetPassword(id, password);
    window.showCustomAlert?.('تم تحديث كلمة المرور');
  } catch (e) {
    window.showCustomAlert?.(e.message);
  }
};

window.toggleDriverActive = async (id, isActive) => {
  try {
    await DriversApi.update(id, { isActive: !isActive });
    loadDriversTable();
    loadDriversStats();
  } catch (e) {
    window.showCustomAlert?.(e.message);
  }
};

window.deleteDriver = async (id) => {
  if (!confirm('تعطيل/حذف هذا المندوب؟')) return;
  try {
    await DriversApi.remove(id);
    loadDriversTable();
    loadDriversStats();
  } catch (e) {
    window.showCustomAlert?.(e.message);
  }
};

// ─── Assign driver ───
window.openAssignDriverModal = async (orderId, customerName, currentDriverId) => {
  assignOrderId = orderId;
  assignCurrentDriverId = currentDriverId || null;
  document.getElementById('assign-driver-order-label').textContent =
    `طلب ${customerName || ''} (#${String(orderId).slice(-6)})`;
  const list = document.getElementById('assign-driver-list');
  list.innerHTML = 'جاري التحميل...';
  document.getElementById('assign-driver-modal')?.classList.remove('hidden');
  try {
    const drivers = (await DriversApi.list()) || [];
    list.innerHTML = drivers
      .filter((d) => d.isActive)
      .map((d) => {
        const av = availabilityLabel(d.availability);
        return `<button type="button" class="assign-driver-row" onclick="confirmAssignDriver('${d.id}', '${jsStr(d.name || d.username)}')">
          <div><strong>${escapeHtml(d.name || '')}</strong> <span class="pill ${av.cls}">${av.icon} ${d.presence === 'ONLINE' ? 'Online' : 'Offline'} · ${av.text}</span></div>
          <div class="order-meta">${d.activeOrdersCount || 0} طلبات · آخر نشاط ${relativeTime(d.lastSeen)}</div>
        </button>`;
      })
      .join('') || '<div class="order-meta">لا يوجد مندوبون نشطون</div>';
  } catch (e) {
    list.innerHTML = escapeHtml(e.message);
  }
};

window.closeAssignDriverModal = () => {
  document.getElementById('assign-driver-modal')?.classList.add('hidden');
  assignOrderId = null;
};

window.confirmAssignDriver = async (driverId, driverName) => {
  if (!assignOrderId) return;
  let confirmReassign = false;
  if (assignCurrentDriverId && assignCurrentDriverId !== driverId) {
    if (
      !confirm(
        `هذا الطلب معيّن مسبقاً. إعادة التعيين إلى ${driverName}؟`,
      )
    ) {
      return;
    }
    confirmReassign = true;
  }
  try {
    await OrdersApi.assign(assignOrderId, driverId, confirmReassign);
    window.showCustomAlert?.(`تم التعيين إلى ${driverName}`);
    closeAssignDriverModal();
    window.loadOrders?.('pending');
    window.loadOrders?.('accepted');
  } catch (e) {
    if (e.status === 409 || e.payload?.code === 'ALREADY_ASSIGNED') {
      const name = e.payload?.currentDriverName || 'مندوب آخر';
      if (confirm(`الطلب معيّن لـ ${name}. إعادة التعيين؟`)) {
        try {
          await OrdersApi.assign(assignOrderId, driverId, true);
          window.showCustomAlert?.('تم إعادة التعيين');
          closeAssignDriverModal();
          window.loadOrders?.('pending');
          window.loadOrders?.('accepted');
        } catch (e2) {
          window.showCustomAlert?.(e2.message);
        }
      }
      return;
    }
    window.showCustomAlert?.(e.message);
  }
};

// ─── Driver panel ───
export async function loadDriverOrdersPanel() {
  const list = document.getElementById('driver-orders-list');
  const statsEl = document.getElementById('driver-today-stats');
  if (statsEl) {
    try {
      const s = await DriversApi.todayStats();
      statsEl.innerHTML = `
        <div class="stat-card"><div class="stat-value">${s.todayOrders}</div><div class="stat-label">طلبات اليوم</div></div>
        <div class="stat-card"><div class="stat-value">${s.delivered}</div><div class="stat-label">مسلّمة</div></div>
        <div class="stat-card"><div class="stat-value">${s.failed}</div><div class="stat-label">فاشلة</div></div>
        <div class="stat-card"><div class="stat-value">${s.open}</div><div class="stat-label">مفتوحة</div></div>
      `;
    } catch (_) {}
  }
  if (!list) return;
  list.innerHTML = 'جاري التحميل...';
  try {
    const rows = (await OrdersApi.mineDriver()) || [];
    if (!rows.length) {
      list.innerHTML = '<div class="empty-state"><p>لا توجد طلبات معيّنة</p></div>';
      return;
    }
    list.innerHTML = rows
      .map((o) => {
        const ui = toUiStatus(o.status);
        const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address || '')}`;
        const items = (o.items || [])
          .map(
            (it) =>
              `<div class="order-item-row"><span>${escapeHtml(it.name)} ×${it.qty}</span></div>`,
          )
          .join('');
        let actions = '';
        if (!o.acceptedAt && ['pending', 'accepted', 'preparing'].includes(ui)) {
          actions += `<button class="btn-action accept" onclick="driverUpdateStatus('${o.id}', 'ACCEPTED')">قبول الطلب</button>`;
        }
        if (ui !== 'on_the_way' && ui !== 'delivered' && ui !== 'delivery_failed' && ui !== 'cancelled') {
          actions += `<button class="btn-action edit" onclick="driverUpdateStatus('${o.id}', 'ON_THE_WAY')">بالطريق</button>`;
        }
        if (ui === 'on_the_way' || ui === 'accepted' || ui === 'preparing') {
          actions += `<button class="btn-action accept" onclick="driverUpdateStatus('${o.id}', 'DELIVERED')">تم التسليم</button>`;
          actions += `<button class="btn-action delete" onclick="driverUpdateStatus('${o.id}', 'DELIVERY_FAILED')">تعذر التسليم</button>`;
        }
        return `<div class="card-3d order-card">
          <div class="order-card-header">
            <div>
              <div class="card-title">طلب #${escapeHtml(String(o.id).slice(-6))} — ${escapeHtml(o.name)}</div>
              <div class="order-meta"><a href="tel:${escapeHtml(o.phone)}">${escapeHtml(o.phone)}</a></div>
            </div>
            <span class="order-status ${ui}">${escapeHtml(ui)}</span>
          </div>
          <div class="order-meta">${escapeHtml(o.address || '')}</div>
          <div class="order-meta"><a href="${maps}" target="_blank" rel="noopener">Google Maps</a></div>
          <div class="order-items">${items}</div>
          <div class="order-total">${num(o.total).toLocaleString('ar-IQ')} د.ع — ${escapeHtml(o.paymentMethod || 'نقدي')}</div>
          <div class="order-actions">${actions}</div>
        </div>`;
      })
      .join('');
  } catch (e) {
    list.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
  }
}

window.driverUpdateStatus = async (id, status) => {
  try {
    await OrdersApi.updateStatus(id, status);
    window.showCustomAlert?.('تم تحديث الحالة');
    loadDriverOrdersPanel();
  } catch (e) {
    window.showCustomAlert?.(e.message);
  }
};

export function startDriverPolling() {
  stopDriverPolling();
  loadDriverOrdersPanel();
  driverPollTimer = setInterval(loadDriverOrdersPanel, 10000);
}

export function stopDriverPolling() {
  if (driverPollTimer) {
    clearInterval(driverPollTimer);
    driverPollTimer = null;
  }
}

export function enrichOrderCardHtml(data) {
  const driver = data.driver;
  const accepted =
    data.acceptedAt
      ? `<div class="order-meta" style="color:#145528;font-weight:700">Driver Accepted ✓</div>`
      : '';
  const driverLine = driver
    ? `<div class="order-meta"><i class="fa-solid fa-motorcycle"></i> ${escapeHtml(driver.name || driver.username || '')}</div>`
    : '';
  const assignBtn = `<button class="btn-action edit" onclick="openAssignDriverModal('${data.id}', '${jsStr(data.name)}', '${jsStr(data.driverId || '')}')"><i class="fa-solid fa-user-plus"></i> تعيين مندوب</button>`;
  return { accepted, driverLine, assignBtn };
}
