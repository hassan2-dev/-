// ============================================================
// ⚠️ نسخة محدّثة من سكربت الأدمن — تدعم Incremental Sync
// ============================================================
// التغييرات الأساسية:
// 1. كل حفظ/تعديل يكتب updatedAt: serverTimestamp()
// 2. كل حذف يكتب tombstone في deletions/ قبل الحذف الفعلي
// 3. meta/version.updatedAt يستخدم serverTimestamp() لمزامنة الفلاتر
// 4. لا توجد قراءات إضافية على الأدمن — التغيير فقط للكتابة
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, deleteDoc, updateDoc, doc, setDoc, serverTimestamp, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { FIREBASE_CONFIG, ADMIN_NOTIFY_SECRET } from './firebase-config.js';
import { initAdminFcm, isAdminFcmReady } from './fcm-admin.js';
import { initWebPush, isWebPushReady } from './web-push-admin.js';

const CONFIG = {
    FIREBASE_CONFIG,
};

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const db = getFirestore(app);
const ADMIN_ICON_URL = `${window.location.origin}/assets/icon.png`;
let allProducts = [];

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendExpoPushBatch(messages) {
    if (!messages.length) return { sent: 0, errors: 0 };
    const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
    });
    const data = await response.json();
    const tickets = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [data];
    const errors = tickets.filter((ticket) => ticket?.status === 'error').length;
    return { sent: messages.length - errors, errors };
}

async function fetchAllPushTokens() {
    const snap = await getDocs(collection(db, 'push_tokens'));
    const tokens = [];
    snap.forEach((docSnap) => {
        const token = docSnap.data()?.token;
        if (token) tokens.push(token);
    });
    return [...new Set(tokens)];
}

async function fetchPushTokensForUser(email, phone) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedPhone = (phone || '').trim();
    if (!normalizedEmail && !normalizedPhone) return [];

    const snap = await getDocs(collection(db, 'push_tokens'));
    const tokens = [];
    snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const token = data.token;
        const tokenEmail = String(data.email || '').trim().toLowerCase();
        const tokenPhone = String(data.phone || '').trim();
        const matches =
            (normalizedEmail && tokenEmail === normalizedEmail) ||
            (normalizedPhone && tokenPhone === normalizedPhone);
        if (token && matches) tokens.push(token);
    });
    return [...new Set(tokens)];
}

async function deliverExpoPush({ title, body, tokens, data = {} }) {
    const uniqueTokens = [...new Set((tokens || []).filter(Boolean))];
    if (!uniqueTokens.length) return { sent: 0, errors: 0 };

    const messages = uniqueTokens.map((to) => ({
        to,
        title,
        body,
        data,
        sound: 'default',
        channelId: 'orders',
    }));

    let sent = 0;
    let errors = 0;
    for (let i = 0; i < messages.length; i += 100) {
        const chunk = messages.slice(i, i + 100);
        const result = await sendExpoPushBatch(chunk);
        sent += result.sent;
        errors += result.errors;
    }
    return { sent, errors };
}

async function pushToUser({ email, phone, title, body, data }) {
    const tokens = await fetchPushTokensForUser(email, phone);
    return deliverExpoPush({ title, body, tokens, data });
}

async function pushToAllUsers({ title, body, data }) {
    const tokens = await fetchAllPushTokens();
    return deliverExpoPush({ title, body, tokens, data });
}

async function createInAppNotification(payload) {
    await addDoc(collection(db, 'notifications'), {
        ...payload,
        read: false,
        createdAt: serverTimestamp(),
    });
}

// ✅ تحديث meta/version باستخدام serverTimestamp لمطابقة الفلاتر في التطبيق
async function bumpDataVersion() {
    try {
        await setDoc(doc(db, "meta", "version"), {
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error('bumpDataVersion failed', e);
    }
}

// ✅ تسجيل tombstone قبل الحذف الفعلي
async function recordDeletion(collectionName, docId) {
    try {
        await addDoc(collection(db, "deletions"), {
            collection: collectionName,
            docId: docId,
            deletedAt: serverTimestamp()
        });
    } catch (e) {
        console.error('recordDeletion failed', e);
    }
}

// === إعدادات حالات الطلب الجديدة ===
const ACTIVE_ORDER_STATUSES = ['accepted', 'preparing', 'on_the_way'];
const ORDER_STATUS_LABELS = {
    pending: 'قيد الانتظار',
    accepted: 'تمت الموافقة',
    preparing: 'قيد التجهيز',
    on_the_way: 'في التوصيل'
};

const formatOrderDateTime = (value) => {
    if (!value) return 'غير متوفر';
    let date = null;
    if (typeof value?.toDate === 'function') {
        date = value.toDate();
    } else if (typeof value === 'string' || typeof value === 'number') {
        date = new Date(value);
    } else if (value?.seconds) {
        date = new Date(value.seconds * 1000);
    }
    if (!date || Number.isNaN(date.getTime())) return 'غير متوفر';
    return new Intl.DateTimeFormat('ar-IQ', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
};

const getOrderStatusLabel = (status) => ORDER_STATUS_LABELS[status] || status || 'غير معروف';

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
            <div class="order-address-item">
                <span class="order-address-label">البلوك</span>
                <span class="order-address-value">${escapeHtml(parsed.block)}</span>
            </div>
            <div class="order-address-item">
                <span class="order-address-label">البناية</span>
                <span class="order-address-value">${escapeHtml(building)}</span>
            </div>
            <div class="order-address-item">
                <span class="order-address-label">الطابق</span>
                <span class="order-address-value">${escapeHtml(floorLabel)}</span>
            </div>
            <div class="order-address-item">
                <span class="order-address-label">الشقة</span>
                <span class="order-address-value">${escapeHtml(apartment)}</span>
            </div>
        </div>
    </div>`;
};

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

const buildOrderActionButtons = (id, status, reloadStatus) => {
    const buttons = [];
    if (status === 'pending') {
        buttons.push(`<button class="btn-action accept" onclick="window.updateOrderStatus('${id}', 'accepted', '${reloadStatus}')"><i class="fa-solid fa-check"></i> موافقة</button>`);
        buttons.push(`<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'preparing', '${reloadStatus}')"><i class="fa-solid fa-kitchen-set"></i> تجهيز</button>`);
        buttons.push(`<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'on_the_way', '${reloadStatus}')"><i class="fa-solid fa-truck"></i> توصيل</button>`);
    } else if (status === 'accepted') {
        buttons.push(`<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'preparing', '${reloadStatus}')"><i class="fa-solid fa-kitchen-set"></i> تجهيز</button>`);
        buttons.push(`<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'on_the_way', '${reloadStatus}')"><i class="fa-solid fa-truck"></i> توصيل</button>`);
    } else if (status === 'preparing') {
        buttons.push(`<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'on_the_way', '${reloadStatus}')"><i class="fa-solid fa-truck"></i> توصيل</button>`);
    }
    buttons.push(`<button class="btn-action delete" onclick="deleteDocItem('orders', '${id}', null, () => window.loadOrders('${reloadStatus}'))"><i class="fa-solid fa-trash"></i> حذف</button>`);
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
    if(!document.getElementById('alert-styles')){
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

async function compressImage(file, maxWidth = 1000, quality = 0.8) {
    if (!file) return null;
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let scaleSize = 1;
                if (img.width > maxWidth) scaleSize = maxWidth / img.width;
                canvas.width = img.width * scaleSize;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        };
        reader.onerror = error => reject(error);
    });
}

async function uploadToBunny(base64DataUrl) {
    const STORAGE_ZONE_NAME = "2222";
    const ACCESS_KEY = "4777a31f-e6fe-4288-8180acda8543-7590-4b06";
    const PULL_ZONE_URL = "https://tufahat2222.b-cdn.net";

    const response = await fetch(base64DataUrl);
    const blob = await response.blob();

    const fileName = Date.now() + "_" + Math.floor(Math.random() * 1000) + ".jpg";
    const uploadUrl = `https://storage.bunnycdn.com/${STORAGE_ZONE_NAME}/${fileName}`;

    try {
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'AccessKey': ACCESS_KEY,
                'Content-Type': 'application/octet-stream',
            },
            body: blob
        });
        if (uploadResponse.ok) return `${PULL_ZONE_URL}/${fileName}`;
        console.error("Bunny.net Error:", await uploadResponse.text());
        return null;
    } catch (error) {
        console.error("Upload Error:", error);
        return null;
    }
}

async function uploadImageGetUrl(file, maxWidth = 1000, quality = 0.8) {
    const compressed = await compressImage(file, maxWidth, quality);
    const url = await uploadToBunny(compressed);
    if (!url) throw new Error('فشل رفع الصورة إلى سيرفرات Bunny.net');
    return url;
}

const ADMIN_SESSION_KEY = 'tufaha_admin_session_v1';

function enterAdminDashboard(initialTab = 'orders') {
    const overlay = document.getElementById('login-overlay');
    const app = document.getElementById('app-content');
    if (!overlay || !app) return;

    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
        app.style.display = 'block';
        switchTab(initialTab);
        startOrderRealtimeAlerts();
        setupWebPushNotifications().catch(() => {});
    }, 300);
}

function showLoginScreen() {
    stopOrderRealtimeAlerts();
    lastPendingCount = null;
    localStorage.removeItem(ADMIN_SESSION_KEY);
    const overlay = document.getElementById('login-overlay');
    const app = document.getElementById('app-content');
    if (app) app.style.display = 'none';
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
    }
    const passInput = document.getElementById('admin-pass');
    if (passInput) passInput.value = '';
}

window.logoutAdmin = () => {
    if (!confirm('تسجيل الخروج من لوحة الإدارة؟')) return;
    showLoginScreen();
};

window.verifyAdmin = () => {
    const pass = document.getElementById('admin-pass')?.value;
    if (pass === '1001') {
        localStorage.setItem(ADMIN_SESSION_KEY, '1');
        enterAdminDashboard('orders');
    } else {
        alert('رمز الدخول غير صحيح!');
    }
};

function initAdminSession() {
    if (localStorage.getItem(ADMIN_SESSION_KEY) === '1') {
        enterAdminDashboard('orders');
    }
}

window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    const activeNavItem = document.querySelector(`.nav-item[onclick*="switchTab('${tabId}')"]`);
    if (activeNavItem) activeNavItem.classList.add('active');
    if (typeof window.setAdminPageTitle === 'function') window.setAdminPageTitle(tabId);
    if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);

    if(tabId === 'categories') loadCategories();
    if(tabId === 'products') { loadCategoriesForSelect(); loadProducts(); }
    if(tabId === 'offers') loadOffers();
    if(tabId === 'discount-offers') loadDiscountProducts();
    if(tabId === 'banners') loadBanners();
    if(tabId === 'orders') loadOrders('pending');
    if(tabId === 'accepted-orders') loadOrders('accepted');
    if(tabId === 'sales') loadSales();
    if(tabId === 'notifications') {
        loadPushTokenStats();
        loadNotificationsHistory();
        updatePwaStatusBanner({ ok: isWebPushReady() });
    }
    if(tabId === 'store-settings') loadStoreSettings();
};

let lastPendingCount = null;
let ordersUnsubscribe = null;
let ordersAlertsReady = false;
const ordersState = new Map();
const locallyUpdatedOrders = new Set();
const recentOrderAlerts = new Set();

function alertOrderOnce(key, fn) {
    if (recentOrderAlerts.has(key)) return;
    recentOrderAlerts.add(key);
    setTimeout(() => recentOrderAlerts.delete(key), 8000);
    fn();
}

function updatePendingBadgeFromCount(count) {
    const badge = document.getElementById('pending-orders-badge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function updateBrowserNotifButton() {
    const btn = document.getElementById('enable-browser-notif-btn');
    if (!btn) return;
    const canNotify = 'Notification' in window;
    const granted = canNotify && Notification.permission === 'granted' && isWebPushReady();
    btn.classList.toggle('hidden', !canNotify || granted);
}

const ADMIN_NOTIFY_API = `${window.location.origin}/api/notify-order`;

let deferredPwaInstall = null;

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPwaInstall = event;
    document.querySelectorAll('#pwa-install-btn, #pwa-install-btn-panel').forEach((btn) => {
        btn.classList.remove('hidden');
    });
});

window.installPwaApp = async () => {
    if (!deferredPwaInstall) {
        showCustomAlert('ثبّت التطبيق من قائمة المتصفح: Add to Home Screen / تثبيت');
        return;
    }
    deferredPwaInstall.prompt();
    const { outcome } = await deferredPwaInstall.userChoice;
    deferredPwaInstall = null;
    if (outcome === 'accepted') {
        showAdminToast('تم تثبيت التطبيق', 'افتح تفاحة من الشاشة الرئيسية', 'new');
    }
};

async function sendAdminPushNotify({ title, body, data = {} }) {
    if (!ADMIN_NOTIFY_SECRET) return { ok: false };
    try {
        const response = await fetch(ADMIN_NOTIFY_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-notify-secret': ADMIN_NOTIFY_SECRET,
            },
            body: JSON.stringify({ title, body, data }),
        });
        return await response.json();
    } catch (error) {
        console.warn('[notify-api]', error);
        return { ok: false };
    }
}

async function setupWebPushNotifications() {
    const result = await initWebPush(db);
    updatePwaStatusBanner(result);
    updateBrowserNotifButton();
    return result;
}

window.requestAdminBrowserNotifications = async () => {
    const result = await setupWebPushNotifications();
    if (result.ok) {
        showAdminToast('تم تفعيل Web Push', 'ثبّت التطبيق (PWA) ثم جرّب إغلاقه وإرسال طلب', 'new');
        return;
    }
    if (result.reason === 'denied') {
        showCustomAlert('اسمح بالإشعارات من إعدادات المتصفح');
        return;
    }
    showCustomAlert(result.detail || 'تعذر تفعيل الإشعارات');
};

window.setupAdminFcmLegacy = async () => {
    const result = await initAdminFcm(app, db, {
        onForegroundMessage: ({ title, body, type }) => {
            showAdminToast(title, body, type === 'update' ? 'update' : 'new');
        },
    });
    if (result.ok) {
        showAdminToast('تم تفعيل Firebase FCM', 'يحتاج Blaze + Cloud Functions للإشعارات بالخلفية', 'new');
        return;
    }
    if (result.reason === 'denied') {
        showCustomAlert('اسمح بالإشعارات من إعدادات المتصفح');
        return;
    }
    showCustomAlert(result.detail || 'تعذر تفعيل Firebase — استخدم Web Push أعلاه');
};

function updatePwaStatusBanner(result) {
    const el = document.getElementById('fcm-status-banner');
    if (!el) return;

    if (result?.ok || isWebPushReady()) {
        el.className = 'fcm-status-banner success';
        el.innerHTML = '<i class="fa-solid fa-circle-check"></i> Web Push مفعّل — ثبّت التطبيق (PWA) وجرّب إغلاقه';
        return;
    }

    if (result?.reason === 'denied') {
        el.className = 'fcm-status-banner warning';
        el.innerHTML = '<i class="fa-solid fa-bell-slash"></i> اسمح بالإشعارات ثم اضغط التفعيل';
        return;
    }

    el.className = 'fcm-status-banner muted';
    el.innerHTML = '<i class="fa-solid fa-mobile-screen"></i> فعّل Web Push وثبّت التطبيق (PWA) على جهازك';
}

function showAdminToast(title, body, type = 'new') {
    const toast = document.createElement('div');
    toast.className = `admin-toast admin-toast-${type}`;
    toast.innerHTML = `
        <div class="admin-toast-title">${escapeHtml(title)}</div>
        <div class="admin-toast-body">${escapeHtml(body)}</div>
    `;
    document.body.appendChild(toast);

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
        toast.style.animation = 'fadeOutUp 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

function playAdminAlertSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
    } catch {
        // تجاهل — قد يحتاج تفاعل المستخدم أولاً
    }
}

function showAdminBrowserNotification({ title, body, tabId = 'orders' }) {
    showAdminToast(title, body, tabId === 'orders' ? 'new' : 'update');
    playAdminAlertSound();

    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            const notification = new Notification(title, {
                body,
                icon: ADMIN_ICON_URL,
                badge: ADMIN_ICON_URL,
                tag: `tufaha-admin-${Date.now()}`,
                requireInteraction: true,
            });
            notification.onclick = () => {
                window.focus();
                notification.close();
                switchTab(tabId);
            };
        } catch {
            // المتصفح قد يمنع الإشعار
        }
    }
}

function refreshVisibleOrdersTab() {
    const ordersTab = document.getElementById('orders');
    const acceptedTab = document.getElementById('accepted-orders');
    if (ordersTab?.classList.contains('active')) loadOrders('pending');
    if (acceptedTab?.classList.contains('active')) loadOrders('accepted');
}

function startOrderRealtimeAlerts() {
    stopOrderRealtimeAlerts();
    ordersAlertsReady = false;
    ordersState.clear();
    updateBrowserNotifButton();

    ordersUnsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
        const pendingCount = snapshot.docs.filter(
            (docSnap) => (docSnap.data().status || 'pending') === 'pending'
        ).length;
        updatePendingBadgeFromCount(pendingCount);
        lastPendingCount = pendingCount;

        if (!ordersAlertsReady) {
            snapshot.docs.forEach((docSnap) => {
                ordersState.set(docSnap.id, docSnap.data().status || 'pending');
            });
            ordersAlertsReady = true;
            refreshVisibleOrdersTab();
            return;
        }

        let shouldRefresh = false;

        snapshot.docChanges().forEach((change) => {
            const data = change.doc.data();
            const id = change.doc.id;
            const status = data.status || 'pending';
            const customerName = data.name || 'زبون';
            const total = `${Number(data.total || 0).toLocaleString('ar-IQ')} د.ع`;

            if (change.type === 'added' && status === 'pending') {
                alertOrderOnce(`snap-new-${id}`, () => {
                    showAdminBrowserNotification({
                        title: '📦 طلب جديد',
                        body: `${customerName} — ${total}`,
                        tabId: 'orders',
                    });
                    sendAdminPushNotify({
                        title: '📦 طلب جديد',
                        body: `${customerName} — ${total}`,
                        data: { type: 'new_order', orderId: id },
                    }).catch(() => {});
                });
                shouldRefresh = true;
            } else if (change.type === 'modified') {
                const prevStatus = ordersState.get(id);
                if (prevStatus && prevStatus !== status && !locallyUpdatedOrders.has(id)) {
                    alertOrderOnce(`snap-upd-${id}-${status}`, () => {
                        showAdminBrowserNotification({
                            title: '🔄 تحديث طلب',
                            body: `${customerName}: ${getOrderStatusLabel(prevStatus)} → ${getOrderStatusLabel(status)}`,
                            tabId: status === 'pending' ? 'orders' : 'accepted-orders',
                        });
                    });
                    shouldRefresh = true;
                }
            } else if (change.type === 'removed') {
                shouldRefresh = true;
            }

            if (change.type === 'removed') {
                ordersState.delete(id);
            } else {
                ordersState.set(id, status);
            }
        });

        if (shouldRefresh) refreshVisibleOrdersTab();
    }, (error) => {
        console.error('orders listener failed', error);
        showCustomAlert('تعذر الاتصال بمتابعة الطلبات — تحقق من الإنترنت');
    });
}

function stopOrderRealtimeAlerts() {
    if (ordersUnsubscribe) {
        ordersUnsubscribe();
        ordersUnsubscribe = null;
    }
    ordersAlertsReady = false;
    ordersState.clear();
    locallyUpdatedOrders.clear();
    updatePendingBadgeFromCount(0);
}

// === أوقات العمل ===
window.loadStoreSettings = async () => {
    const snap = await getDoc(doc(db, 'settings', 'store'));
    const data = snap.data() || {};
    const openEl = document.getElementById('store-open');
    const closeEl = document.getElementById('store-close');
    const enabledEl = document.getElementById('store-enabled');
    if (openEl) openEl.value = data.openTime || '08:30';
    if (closeEl) closeEl.value = data.closeTime || '02:00';
    if (enabledEl) enabledEl.checked = data.enabled !== false;
};

window.saveStoreSettings = async () => {
    const openTime = document.getElementById('store-open')?.value || '08:30';
    const closeTime = document.getElementById('store-close')?.value || '02:00';
    const enabled = document.getElementById('store-enabled')?.checked !== false;
    await setDoc(doc(db, 'settings', 'store'), {
        openTime,
        closeTime,
        timezone: 'Asia/Baghdad',
        enabled,
        updatedAt: serverTimestamp(),
    }, { merge: true });
    await bumpDataVersion();
    showCustomAlert('تم حفظ أوقات العمل');
};

// === الأقسام ===
window.saveCategory = async () => {
    const id = document.getElementById('cat-id').value;
    const name = document.getElementById('cat-name').value;
    const parentId = document.getElementById('cat-parent')?.value || '';
    const file = document.getElementById('cat-img').files[0];
    if (!name) return showCustomAlert('أدخل اسم القسم');
    const btn = document.getElementById('btn-save-cat');
    btn.innerText = 'جاري الرفع...';

    try {
        let updateData = { name, updatedAt: serverTimestamp() };
        if (parentId) updateData.parentId = parentId;
        else updateData.parentId = '';
        if (file) {
            updateData.image = await uploadImageGetUrl(file, 400, 0.7);
        }
        if (id) await updateDoc(doc(db, "categories", id), updateData);
        else {
            if (!file) throw new Error('اختر صورة للقسم');
            await addDoc(collection(db, "categories"), { ...updateData, createdAt: serverTimestamp() });
        }
        showCustomAlert('تم حفظ القسم');
        await bumpDataVersion();
        switchTab('categories');
        document.getElementById('cat-id').value = '';
        document.getElementById('cat-name').value = '';
        document.getElementById('cat-img').value = '';
        if (document.getElementById('cat-parent')) document.getElementById('cat-parent').value = '';
    } catch (e) { showCustomAlert(e.message); }
    btn.innerHTML = 'حفظ القسم <i class="fa-solid fa-save"></i>';
};

window.loadParentCategoriesForSelect = async (selectId, selectedId = '') => {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">قسم رئيسي — بدون أب</option>';
    const snapshot = await getDocs(collection(db, "categories"));
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.parentId) return;
        const selected = selectedId === docSnap.id ? 'selected' : '';
        select.innerHTML += `<option value="${docSnap.id}" ${selected}>${escapeHtml(data.name)}</option>`;
    });
};

window.loadCategories = async () => {
    const list = document.getElementById('categories-list');
    list.innerHTML = loadingState();
    await loadParentCategoriesForSelect('cat-parent');
    const snapshot = await getDocs(collection(db, "categories"));
    const allCats = [];
    snapshot.forEach(docSnap => allCats.push({ id: docSnap.id, ...docSnap.data() }));
    const parentMap = Object.fromEntries(allCats.filter(c => !c.parentId).map(c => [c.id, c.name]));
    list.innerHTML = '';
    if (snapshot.empty) {
        list.innerHTML = emptyState('fa-layer-group', 'لا توجد أقسام بعد');
        return;
    }
    allCats.forEach(data => {
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
    const snapshot = await getDocs(collection(db, "categories"));
    const allCats = [];
    snapshot.forEach(docSnap => allCats.push({ id: docSnap.id, ...docSnap.data() }));
    const parentMap = Object.fromEntries(allCats.filter(c => !c.parentId).map(c => [c.id, c.name]));
    allCats.forEach(data => {
        const prefix = data.parentId && parentMap[data.parentId] ? `${parentMap[data.parentId]} › ` : '';
        select.innerHTML += `<option value="${escapeHtml(data.name)}">${prefix}${escapeHtml(data.name)}</option>`;
    });
};

// === المنتجات ===
window.saveProduct = async () => {
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value;
    const cat = document.getElementById('prod-cat').value;
    const desc = document.getElementById('prod-desc').value;
    const price = document.getElementById('prod-price').value;
    const files = document.getElementById('prod-images').files;

    if (!name || !price) return showCustomAlert('أكمل البيانات');
    const btn = document.getElementById('btn-save-prod');
    btn.innerText = 'جاري الرفع...';

    try {
        // ✅ كل حفظ/تعديل يكتب updatedAt
        let updateData = { name, category: cat, desc, price: Number(price), updatedAt: serverTimestamp() };

        if (files.length > 0) {
            const url1 = await uploadImageGetUrl(files[0], 800, 0.75);
            updateData.images = [{ id: 'img_' + Date.now(), data: url1 }];
            updateData.image = url1;
            updateData.image1 = url1;
            if (files[1]) {
                const url2 = await uploadImageGetUrl(files[1], 800, 0.75);
                updateData.image2 = url2;
            }
        }

        if (id) await updateDoc(doc(db, "products", id), updateData);
        else await addDoc(collection(db, "products"), { ...updateData, createdAt: serverTimestamp() });

        showCustomAlert('تم حفظ المنتج بنجاح');
        await bumpDataVersion();
        switchTab('products');
        document.getElementById('prod-id').value = '';
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-desc').value = '';
        document.getElementById('prod-price').value = '';
        document.getElementById('prod-images').value = '';
    } catch (e) { showCustomAlert(e.message || 'خطأ في الحفظ'); console.error(e); }
    btn.innerHTML = 'حفظ المنتج <i class="fa-solid fa-save"></i>';
};

window.loadProducts = async () => {
    const list = document.getElementById('products-list');
    list.innerHTML = loadingState();
    const snapshot = await getDocs(collection(db, "products"));
    list.innerHTML = '';
    if (snapshot.empty) {
        list.innerHTML = emptyState('fa-box', 'لا توجد منتجات بعد');
        return;
    }
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const imgSrc = (data.images && data.images.length > 0) ? data.images[0].data : (data.image1 || data.image || '');
        const safeName = escapeHtml(data.name);
        const safeCat = escapeHtml(data.category || '');
        const safeDesc = escapeHtml(data.desc || '');
        list.innerHTML += `<div class="card-3d">
            <img src="${escapeHtml(imgSrc)}" alt="${safeName}" onerror="this.style.display='none'">
            <div class="card-title">${safeName}</div>
            <div class="card-price">${Number(data.price).toLocaleString('ar-IQ')} د.ع</div>
            ${safeCat ? `<div style="font-size:0.78rem;color:#94A396;margin-bottom:4px">${safeCat}</div>` : ''}
            <div class="card-actions">
                <button class="btn-action edit" onclick="editProduct('${docSnap.id}', '${jsStr(data.name)}', '${jsStr(data.category)}', '${jsStr(data.desc)}', '${data.price}')"><i class="fa-solid fa-pen"></i> تعديل</button>
                <button class="btn-action delete" onclick="deleteDocItem('products', '${docSnap.id}', null, loadProducts)"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        </div>`;
    });
};

window.editProduct = (id, name, cat, desc, price) => {
    document.getElementById('prod-id').value = id;
    document.getElementById('prod-name').value = name;
    document.getElementById('prod-cat').value = cat;
    document.getElementById('prod-desc').value = desc;
    document.getElementById('prod-price').value = price;
    document.getElementById('btn-save-prod').innerText = 'تحديث المنتج';
    window.scrollTo(0, 0);
};

// === الخصومات ===
window.loadDiscountProducts = async () => {
    const selectList = document.getElementById('discount-products-select-list');
    const discountList = document.getElementById('discounted-products-list');
    selectList.innerHTML = loadingState();
    discountList.innerHTML = '';
    const snapshot = await getDocs(collection(db, "products"));
    allProducts = [];
    selectList.innerHTML = '';
    let hasSelectable = false;
    let hasDiscounted = false;
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        allProducts.push({ id: docSnap.id, ...data });
        const imgSrc = (data.images && data.images.length > 0) ? data.images[0].data : (data.image1 || '');
        const safeName = escapeHtml(data.name);
        if (!data.hasDiscount) {
            hasSelectable = true;
            selectList.innerHTML += `<label class="card-3d discount-select-card">
                <input type="checkbox" class="discount-checkbox" value="${docSnap.id}">
                <img src="${escapeHtml(imgSrc)}" alt="${safeName}" onerror="this.style.display='none'">
                <div class="card-title" style="font-size:0.85rem">${safeName}</div>
                <div class="card-price">${Number(data.price).toLocaleString('ar-IQ')} د.ع</div>
            </label>`;
        } else {
            hasDiscounted = true;
            discountList.innerHTML += `<div class="card-3d">
                <img src="${escapeHtml(imgSrc)}" alt="${safeName}">
                <div class="card-title">${safeName}</div>
                <div class="card-price-old">${Number(data.originalPrice).toLocaleString('ar-IQ')} د.ع</div>
                <div class="card-price-discount">${Number(data.price).toLocaleString('ar-IQ')} د.ع (-${data.discountPercent}%)</div>
                <div class="card-actions">
                    <button class="btn-action remove-discount" onclick="removeDiscount('${docSnap.id}', ${data.originalPrice})"><i class="fa-solid fa-xmark"></i> إلغاء الخصم</button>
                </div>
            </div>`;
        }
    });
    if (!hasSelectable) selectList.innerHTML = emptyState('fa-percent', 'كل المنتجات لديها خصم أو لا توجد منتجات');
    if (!hasDiscounted) discountList.innerHTML = emptyState('fa-tag', 'لا توجد منتجات بخصم حالياً');
};

window.applyDiscountToSelected = async () => {
    const percent = document.getElementById('discount-percent').value;
    const checkboxes = document.querySelectorAll('.discount-checkbox:checked');
    if (!percent || checkboxes.length === 0) return showCustomAlert('أكمل بيانات الخصم');
    for (let cb of checkboxes) {
        const product = allProducts.find(p => p.id === cb.value);
        if (product) {
            const originalPrice = product.price;
            const newPrice = Math.round(originalPrice - (originalPrice * (percent / 100)));
            // ✅ تحديث updatedAt مع كل تطبيق خصم
            await updateDoc(doc(db, "products", product.id), {
                price: newPrice,
                originalPrice: originalPrice,
                hasDiscount: true,
                discountPercent: percent,
                updatedAt: serverTimestamp()
            });
        }
    }
    showCustomAlert('تم تطبيق الخصم');
    await bumpDataVersion();
    loadDiscountProducts();
};

window.removeDiscount = async (id, originalPrice) => {
    // ✅ تحديث updatedAt مع كل إزالة خصم
    await updateDoc(doc(db, "products", id), {
        price: originalPrice,
        originalPrice: null,
        hasDiscount: false,
        discountPercent: null,
        updatedAt: serverTimestamp()
    });
    await bumpDataVersion();
    loadDiscountProducts();
};

// === العروض والبنرات ===
window.saveOffer = async () => {
    const files = document.getElementById('offer-img').files;
    const btn = document.getElementById('btn-save-offer');
    btn.innerText = 'جاري الرفع...';
    try {
        for(let f of files) {
            const url = await uploadImageGetUrl(f, 900, 0.75);
            // ✅ updatedAt على كل عرض جديد
            await addDoc(collection(db, "offers"), {
                image: url,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        showCustomAlert('تم حفظ العروض');
        await bumpDataVersion();
        loadOffers();
    } catch(e) { showCustomAlert(e.message); }
    btn.innerHTML = 'حفظ العرض <i class="fa-solid fa-save"></i>';
};

window.loadOffers = async () => {
    const list = document.getElementById('offers-list');
    list.innerHTML = loadingState();
    const snapshot = await getDocs(collection(db, "offers"));
    list.innerHTML = '';
    if (snapshot.empty) {
        list.innerHTML = emptyState('fa-tags', 'لا توجد عروض بعد');
        return;
    }
    snapshot.forEach(docSnap => {
        list.innerHTML += `<div class="card-3d">
            <img src="${escapeHtml(docSnap.data().image)}" alt="عرض">
            <div class="card-actions">
                <button class="btn-action delete" onclick="deleteDocItem('offers', '${docSnap.id}', null, loadOffers)"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        </div>`;
    });
};

window.saveBanner = async () => {
    const files = document.getElementById('banner-img').files;
    const btn = document.getElementById('btn-save-banner');
    btn.innerText = 'جاري الرفع...';
    try {
        for(let f of files) {
            const url = await uploadImageGetUrl(f, 1200, 0.8);
            // ✅ updatedAt على كل بنر جديد
            await addDoc(collection(db, "banners"), {
                image: url,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        showCustomAlert('تم حفظ البنرات');
        await bumpDataVersion();
        loadBanners();
    } catch(e) { showCustomAlert(e.message); }
    btn.innerHTML = 'حفظ البنر <i class="fa-solid fa-save"></i>';
};

window.loadBanners = async () => {
    const list = document.getElementById('banners-list');
    list.innerHTML = loadingState();
    const snapshot = await getDocs(collection(db, "banners"));
    list.innerHTML = '';
    if (snapshot.empty) {
        list.innerHTML = emptyState('fa-image', 'لا توجد بنرات بعد');
        return;
    }
    snapshot.forEach(docSnap => {
        list.innerHTML += `<div class="card-3d">
            <img src="${escapeHtml(docSnap.data().image)}" alt="بنر">
            <div class="card-actions">
                <button class="btn-action delete" onclick="deleteDocItem('banners', '${docSnap.id}', null, loadBanners)"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        </div>`;
    });
};

// === إدارة الطلبات والمبيعات ===
window.loadOrders = async (status) => {
    const list = document.getElementById(status === 'pending' ? 'orders-list' : 'accepted-orders-list');
    list.innerHTML = loadingState();
    const q = status === 'pending'
        ? query(collection(db, "orders"), where("status", "==", "pending"))
        : query(collection(db, "orders"), where("status", "in", ACTIVE_ORDER_STATUSES));

    const snapshot = await getDocs(q);
    list.innerHTML = '';
    if (snapshot.empty) {
        list.innerHTML = emptyState(
            status === 'pending' ? 'fa-inbox' : 'fa-truck',
            status === 'pending' ? 'لا توجد طلبات قيد الانتظار' : 'لا توجد طلبات نشطة'
        );
        if (status === 'pending') {
            lastPendingCount = 0;
            updatePendingBadgeFromCount(0);
        }
        return;
    }
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        let itemsHtml = '';
        data.items?.forEach(item => {
            itemsHtml += `<div class="order-item-row">
                <img src="${escapeHtml(item.image || '')}" alt="" onerror="this.style.display='none'">
                <span>${escapeHtml(item.name)} <strong>×${item.qty}</strong></span>
            </div>`;
        });

        const addressValue = data.address || data.Address || data.location || data.Location;
        const addressHtml = buildOrderAddressHtml(addressValue);
        const statusClass = data.status || 'pending';

        list.innerHTML += `<div class="card-3d order-card">
            <div class="order-card-header">
                <div>
                    <div class="card-title" style="text-align:right;margin-bottom:4px">${escapeHtml(data.name)}</div>
                    <div class="order-meta"><i class="fa-solid fa-phone"></i> ${escapeHtml(data.phone)}</div>
                </div>
                <span class="order-status ${statusClass}">${getOrderStatusLabel(data.status)}</span>
            </div>
            ${addressHtml}
            <div class="order-meta"><strong>تاريخ الطلب:</strong> ${formatOrderDateTime(data.createdAt)}</div>
            ${data.isScheduled && data.scheduledAt ? `<div class="order-meta" style="color:#2B7340;font-weight:700"><strong>⏰ توصيل مجدول:</strong> ${formatOrderDateTime(data.scheduledAt)}</div>` : ''}
            ${data.statusUpdatedAt ? `<div class="order-meta"><strong>آخر تحديث:</strong> ${formatOrderDateTime(data.statusUpdatedAt)}</div>` : ''}
            <div class="order-items">${itemsHtml || '<div class="order-meta">لا توجد تفاصيل</div>'}</div>
            <div class="order-total">الإجمالي: ${Number(data.total || 0).toLocaleString('ar-IQ')} د.ع</div>
            <div class="order-actions">${buildOrderActionButtons(docSnap.id, data.status, status)}</div>
        </div>`;
    });

    if (status === 'pending') {
        lastPendingCount = snapshot.size;
        updatePendingBadgeFromCount(snapshot.size);
    }
};

window.updateOrderStatus = async (id, nextStatus, reloadStatus = 'accepted') => {
    const orderSnap = await getDoc(doc(db, "orders", id));
    const orderData = orderSnap.data() || {};

    locallyUpdatedOrders.add(id);
    setTimeout(() => locallyUpdatedOrders.delete(id), 4000);

    await updateDoc(doc(db, "orders", id), {
        status: nextStatus,
        statusUpdatedAt: serverTimestamp(),
        updatedBy: 'admin',
    });

    const NOTIF_MSG = {
        accepted: { title: 'تم قبول طلبك ✅', body: 'تمت الموافقة على طلبك وسيتم تجهيزه قريباً' },
        preparing: { title: 'جاري تجهيز طلبك 👨‍🍳', body: 'طلبك قيد التجهيز الآن' },
        on_the_way: { title: 'طلبك في الطريق 🚚', body: 'السائق في طريقه إليك، استعد لاستلام الطلب' },
    };
    const msg = NOTIF_MSG[nextStatus];
    if (msg && (orderData.phone || orderData.email)) {
        await createInAppNotification({
            phone: orderData.phone || '',
            email: orderData.email || '',
            orderId: id,
            title: msg.title,
            body: msg.body,
            status: nextStatus,
        });

        try {
            const pushResult = await pushToUser({
                email: orderData.email,
                phone: orderData.phone,
                title: msg.title,
                body: msg.body,
                data: { orderId: id, status: nextStatus },
            });
            if (pushResult.sent === 0 && pushResult.errors === 0) {
                console.warn('No push tokens found for this customer');
            }
        } catch (e) {
            console.error('pushToUser failed', e);
        }
    }

    window.showCustomAlert(`تم تغيير الحالة إلى: ${getOrderStatusLabel(nextStatus)}`);
    window.loadOrders(reloadStatus);
};

window.acceptOrder = async (id) => {
    await window.updateOrderStatus(id, 'accepted', 'pending');
};

window.loadSales = async () => {
    const list = document.getElementById('sales-list');
    list.innerHTML = loadingState();
    const q = query(collection(db, "orders"), where("status", "in", ACTIVE_ORDER_STATUSES));
    const snapshot = await getDocs(q);
    let total = 0;
    snapshot.forEach(docSnap => { total += docSnap.data().total || 0; });
    list.innerHTML = `<div class="sales-card card-3d">
        <h3><i class="fa-solid fa-sack-dollar"></i> إجمالي المبيعات النشطة</h3>
        <h2>${total.toLocaleString('ar-IQ')} د.ع</h2>
        <p style="margin-top:0.75rem;opacity:0.85;font-size:0.85rem">${snapshot.size} طلب نشط</p>
    </div>`;
};

window.resetSales = async () => {
    if(!confirm('هل أنت متأكد من تصفير المبيعات وحذف كل الطلبات المقبولة والنشطة؟')) return;
    const q = query(collection(db, "orders"), where("status", "in", ACTIVE_ORDER_STATUSES));
    const snapshot = await getDocs(q);
    snapshot.forEach(async d => await deleteDoc(doc(db, "orders", d.id)));
    loadSales();
};

// ✅ كل حذف يسجل tombstone أولاً (للمجموعات التي يتابعها التطبيق فقط)
window.deleteDocItem = async (col, id, unused, cb) => {
    if(!confirm('متأكد من الحذف؟')) return;

    // سجل tombstone قبل الحذف لمزامنة التطبيق
    const trackedCollections = ['products', 'categories', 'banners', 'offers'];
    if (trackedCollections.includes(col)) {
        await recordDeletion(col, id);
    }

    await deleteDoc(doc(db, col, id));
    await bumpDataVersion();
    if(cb) cb();
};

window.loadPushTokenStats = async () => {
    const statsEl = document.getElementById('push-token-stats');
    if (!statsEl) return;
    statsEl.innerHTML = loadingState();

    try {
        const snap = await getDocs(collection(db, 'push_tokens'));
        const counts = { ios: 0, android: 0, web: 0, total: 0 };
        snap.forEach((docSnap) => {
            const platform = docSnap.data()?.platform || 'unknown';
            counts.total += 1;
            if (platform === 'ios') counts.ios += 1;
            else if (platform === 'android') counts.android += 1;
            else if (platform === 'web') counts.web += 1;
        });

        statsEl.innerHTML = `
            <div class="sales-card card-3d" style="margin-bottom:1rem">
                <h3><i class="fa-solid fa-mobile-screen"></i> أجهزة مسجّلة للإشعارات</h3>
                <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.75rem;margin-top:1rem">
                    <div><strong>${counts.total}</strong><div class="order-meta">الإجمالي</div></div>
                    <div><strong>${counts.android}</strong><div class="order-meta">أندرويد</div></div>
                    <div><strong>${counts.ios}</strong><div class="order-meta">آيفون</div></div>
                    <div><strong>${counts.web}</strong><div class="order-meta">ويب</div></div>
                </div>
            </div>`;
    } catch (e) {
        statsEl.innerHTML = `<div class="order-meta">تعذر تحميل إحصائيات الأجهزة</div>`;
    }
};

window.sendBroadcastNotification = async () => {
    const title = document.getElementById('broadcast-title')?.value?.trim();
    const body = document.getElementById('broadcast-body')?.value?.trim();
    if (!title || !body) {
        showCustomAlert('أدخل عنوان ونص الإشعار');
        return;
    }

    const btn = document.getElementById('btn-send-broadcast');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';
    }

    try {
        await createInAppNotification({
            phone: '',
            email: '',
            title,
            body,
            broadcast: true,
        });

        const pushResult = await pushToAllUsers({
            title,
            body,
            data: { broadcast: 'true' },
        });

        showCustomAlert(
            pushResult.sent > 0
                ? `تم إرسال الإشعار إلى ${pushResult.sent} جهاز`
                : 'تم حفظ الإشعار — لا توجد أجهزة مسجّلة بعد'
        );

        document.getElementById('broadcast-title').value = '';
        document.getElementById('broadcast-body').value = '';
        loadPushTokenStats();
        loadNotificationsHistory();
    } catch (e) {
        showCustomAlert(e.message || 'تعذر إرسال الإشعار');
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
    list.innerHTML = loadingState();

    try {
        const snap = await getDocs(collection(db, 'notifications'));
        const items = [];
        snap.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));

        items.sort((a, b) => {
            const ta = a.createdAt?.seconds
                ? a.createdAt.seconds * 1000
                : new Date(a.createdAt || 0).getTime();
            const tb = b.createdAt?.seconds
                ? b.createdAt.seconds * 1000
                : new Date(b.createdAt || 0).getTime();
            return tb - ta;
        });

        if (!items.length) {
            list.innerHTML = emptyState('fa-bell', 'لا توجد إشعارات مرسلة بعد');
            return;
        }

        list.innerHTML = items.slice(0, 50).map((n) => {
            const tag = n.broadcast
                ? { cls: 'broadcast', label: 'الجميع' }
                : n.orderId
                    ? { cls: 'order', label: 'طلب' }
                    : { cls: 'user', label: 'مستخدم' };
            const recipient = n.broadcast
                ? 'جميع المستخدمين'
                : [n.phone, n.email].filter(Boolean).join(' · ') || '—';

            return `<div class="notification-history-item">
                <div class="notification-history-head">
                    <div class="notification-history-title">${escapeHtml(n.title || 'إشعار')}</div>
                    <span class="notification-history-tag ${tag.cls}">${tag.label}</span>
                </div>
                <div class="notification-history-body">${escapeHtml(n.body || '')}</div>
                <div class="notification-history-meta">
                    <span>المستلم: ${escapeHtml(recipient)}</span>
                    · <span>${formatOrderDateTime(n.createdAt)}</span>
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        list.innerHTML = `<div class="order-meta">تعذر تحميل سجل الإشعارات</div>`;
    }
};

window.sendUserNotification = async () => {
    const email = document.getElementById('user-notif-email')?.value?.trim().toLowerCase() || '';
    const phone = document.getElementById('user-notif-phone')?.value?.trim() || '';
    const title = document.getElementById('user-notif-title')?.value?.trim();
    const body = document.getElementById('user-notif-body')?.value?.trim();

    if (!email && !phone) {
        showCustomAlert('أدخل البريد أو رقم الهاتف');
        return;
    }
    if (!title || !body) {
        showCustomAlert('أدخل عنوان ونص الإشعار');
        return;
    }

    const btn = document.getElementById('btn-send-user-notif');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';
    }

    try {
        await createInAppNotification({ email, phone, title, body });

        const pushResult = await pushToUser({
            email,
            phone,
            title,
            body,
            data: {},
        });

        showCustomAlert(
            pushResult.sent > 0
                ? `تم إرسال الإشعار إلى ${pushResult.sent} جهاز`
                : 'تم حفظ الإشعار داخل التطبيق — لا يوجد جهاز مسجّل لهذا المستخدم'
        );

        document.getElementById('user-notif-email').value = '';
        document.getElementById('user-notif-phone').value = '';
        document.getElementById('user-notif-title').value = '';
        document.getElementById('user-notif-body').value = '';
        loadNotificationsHistory();
    } catch (e) {
        showCustomAlert(e.message || 'تعذر إرسال الإشعار');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> إرسال للمستخدم';
        }
    }
};

initAdminSession();
