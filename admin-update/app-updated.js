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
import { getFirestore, collection, addDoc, getDocs, getDoc, deleteDoc, updateDoc, doc, setDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const CONFIG = {
    FIREBASE_CONFIG: {
        apiKey: "AIzaSyAPiiVfmJdGHje0gittK-7yFTYNTQNY6Fk",
        authDomain: "basjfk-58536.firebaseapp.com",
        projectId: "basjfk-58536",
        storageBucket: "basjfk-58536.firebasestorage.app",
        messagingSenderId: "662162908373",
        appId: "1:662162908373:web:b5a789fd0b6ca6964e2e5c"
    }
};

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const db = getFirestore(app);
let allProducts = [];

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

window.verifyAdmin = () => {
    const pass = document.getElementById('admin-pass').value;
    if (pass === '1001') {
        document.getElementById('login-overlay').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('login-overlay').style.display = 'none';
            document.getElementById('app-content').style.display = 'block';
            switchTab('orders');
        }, 500);
    } else { alert('رمز الدخول غير صحيح!'); }
};

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
};

// === الأقسام ===
window.saveCategory = async () => {
    const id = document.getElementById('cat-id').value;
    const name = document.getElementById('cat-name').value;
    const file = document.getElementById('cat-img').files[0];
    if (!name) return showCustomAlert('أدخل اسم القسم');
    const btn = document.getElementById('btn-save-cat');
    btn.innerText = 'جاري الرفع...';

    try {
        // ✅ كل عملية حفظ/تعديل تكتب updatedAt
        let updateData = { name, updatedAt: serverTimestamp() };
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
    } catch (e) { showCustomAlert(e.message); }
    btn.innerHTML = 'حفظ القسم <i class="fa-solid fa-save"></i>';
};

window.loadCategories = async () => {
    const list = document.getElementById('categories-list');
    list.innerHTML = loadingState();
    const snapshot = await getDocs(collection(db, "categories"));
    list.innerHTML = '';
    if (snapshot.empty) {
        list.innerHTML = emptyState('fa-layer-group', 'لا توجد أقسام بعد');
        return;
    }
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const safeName = escapeHtml(data.name);
        list.innerHTML += `<div class="card-3d">
            <img src="${escapeHtml(data.image || '')}" alt="${safeName}" onerror="this.style.display='none'">
            <div class="card-title">${safeName}</div>
            <div class="card-actions">
                <button class="btn-action edit" onclick="editCategory('${docSnap.id}', '${jsStr(data.name)}')"><i class="fa-solid fa-pen"></i> تعديل</button>
                <button class="btn-action delete" onclick="deleteDocItem('categories', '${docSnap.id}', null, loadCategories)"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        </div>`;
    });
};

window.editCategory = (id, name) => {
    document.getElementById('cat-id').value = id;
    document.getElementById('cat-name').value = name;
    document.getElementById('btn-save-cat').innerText = 'تحديث القسم';
};

window.loadCategoriesForSelect = async () => {
    const select = document.getElementById('prod-cat');
    select.innerHTML = '<option value="">اختر القسم</option>';
    const snapshot = await getDocs(collection(db, "categories"));
    snapshot.forEach(docSnap => { select.innerHTML += `<option value="${docSnap.data().name}">${docSnap.data().name}</option>`; });
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
        const statusClass = data.status || 'pending';

        list.innerHTML += `<div class="card-3d order-card">
            <div class="order-card-header">
                <div>
                    <div class="card-title" style="text-align:right;margin-bottom:4px">${escapeHtml(data.name)}</div>
                    <div class="order-meta"><i class="fa-solid fa-phone"></i> ${escapeHtml(data.phone)}</div>
                </div>
                <span class="order-status ${statusClass}">${getOrderStatusLabel(data.status)}</span>
            </div>
            <div class="order-meta"><strong>العنوان:</strong> ${escapeHtml(addressValue || 'غير متوفر')}</div>
            <div class="order-meta"><strong>تاريخ الطلب:</strong> ${formatOrderDateTime(data.createdAt)}</div>
            ${data.statusUpdatedAt ? `<div class="order-meta"><strong>آخر تحديث:</strong> ${formatOrderDateTime(data.statusUpdatedAt)}</div>` : ''}
            <div class="order-items">${itemsHtml || '<div class="order-meta">لا توجد تفاصيل</div>'}</div>
            <div class="order-total">الإجمالي: ${Number(data.total || 0).toLocaleString('ar-IQ')} د.ع</div>
            <div class="order-actions">${buildOrderActionButtons(docSnap.id, data.status, status)}</div>
        </div>`;
    });
};

window.updateOrderStatus = async (id, nextStatus, reloadStatus = 'accepted') => {
    const orderSnap = await getDoc(doc(db, "orders", id));
    const orderData = orderSnap.data() || {};

    await updateDoc(doc(db, "orders", id), {
        status: nextStatus,
        statusUpdatedAt: serverTimestamp()
    });

    const NOTIF_MSG = {
        accepted: { title: 'تم قبول طلبك ✅', body: 'تمت الموافقة على طلبك وسيتم تجهيزه قريباً' },
        preparing: { title: 'جاري تجهيز طلبك 👨‍🍳', body: 'طلبك قيد التجهيز الآن' },
        on_the_way: { title: 'طلبك في الطريق 🚚', body: 'السائق في طريقه إليك، استعد لاستلام الطلب' },
    };
    const msg = NOTIF_MSG[nextStatus];
    if (msg && orderData.phone) {
        await addDoc(collection(db, "notifications"), {
            phone: orderData.phone,
            orderId: id,
            title: msg.title,
            body: msg.body,
            status: nextStatus,
            read: false,
            createdAt: serverTimestamp()
        });
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
