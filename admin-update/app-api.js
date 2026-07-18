/**
 * Admin dashboard wired to NestJS API (no Firestore).
 */
import {
  AuthApi,
  CategoriesApi,
  ProductsApi,
  BannersApi,
  OffersApi,
  OrdersApi,
  SettingsApi,
  NotificationsApi,
  uploadImageFile,
  getAccessToken,
  getStoredAdmin,
  clearSession,
  saveSession,
  toApiStatus,
  toUiStatus,
  num,
} from './api.js';

let allProducts = [];
let allCategories = [];
let lastPendingCount = null;
let ordersPollTimer = null;
let knownPendingIds = new Set();
let ordersAlertsReady = false;

const ACTIVE_ORDER_STATUSES = ['accepted', 'preparing', 'on_the_way'];
const ORDER_STATUS_LABELS = {
  pending: 'قيد الانتظار',
  accepted: 'تمت الموافقة',
  preparing: 'قيد التجهيز',
  on_the_way: 'في التوصيل',
};

const formatOrderDateTime = (value) => {
  if (!value) return 'غير متوفر';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير متوفر';
  return new Intl.DateTimeFormat('ar-IQ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const getOrderStatusLabel = (status) =>
  ORDER_STATUS_LABELS[toUiStatus(status)] || status || 'غير معروف';

const getTimeMs = (value) => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const sortOrdersNewestFirst = (orders, mode = 'pending') =>
  [...orders].sort((a, b) => {
    const aTime =
      mode === 'active'
        ? getTimeMs(a.statusUpdatedAt) || getTimeMs(a.createdAt)
        : getTimeMs(a.createdAt);
    const bTime =
      mode === 'active'
        ? getTimeMs(b.statusUpdatedAt) || getTimeMs(b.createdAt)
        : getTimeMs(b.createdAt);
    return bTime - aTime;
  });

const APARTMENT_FLOORS = [
  { value: 'G', label: 'الأرضي' },
  { value: '01', label: 'الطابق الأول' },
  { value: '02', label: 'الطابق الثاني' },
  { value: '03', label: 'الطابق الثالث' },
  { value: '04', label: 'الطابق الرابع' },
  { value: '05', label: 'الطابق الخامس' },
  { value: '06', label: 'الطابق السادس' },
  { value: '07', label: 'الطابق السابع' },
  { value: '08', label: 'الطابق الثامن' },
  { value: '09', label: 'الطابق التاسع' },
];
const APARTMENT_CODE_REGEX = /^([AB]\d)-(\d{2})-(G|\d{2})-(\d{2})$/i;
const getFloorLabel = (floor) =>
  APARTMENT_FLOORS.find((f) => f.value === floor)?.label || floor;
const parseApartmentCode = (code) => {
  if (!code) return null;
  const match = String(code).trim().toUpperCase().match(APARTMENT_CODE_REGEX);
  if (!match) return null;
  const [, block, buildingStr, floorRaw, apartmentStr] = match;
  return {
    block,
    building: parseInt(buildingStr, 10),
    floor: floorRaw === 'G' ? 'G' : floorRaw,
    apartment: parseInt(apartmentStr, 10),
  };
};
const formatApartmentSummary = (selection) =>
  `بلوك ${selection.block} · بناية ${String(selection.building).padStart(2, '0')} · ${getFloorLabel(selection.floor)} · شقة ${String(selection.apartment).padStart(2, '0')}`;

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
const emptyState = (icon, text) =>
  `<div class="empty-state"><i class="fa-solid ${icon}"></i><p>${text}</p></div>`;
const loadingState = () =>
  `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>`;

const buildOrderAddressHtml = (rawAddress) => {
  const addressValue = rawAddress ? String(rawAddress).trim() : '';
  if (!addressValue) {
    return `<div class="order-address-box order-address-empty">
            <div class="order-address-title"><i class="fa-solid fa-location-dot"></i> عنوان التوصيل</div>
            <div class="order-address-missing">غير متوفر</div>
        </div>`;
  }
  const parsed = parseApartmentCode(addressValue);
  if (!parsed) {
    return `<div class="order-address-box">
            <div class="order-address-title"><i class="fa-solid fa-location-dot"></i> عنوان التوصيل</div>
            <div class="order-address-raw">${escapeHtml(addressValue)}</div>
        </div>`;
  }
  const building = String(parsed.building).padStart(2, '0');
  const apartment = String(parsed.apartment).padStart(2, '0');
  const floorLabel = getFloorLabel(parsed.floor);
  return `<div class="order-address-box">
        <div class="order-address-title"><i class="fa-solid fa-location-dot"></i> عنوان التوصيل</div>
        <div class="order-address-code">${escapeHtml(addressValue.toUpperCase())}</div>
        <div class="order-address-summary">${escapeHtml(formatApartmentSummary(parsed))}</div>
        <div class="order-address-grid">
            <div class="order-address-item"><span class="order-address-label">البلوك</span><span class="order-address-value">${escapeHtml(parsed.block)}</span></div>
            <div class="order-address-item"><span class="order-address-label">البناية</span><span class="order-address-value">${escapeHtml(building)}</span></div>
            <div class="order-address-item"><span class="order-address-label">الطابق</span><span class="order-address-value">${escapeHtml(floorLabel)}</span></div>
            <div class="order-address-item"><span class="order-address-label">الشقة</span><span class="order-address-value">${escapeHtml(apartment)}</span></div>
        </div>
    </div>`;
};

const buildOrderActionButtons = (id, status, reloadStatus) => {
  const ui = toUiStatus(status);
  const buttons = [];
  if (ui === 'pending') {
    buttons.push(
      `<button class="btn-action accept" onclick="window.updateOrderStatus('${id}', 'accepted', '${reloadStatus}')"><i class="fa-solid fa-check"></i> موافقة</button>`,
    );
    buttons.push(
      `<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'preparing', '${reloadStatus}')"><i class="fa-solid fa-kitchen-set"></i> تجهيز</button>`,
    );
    buttons.push(
      `<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'on_the_way', '${reloadStatus}')"><i class="fa-solid fa-truck"></i> توصيل</button>`,
    );
  } else if (ui === 'accepted') {
    buttons.push(
      `<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'preparing', '${reloadStatus}')"><i class="fa-solid fa-kitchen-set"></i> تجهيز</button>`,
    );
    buttons.push(
      `<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'on_the_way', '${reloadStatus}')"><i class="fa-solid fa-truck"></i> توصيل</button>`,
    );
  } else if (ui === 'preparing') {
    buttons.push(
      `<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'on_the_way', '${reloadStatus}')"><i class="fa-solid fa-truck"></i> توصيل</button>`,
    );
  }
  return buttons.join(' ');
};

window.showCustomAlert = (message) => {
  const alertBox = document.createElement('div');
  alertBox.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size: 1.5rem; margin-bottom: 5px;"></i><br>${message}`;
  alertBox.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(46, 204, 113, 0.95); color: white; padding: 15px 30px;
        border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        z-index: 10000; font-weight: bold; text-align: center; backdrop-filter: blur(5px);
        animation: dropDown 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
    `;
  document.body.appendChild(alertBox);
  if (!document.getElementById('alert-styles')) {
    const style = document.createElement('style');
    style.id = 'alert-styles';
    style.innerHTML = `
            @keyframes dropDown { 0% { top: -100px; opacity: 0; } 100% { top: 20px; opacity: 1; } }
            @keyframes fadeOutUp { 0% { top: 20px; opacity: 1; } 100% { top: -100px; opacity: 0; } }
        `;
    document.head.appendChild(style);
  }
  setTimeout(() => {
    alertBox.style.animation = 'fadeOutUp 0.5s ease forwards';
    setTimeout(() => alertBox.remove(), 500);
  }, 3000);
};

async function compressToFile(file, maxWidth = 1000, quality = 0.8) {
  if (!file) return null;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let scale = 1;
        if (img.width > maxWidth) scale = maxWidth / img.width;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg') || 'image.jpg', {
    type: 'image/jpeg',
  });
}

async function uploadImageGetUrl(file, maxWidth = 1000, quality = 0.8, folder = 'uploads') {
  const compressed = await compressToFile(file, maxWidth, quality);
  return uploadImageFile(compressed || file, folder);
}

function updatePendingBadgeFromCount(count) {
  const badge = document.getElementById('pending-orders-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = String(count);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function stopOrderPolling() {
  if (ordersPollTimer) {
    clearInterval(ordersPollTimer);
    ordersPollTimer = null;
  }
  ordersAlertsReady = false;
  knownPendingIds.clear();
  updatePendingBadgeFromCount(0);
}

async function pollPendingOrders() {
  try {
    const rows = (await OrdersApi.list('PENDING')) || [];
    const ids = new Set(rows.map((o) => o.id));
    updatePendingBadgeFromCount(rows.length);
    lastPendingCount = rows.length;

    if (!ordersAlertsReady) {
      knownPendingIds = ids;
      ordersAlertsReady = true;
      return;
    }

    for (const order of rows) {
      if (!knownPendingIds.has(order.id)) {
        const title = '📦 طلب جديد';
        const body = `${order.name || 'زبون'} — ${num(order.total).toLocaleString('ar-IQ')} د.ع`;
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(title, { body, tag: `tofaha-new-${order.id}` });
          } catch (_) {}
        }
        const active =
          document.querySelector('.tab-content.active')?.id || '';
        if (active === 'orders') window.loadOrders('pending');
      }
    }
    knownPendingIds = ids;
  } catch (e) {
    console.warn('poll pending orders failed', e);
  }
}

function startOrderPolling() {
  stopOrderPolling();
  pollPendingOrders();
  ordersPollTimer = setInterval(pollPendingOrders, 12000);
}

async function enterAdminDashboard(initialTab = 'orders') {
  const overlay = document.getElementById('login-overlay');
  const app = document.getElementById('app-content');
  if (!overlay || !app) return;
  overlay.style.opacity = '0';
  setTimeout(() => {
    overlay.style.display = 'none';
    app.style.display = 'block';
    switchTab(initialTab);
    startOrderPolling();
  }, 200);
}

function showLoginScreen() {
  stopOrderPolling();
  lastPendingCount = null;
  clearSession();
  const overlay = document.getElementById('login-overlay');
  const app = document.getElementById('app-content');
  if (app) app.style.display = 'none';
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
  }
  const passwordEl = document.getElementById('admin-password');
  if (passwordEl) passwordEl.value = '';
}

window.logoutAdmin = async () => {
  if (!confirm('تسجيل الخروج من لوحة الإدارة؟')) return;
  await AuthApi.logout();
  showLoginScreen();
};

window.loginAdmin = async () => {
  const username = document.getElementById('admin-username')?.value?.trim();
  const password = document.getElementById('admin-password')?.value;
  if (!username || !password) return showCustomAlert('أدخل اسم المستخدم وكلمة المرور');
  const btn = document.getElementById('btn-admin-login');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الدخول...';
  }
  try {
    const session = await AuthApi.adminLogin(username, password);
    if (session.user?.role !== 'ADMIN') {
      clearSession();
      throw new Error('هذا الحساب ليس أدمن');
    }
    saveSession(session);
    enterAdminDashboard('orders');
  } catch (e) {
    showCustomAlert(e.message || 'بيانات الدخول غير صحيحة');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> دخول للوحة';
    }
  }
};

function initAdminSession() {
  const token = getAccessToken();
  const user = getStoredAdmin();
  if (token && user?.role === 'ADMIN') {
    enterAdminDashboard('orders');
  }
}

window.switchTab = (tabId) => {
  document.querySelectorAll('.tab-content').forEach((tab) => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');
  const activeNavItem = document.querySelector(`.nav-item[onclick*="switchTab('${tabId}')"]`);
  if (activeNavItem) activeNavItem.classList.add('active');
  if (typeof window.setAdminPageTitle === 'function') window.setAdminPageTitle(tabId);
  if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);

  if (tabId === 'categories') loadCategories();
  if (tabId === 'products') {
    loadCategoriesForSelect();
    loadProducts();
  }
  if (tabId === 'offers') loadOffers();
  if (tabId === 'discount-offers') loadDiscountProducts();
  if (tabId === 'banners') loadBanners();
  if (tabId === 'orders') loadOrders('pending');
  if (tabId === 'accepted-orders') loadOrders('accepted');
  if (tabId === 'sales') loadSales();
  if (tabId === 'notifications') {
    loadPushTokenStats();
    loadNotificationsHistory();
  }
  if (tabId === 'store-settings') loadStoreSettings();
};

// === Settings ===
window.loadStoreSettings = async () => {
  try {
    const data = (await SettingsApi.getStore()) || {};
    const openEl = document.getElementById('store-open');
    const closeEl = document.getElementById('store-close');
    const enabledEl = document.getElementById('store-enabled');
    if (openEl) openEl.value = data.openTime || '08:30';
    if (closeEl) closeEl.value = data.closeTime || '02:00';
    if (enabledEl) enabledEl.checked = data.enabled !== false;

    const forceEl = document.getElementById('force-update-enabled');
    const iosEl = document.getElementById('min-ios-version');
    const androidEl = document.getElementById('min-android-version');
    const msgEl = document.getElementById('update-message');
    if (forceEl) forceEl.checked = Boolean(data.forceUpdate);
    if (iosEl) iosEl.value = data.minIosVersion || '';
    if (androidEl) androidEl.value = data.minAndroidVersion || '';
    if (msgEl) {
      msgEl.value =
        data.updateMessage ||
        'يتوفر تحديث جديد لتطبيق تفاحة. يجب تحديث التطبيق للمتابعة.';
    }
  } catch (e) {
    showCustomAlert(e.message || 'تعذر تحميل الإعدادات');
  }
};

window.saveStoreSettings = async () => {
  try {
    const openTime = document.getElementById('store-open')?.value || '08:30';
    const closeTime = document.getElementById('store-close')?.value || '02:00';
    const enabled = document.getElementById('store-enabled')?.checked !== false;
    await SettingsApi.updateStore({
      openTime,
      closeTime,
      timezone: 'Asia/Baghdad',
      enabled,
    });
    showCustomAlert('تم حفظ أوقات العمل');
  } catch (e) {
    showCustomAlert(e.message || 'تعذر الحفظ');
  }
};

window.saveForceUpdateSettings = async () => {
  try {
    const forceUpdate = document.getElementById('force-update-enabled')?.checked === true;
    const minIosVersion = document.getElementById('min-ios-version')?.value?.trim() || null;
    const minAndroidVersion =
      document.getElementById('min-android-version')?.value?.trim() || null;
    const updateMessage = document.getElementById('update-message')?.value?.trim() || null;
    await SettingsApi.updateStore({
      forceUpdate,
      minIosVersion,
      minAndroidVersion,
      updateMessage,
      iosStoreUrl: 'https://apps.apple.com/app/id6763769377',
      androidStoreUrl:
        'https://play.google.com/store/apps/details?id=com.tofahastore.app',
    });
    showCustomAlert(
      forceUpdate
        ? 'تم تفعيل التحديث الإجباري'
        : 'تم حفظ إعدادات التحديث (غير مفعّل)',
    );
  } catch (e) {
    showCustomAlert(e.message || 'تعذر الحفظ');
  }
};

// === Categories ===
window.saveCategory = async () => {
  const id = document.getElementById('cat-id').value;
  const name = document.getElementById('cat-name').value;
  const parentId = document.getElementById('cat-parent')?.value || '';
  const file = document.getElementById('cat-img').files[0];
  if (!name) return showCustomAlert('أدخل اسم القسم');
  const btn = document.getElementById('btn-save-cat');
  btn.innerText = 'جاري الرفع...';
  try {
    let image;
    if (file) image = await uploadImageGetUrl(file, 400, 0.7, 'categories');
    if (id) {
      const body = { name, parentId: parentId || null };
      if (image) body.image = image;
      await CategoriesApi.update(id, body);
    } else {
      if (!image) throw new Error('اختر صورة للقسم');
      await CategoriesApi.create({
        name,
        image,
        parentId: parentId || undefined,
      });
    }
    showCustomAlert('تم حفظ القسم');
    document.getElementById('cat-id').value = '';
    document.getElementById('cat-name').value = '';
    document.getElementById('cat-img').value = '';
    if (document.getElementById('cat-parent')) document.getElementById('cat-parent').value = '';
    switchTab('categories');
  } catch (e) {
    showCustomAlert(e.message);
  }
  btn.innerHTML = 'حفظ القسم <i class="fa-solid fa-save"></i>';
};

window.loadParentCategoriesForSelect = async (selectId, selectedId = '') => {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">قسم رئيسي — بدون أب</option>';
  const cats = allCategories.length ? allCategories : (await CategoriesApi.list()) || [];
  cats
    .filter((c) => !c.parentId)
    .forEach((c) => {
      const selected = selectedId === c.id ? 'selected' : '';
      select.innerHTML += `<option value="${c.id}" ${selected}>${escapeHtml(c.name)}</option>`;
    });
};

window.loadCategories = async () => {
  const list = document.getElementById('categories-list');
  list.innerHTML = loadingState();
  try {
    allCategories = (await CategoriesApi.list()) || [];
    await loadParentCategoriesForSelect('cat-parent');
    list.innerHTML = '';
    if (!allCategories.length) {
      list.innerHTML = emptyState('fa-layer-group', 'لا توجد أقسام بعد');
      return;
    }
    const parentMap = Object.fromEntries(
      allCategories.filter((c) => !c.parentId).map((c) => [c.id, c.name]),
    );
    allCategories.forEach((data) => {
      const parentLabel = data.parentId ? parentMap[data.parentId] : null;
      const safeName = escapeHtml(data.name);
      const badge = parentLabel
        ? `<div class="order-meta"><i class="fa-solid fa-folder-tree"></i> فرعي ضمن: ${escapeHtml(parentLabel)}</div>`
        : `<div class="order-meta"><i class="fa-solid fa-layer-group"></i> قسم رئيسي</div>`;
      list.innerHTML += `<div class="card-3d">
            <img src="${escapeHtml(data.image || '')}" alt="${safeName}" onerror="this.style.display='none'">
            <div class="card-title">${safeName}</div>
            ${badge}
            <div class="card-actions">
                <button class="btn-action edit" onclick="editCategory('${data.id}', '${jsStr(data.name)}', '${jsStr(data.parentId || '')}')"><i class="fa-solid fa-pen"></i> تعديل</button>
                <button class="btn-action delete" onclick="deleteDocItem('categories', '${data.id}', null, loadCategories)"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        </div>`;
    });
  } catch (e) {
    list.innerHTML = emptyState('fa-triangle-exclamation', e.message || 'خطأ');
  }
};

window.editCategory = async (id, name, parentId = '') => {
  document.getElementById('cat-id').value = id;
  document.getElementById('cat-name').value = name;
  await loadParentCategoriesForSelect('cat-parent', parentId || '');
  document.getElementById('btn-save-cat').innerText = 'تحديث القسم';
};

window.loadCategoriesForSelect = async () => {
  const select = document.getElementById('prod-cat');
  select.innerHTML = '<option value="">اختر القسم</option>';
  allCategories = (await CategoriesApi.list()) || [];
  const parentMap = Object.fromEntries(
    allCategories.filter((c) => !c.parentId).map((c) => [c.id, c.name]),
  );
  allCategories.forEach((data) => {
    const prefix =
      data.parentId && parentMap[data.parentId] ? `${parentMap[data.parentId]} › ` : '';
    select.innerHTML += `<option value="${data.id}">${prefix}${escapeHtml(data.name)}</option>`;
  });
};

// === Products ===
window.saveProduct = async () => {
  const id = document.getElementById('prod-id').value;
  const name = document.getElementById('prod-name').value;
  const categoryId = document.getElementById('prod-cat').value;
  const desc = document.getElementById('prod-desc').value;
  const price = document.getElementById('prod-price').value;
  const files = document.getElementById('prod-images').files;
  if (!name || !price) return showCustomAlert('أكمل البيانات');
  if (!id && !categoryId) return showCustomAlert('اختر القسم');
  const btn = document.getElementById('btn-save-prod');
  btn.innerText = 'جاري الرفع...';
  try {
    const body = {
      name,
      description: desc || undefined,
      price: Number(price),
    };
    if (categoryId) body.categoryId = categoryId;
    if (files.length > 0) {
      const url1 = await uploadImageGetUrl(files[0], 800, 0.75, 'products');
      body.images = [{ id: 'img_' + Date.now(), data: url1 }];
      body.image = url1;
      body.image1 = url1;
      if (files[1]) body.image2 = await uploadImageGetUrl(files[1], 800, 0.75, 'products');
    }
    if (id) {
      if (!body.image && !files.length) {
        // keep existing images on update without new files
        delete body.image;
        delete body.image1;
        delete body.images;
      }
      await ProductsApi.update(id, body);
    } else {
      if (!body.image) throw new Error('اختر صورة للمنتج');
      await ProductsApi.create(body);
    }
    showCustomAlert('تم حفظ المنتج بنجاح');
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-desc').value = '';
    document.getElementById('prod-price').value = '';
    document.getElementById('prod-images').value = '';
    switchTab('products');
  } catch (e) {
    showCustomAlert(e.message || 'خطأ في الحفظ');
    console.error(e);
  }
  btn.innerHTML = 'حفظ المنتج <i class="fa-solid fa-save"></i>';
};

window.loadProducts = async () => {
  const list = document.getElementById('products-list');
  list.innerHTML = loadingState();
  try {
    const products = (await ProductsApi.list()) || [];
    list.innerHTML = '';
    if (!products.length) {
      list.innerHTML = emptyState('fa-box', 'لا توجد منتجات بعد');
      return;
    }
    products.forEach((data) => {
      const imgSrc =
        (data.images && data.images.length > 0 && data.images[0].data) ||
        data.image1 ||
        data.image ||
        '';
      const catName = data.category?.name || '';
      const safeName = escapeHtml(data.name);
      list.innerHTML += `<div class="card-3d">
            <img src="${escapeHtml(imgSrc)}" alt="${safeName}" onerror="this.style.display='none'">
            <div class="card-title">${safeName}</div>
            <div class="card-price">${num(data.price).toLocaleString('ar-IQ')} د.ع</div>
            ${catName ? `<div style="font-size:0.78rem;color:#94A396;margin-bottom:4px">${escapeHtml(catName)}</div>` : ''}
            <div class="card-actions">
                <button class="btn-action edit" onclick="editProduct('${data.id}', '${jsStr(data.name)}', '${jsStr(data.categoryId)}', '${jsStr(data.description || '')}', '${num(data.price)}')"><i class="fa-solid fa-pen"></i> تعديل</button>
                <button class="btn-action delete" onclick="deleteDocItem('products', '${data.id}', null, loadProducts)"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        </div>`;
    });
  } catch (e) {
    list.innerHTML = emptyState('fa-triangle-exclamation', e.message || 'خطأ');
  }
};

window.editProduct = (id, name, categoryId, desc, price) => {
  document.getElementById('prod-id').value = id;
  document.getElementById('prod-name').value = name;
  document.getElementById('prod-cat').value = categoryId;
  document.getElementById('prod-desc').value = desc;
  document.getElementById('prod-price').value = price;
  document.getElementById('btn-save-prod').innerText = 'تحديث المنتج';
  window.scrollTo(0, 0);
};

window.loadDiscountProducts = async () => {
  const selectList = document.getElementById('discount-products-select-list');
  const discountList = document.getElementById('discounted-products-list');
  selectList.innerHTML = loadingState();
  discountList.innerHTML = '';
  try {
    const products = (await ProductsApi.list()) || [];
    allProducts = products;
    selectList.innerHTML = '';
    let hasSelectable = false;
    let hasDiscounted = false;
    products.forEach((data) => {
      const imgSrc =
        (data.images && data.images[0]?.data) || data.image1 || data.image || '';
      const safeName = escapeHtml(data.name);
      if (!data.hasDiscount) {
        hasSelectable = true;
        selectList.innerHTML += `<label class="card-3d discount-select-card">
                <input type="checkbox" class="discount-checkbox" value="${data.id}">
                <img src="${escapeHtml(imgSrc)}" alt="${safeName}" onerror="this.style.display='none'">
                <div class="card-title" style="font-size:0.85rem">${safeName}</div>
                <div class="card-price">${num(data.price).toLocaleString('ar-IQ')} د.ع</div>
            </label>`;
      } else {
        hasDiscounted = true;
        discountList.innerHTML += `<div class="card-3d">
                <img src="${escapeHtml(imgSrc)}" alt="${safeName}">
                <div class="card-title">${safeName}</div>
                <div class="card-price-old">${num(data.originalPrice).toLocaleString('ar-IQ')} د.ع</div>
                <div class="card-price-discount">${num(data.price).toLocaleString('ar-IQ')} د.ع (-${data.discountPercent}%)</div>
                <div class="card-actions">
                    <button class="btn-action remove-discount" onclick="removeDiscount('${data.id}', ${num(data.originalPrice)})"><i class="fa-solid fa-xmark"></i> إلغاء الخصم</button>
                </div>
            </div>`;
      }
    });
    if (!hasSelectable)
      selectList.innerHTML = emptyState(
        'fa-percent',
        'كل المنتجات لديها خصم أو لا توجد منتجات',
      );
    if (!hasDiscounted)
      discountList.innerHTML = emptyState('fa-tag', 'لا توجد منتجات بخصم حالياً');
  } catch (e) {
    selectList.innerHTML = emptyState('fa-triangle-exclamation', e.message || 'خطأ');
  }
};

window.applyDiscountToSelected = async () => {
  const percent = document.getElementById('discount-percent').value;
  const checkboxes = document.querySelectorAll('.discount-checkbox:checked');
  if (!percent || checkboxes.length === 0) return showCustomAlert('أكمل بيانات الخصم');
  try {
    for (const cb of checkboxes) {
      const product = allProducts.find((p) => p.id === cb.value);
      if (!product) continue;
      const originalPrice = num(product.price);
      const newPrice = Math.round(originalPrice - originalPrice * (percent / 100));
      await ProductsApi.update(product.id, {
        price: newPrice,
        originalPrice,
        hasDiscount: true,
        discountPercent: Number(percent),
      });
    }
    showCustomAlert('تم تطبيق الخصم');
    loadDiscountProducts();
  } catch (e) {
    showCustomAlert(e.message);
  }
};

window.removeDiscount = async (id, originalPrice) => {
  try {
    await ProductsApi.update(id, {
      price: originalPrice,
      originalPrice: null,
      hasDiscount: false,
      discountPercent: null,
    });
    loadDiscountProducts();
  } catch (e) {
    showCustomAlert(e.message);
  }
};

// === Offers / Banners ===
window.saveOffer = async () => {
  const files = document.getElementById('offer-img').files;
  const btn = document.getElementById('btn-save-offer');
  btn.innerText = 'جاري الرفع...';
  try {
    for (const f of files) {
      const url = await uploadImageGetUrl(f, 900, 0.75, 'offers');
      await OffersApi.create({ image: url });
    }
    showCustomAlert('تم حفظ العروض');
    loadOffers();
  } catch (e) {
    showCustomAlert(e.message);
  }
  btn.innerHTML = 'حفظ العرض <i class="fa-solid fa-save"></i>';
};

window.loadOffers = async () => {
  const list = document.getElementById('offers-list');
  list.innerHTML = loadingState();
  try {
    const rows = (await OffersApi.list()) || [];
    list.innerHTML = '';
    if (!rows.length) {
      list.innerHTML = emptyState('fa-tags', 'لا توجد عروض بعد');
      return;
    }
    rows.forEach((row) => {
      list.innerHTML += `<div class="card-3d">
            <img src="${escapeHtml(row.image)}" alt="عرض">
            <div class="card-actions">
                <button class="btn-action delete" onclick="deleteDocItem('offers', '${row.id}', null, loadOffers)"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        </div>`;
    });
  } catch (e) {
    list.innerHTML = emptyState('fa-triangle-exclamation', e.message || 'خطأ');
  }
};

window.saveBanner = async () => {
  const files = document.getElementById('banner-img').files;
  const btn = document.getElementById('btn-save-banner');
  btn.innerText = 'جاري الرفع...';
  try {
    for (const f of files) {
      const url = await uploadImageGetUrl(f, 1200, 0.8, 'banners');
      await BannersApi.create({ image: url });
    }
    showCustomAlert('تم حفظ البنرات');
    loadBanners();
  } catch (e) {
    showCustomAlert(e.message);
  }
  btn.innerHTML = 'حفظ البنر <i class="fa-solid fa-save"></i>';
};

window.loadBanners = async () => {
  const list = document.getElementById('banners-list');
  list.innerHTML = loadingState();
  try {
    const rows = (await BannersApi.list()) || [];
    list.innerHTML = '';
    if (!rows.length) {
      list.innerHTML = emptyState('fa-image', 'لا توجد بنرات بعد');
      return;
    }
    rows.forEach((row) => {
      list.innerHTML += `<div class="card-3d">
            <img src="${escapeHtml(row.image)}" alt="بنر">
            <div class="card-actions">
                <button class="btn-action delete" onclick="deleteDocItem('banners', '${row.id}', null, loadBanners)"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        </div>`;
    });
  } catch (e) {
    list.innerHTML = emptyState('fa-triangle-exclamation', e.message || 'خطأ');
  }
};

// === Orders ===
window.loadOrders = async (status) => {
  const list = document.getElementById(
    status === 'pending' ? 'orders-list' : 'accepted-orders-list',
  );
  list.innerHTML = loadingState();
  try {
    let rows = [];
    if (status === 'pending') {
      rows = (await OrdersApi.list('PENDING')) || [];
    } else {
      const all = await Promise.all(
        ACTIVE_ORDER_STATUSES.map((s) => OrdersApi.list(toApiStatus(s))),
      );
      rows = all.flat().filter(Boolean);
      const seen = new Set();
      rows = rows.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
    }

    list.innerHTML = '';
    if (!rows.length) {
      list.innerHTML = emptyState(
        status === 'pending' ? 'fa-inbox' : 'fa-truck',
        status === 'pending' ? 'لا توجد طلبات قيد الانتظار' : 'لا توجد طلبات نشطة',
      );
      if (status === 'pending') {
        lastPendingCount = 0;
        updatePendingBadgeFromCount(0);
      }
      return;
    }

    const sortMode = status === 'pending' ? 'pending' : 'active';
    sortOrdersNewestFirst(rows, sortMode).forEach((data) => {
      let itemsHtml = '';
      (data.items || []).forEach((item) => {
        itemsHtml += `<div class="order-item-row">
                <img src="${escapeHtml(item.image || '')}" alt="" onerror="this.style.display='none'">
                <span>${escapeHtml(item.name)} <strong>×${item.qty}</strong></span>
            </div>`;
      });
      const uiStatus = toUiStatus(data.status);
      list.innerHTML += `<div class="card-3d order-card">
            <div class="order-card-header">
                <div>
                    <div class="card-title order-customer-name">${escapeHtml(data.name)}</div>
                    <div class="order-meta"><i class="fa-solid fa-phone"></i> ${escapeHtml(data.phone)}</div>
                </div>
                <span class="order-status ${uiStatus}">${getOrderStatusLabel(data.status)}</span>
            </div>
            ${buildOrderAddressHtml(data.address)}
            <div class="order-meta"><strong>تاريخ الطلب:</strong> ${formatOrderDateTime(data.createdAt)}</div>
            ${data.isScheduled && data.scheduledAt ? `<div class="order-meta order-scheduled"><strong>⏰ توصيل مجدول:</strong> ${formatOrderDateTime(data.scheduledAt)}</div>` : ''}
            ${data.statusUpdatedAt ? `<div class="order-meta"><strong>آخر تحديث:</strong> ${formatOrderDateTime(data.statusUpdatedAt)}</div>` : ''}
            <div class="order-items">${itemsHtml || '<div class="order-meta">لا توجد تفاصيل</div>'}</div>
            <div class="order-total">الإجمالي: ${num(data.total).toLocaleString('ar-IQ')} د.ع</div>
            <div class="order-actions">${buildOrderActionButtons(data.id, data.status, status)}</div>
        </div>`;
    });

    if (status === 'pending') {
      lastPendingCount = rows.length;
      updatePendingBadgeFromCount(rows.length);
    }
  } catch (e) {
    list.innerHTML = emptyState('fa-triangle-exclamation', e.message || 'خطأ');
  }
};

window.updateOrderStatus = async (id, nextStatus, reloadStatus = 'accepted') => {
  try {
    await OrdersApi.updateStatus(id, toApiStatus(nextStatus));
    window.showCustomAlert(`تم تغيير الحالة إلى: ${getOrderStatusLabel(nextStatus)}`);
    if (reloadStatus === 'pending' && nextStatus !== 'pending') {
      await window.loadOrders('pending');
      if (ACTIVE_ORDER_STATUSES.includes(nextStatus)) {
        await window.loadOrders('accepted');
      }
      return;
    }
    window.loadOrders(reloadStatus);
  } catch (e) {
    showCustomAlert(e.message || 'تعذر تحديث الحالة');
  }
};

window.acceptOrder = async (id) => {
  await window.updateOrderStatus(id, 'accepted', 'pending');
};

window.loadSales = async () => {
  const list = document.getElementById('sales-list');
  list.innerHTML = loadingState();
  try {
    const all = await Promise.all(
      ACTIVE_ORDER_STATUSES.map((s) => OrdersApi.list(toApiStatus(s))),
    );
    const rows = all.flat().filter(Boolean);
    const seen = new Set();
    const unique = rows.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
    let total = 0;
    unique.forEach((o) => {
      total += num(o.total);
    });
    list.innerHTML = `<div class="sales-card card-3d">
        <h3><i class="fa-solid fa-sack-dollar"></i> إجمالي المبيعات النشطة</h3>
        <h2>${total.toLocaleString('ar-IQ')} د.ع</h2>
        <p style="margin-top:0.75rem;opacity:0.85;font-size:0.85rem">${unique.length} طلب نشط</p>
    </div>`;
  } catch (e) {
    list.innerHTML = emptyState('fa-triangle-exclamation', e.message || 'خطأ');
  }
};

window.resetSales = async () => {
  showCustomAlert('تصفير المبيعات غير متاح حالياً على الـ API — قريباً');
};

window.deleteDocItem = async (col, id, unused, cb) => {
  if (!confirm('متأكد من الحذف؟')) return;
  try {
    if (col === 'categories') await CategoriesApi.remove(id);
    else if (col === 'products') await ProductsApi.remove(id);
    else if (col === 'banners') await BannersApi.remove(id);
    else if (col === 'offers') await OffersApi.remove(id);
    else if (col === 'orders') {
      showCustomAlert('حذف الطلبات غير متاح حالياً');
      return;
    } else {
      showCustomAlert('حذف غير مدعوم');
      return;
    }
    if (cb) cb();
  } catch (e) {
    showCustomAlert(e.message || 'تعذر الحذف');
  }
};

window.loadPushTokenStats = async () => {
  const statsEl = document.getElementById('push-token-stats');
  if (!statsEl) return;
  statsEl.innerHTML = `<div class="sales-card card-3d push-stats-card">
        <h3><i class="fa-solid fa-mobile-screen"></i> أجهزة الإشعارات</h3>
        <p class="order-meta">إحصائيات الدفع ستُربط بعد تفعيل Expo Push على الـ API</p>
    </div>`;
};

window.sendBroadcastNotification = async () => {
  const title = document.getElementById('broadcast-title')?.value?.trim();
  const body = document.getElementById('broadcast-body')?.value?.trim();
  if (!title || !body) return showCustomAlert('أدخل عنوان ونص الإشعار');
  const btn = document.getElementById('btn-send-broadcast');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';
  }
  try {
    await NotificationsApi.broadcast(title, body);
    showCustomAlert('تم حفظ البث في قاعدة البيانات (بدون Push بعد)');
    document.getElementById('broadcast-title').value = '';
    document.getElementById('broadcast-body').value = '';
  } catch (e) {
    showCustomAlert(e.message || 'تعذر الإرسال');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> إرسال للجميع';
    }
  }
};

window.loadNotificationsHistory = async () => {
  const list = document.getElementById('notifications-history-list');
  if (!list) return;
  list.innerHTML = emptyState(
    'fa-bell',
    'سجل الإشعارات الكامل سيُضاف قريباً على الـ API',
  );
};

window.sendUserNotification = async () => {
  showCustomAlert('إشعار لمستخدم محدد سيُضاف قريباً على الـ API');
};

// stubs used by leftover HTML buttons
window.enableBrowserNotifications = async () => {
  if (!('Notification' in window)) return;
  await Notification.requestPermission();
};
window.setupWebPushNotifications = async () => {};
window.updatePwaInstallButtons = () => {};

initAdminSession();
