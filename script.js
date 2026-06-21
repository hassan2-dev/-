import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, deleteDoc, updateDoc, doc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

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
    return new Intl.DateTimeFormat('ar', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
};

const getOrderStatusLabel = (status) => ORDER_STATUS_LABELS[status] || status || 'غير معروف';

const buildOrderActionButtons = (id, status, reloadStatus) => {
    const buttons = [];
    if (status === 'pending') {
        buttons.push(`<button class="btn-action accept" onclick="window.updateOrderStatus('${id}', 'accepted', '${reloadStatus}')">موافقة</button>`);
        buttons.push(`<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'preparing', '${reloadStatus}')">قيد التجهيز</button>`);
        buttons.push(`<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'on_the_way', '${reloadStatus}')">في التوصيل</button>`);
    } else if (status === 'accepted') {
        buttons.push(`<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'preparing', '${reloadStatus}')">قيد التجهيز</button>`);
        buttons.push(`<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'on_the_way', '${reloadStatus}')">في التوصيل</button>`);
    } else if (status === 'preparing') {
        buttons.push(`<button class="btn-action edit" onclick="window.updateOrderStatus('${id}', 'on_the_way', '${reloadStatus}')">في التوصيل</button>`);
    }
    buttons.push(`<button class="btn-action delete" onclick="deleteDocItem('orders', '${id}', null, () => window.loadOrders('${reloadStatus}'))">حذف</button>`);
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

window.loadOrders = async (status) => {
    const list = document.getElementById(status === 'pending' ? 'orders-list' : 'accepted-orders-list');
    const q = status === 'pending'
        ? query(collection(db, "orders"), where("status", "==", "pending"))
        : query(collection(db, "orders"), where("status", "in", ACTIVE_ORDER_STATUSES));

    const snapshot = await getDocs(q);
    list.innerHTML = '';
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        let itemsHtml = '';
        data.items?.forEach(item => {
            itemsHtml += `<div style="display:flex; gap:10px; margin-bottom:5px;"><img src="${item.image}" style="width:40px;height:40px;border-radius:5px;"><span>${item.name} (${item.qty})</span></div>`;
        });

        const createdAtHtml = `<div><strong>تاريخ الطلب:</strong> ${formatOrderDateTime(data.createdAt)}</div>`;
        const updatedAtHtml = data.statusUpdatedAt ? `<div><strong>آخر تحديث:</strong> ${formatOrderDateTime(data.statusUpdatedAt)}</div>` : '';
        const addressHtml = data.address ? `<div><strong>العنوان:</strong> ${data.address}</div>` : '';
        const statusHtml = `<div><strong>الحالة:</strong> ${getOrderStatusLabel(data.status)}</div>`;

        list.innerHTML += `<div class="card-3d" style="text-align:right;">
            <div><strong>الاسم:</strong> ${data.name}</div>
            <div><strong>الهاتف:</strong> ${data.phone}</div>
            ${addressHtml}
            ${statusHtml}
            ${createdAtHtml}
            ${updatedAtHtml}
            <div style="margin:10px 0;">${itemsHtml}</div>
            <div style="color:#FF6B6B;">الإجمالي: ${data.total} د.ع</div>
            <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end;">
                ${buildOrderActionButtons(docSnap.id, data.status, status)}
            </div>
        </div>`;
    });
};

window.updateOrderStatus = async (id, nextStatus, reloadStatus = 'accepted') => {
    await updateDoc(doc(db, "orders", id), {
        status: nextStatus,
        statusUpdatedAt: serverTimestamp()
    });
    window.showCustomAlert(`تم تغيير الحالة إلى: ${getOrderStatusLabel(nextStatus)}`);
    window.loadOrders(reloadStatus);
};

window.acceptOrder = async (id) => {
    await window.updateOrderStatus(id, 'accepted', 'pending');
};