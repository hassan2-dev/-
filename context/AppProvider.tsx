import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCollectionFresh, clearCollectionCache, addDocument, fetchServerVersion, readCachedCollection, fetchNotificationsForUser, signInWithEmailPassword, signUpWithEmailPassword, signInWithGoogleToken, savePushToken, removePushToken, getDocument } from '../lib/firebase';
import { parseGoogleProfileFromIdToken, resolveUserDisplayName } from '../lib/authConfig';
import {
  preparePushNotifications,
  getNotificationPermissionState,
  showLocalNotification,
  registerExpoPushToken,
  getPushPlatform,
  addNotificationListeners,
} from '../lib/pushNotifications';
import { getOrderStatusNotification } from '../lib/notificationMessages';
import { notifyAdminNewOrder } from '../lib/adminNotify';
import { Category, Product, CartItem, StoreSettings } from '../lib/types';
import { normalizeProduct } from '../lib/productImage';
import { DELIVERY_COST } from '../lib/theme';
import {
  DEFAULT_STORE_SETTINGS,
  isStoreOpen as checkStoreOpen,
  parseStoreSettings,
} from '../lib/storeHours';

export interface AppNotification {
  id: string;
  email?: string;
  phone?: string;
  orderId?: string;
  title: string;
  body: string;
  status?: string;
  createdAt?: string;
  read?: boolean;
}

const READ_NOTIFICATION_IDS_KEY = 'read_notification_ids';
const LAST_NOTIFICATION_PUSH_KEY = 'last_notification_push_at';
const EXPO_PUSH_TOKEN_KEY = 'expo_push_token';

interface ToastMessage {
  id: number;
  text: string;
}

interface AppContextType {
  // Auth
  isLoggedIn: boolean;
  isCheckingAuth: boolean;
  isGuest: boolean;
  userEmail: string | null;
  userPhone: string | null;
  userDisplayName: string | null;
  userPhotoUrl: string | null;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  registerWithEmail: (email: string, password: string) => Promise<boolean>;
  loginAsGuest: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  finalizeGoogleSignIn: (idToken: string) => Promise<boolean>;
  logout: () => void;

  // Data
  categories: Category[];
  products: Product[];
  banners: string[];
  offers: string[];
  dataLoading: boolean;
  refreshData: () => void;
  clearCacheAndRefresh: () => Promise<void>;

  // Cart
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateCartItemQty: (productId: string, change: number) => void;
  clearCart: () => void;
  getCartCount: () => number;
  getCartTotals: () => { subtotal: number; discount: number; delivery: number; total: number };

  // Favorites
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;

  // Orders
  submitOrder: (
    name: string,
    phone: string,
    address: string,
    scheduledAt?: string | null
  ) => Promise<boolean>;

  // Store hours
  storeSettings: StoreSettings;
  isStoreOpen: boolean;

  // Notifications
  notifications: AppNotification[];
  unreadNotificationCount: number;
  notificationsLoading: boolean;
  refreshNotifications: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  enablePushNotifications: () => Promise<boolean>;

  // Toast
  toasts: ToastMessage[];
  showToast: (message: string) => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }: { children: any }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<string[]>([]);
  const [offers, setOffers] = useState<string[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [storeHoursTick, setStoreHoursTick] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const loggingOutRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const lastForegroundRefreshRef = useRef(0);
  const hasHydratedDataRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const lastCatalogRefreshRef = useRef(0);
  const fetchAllDataRef = useRef<(f?: boolean) => void>(() => {});
  const CATALOG_REFRESH_THROTTLE_MS = 15000;
  const NOTIFICATION_POLL_MS = 25000;
  const STORE_HOURS_CHECK_MS = 60000;

  const isStoreOpen = useMemo(
    () => checkStoreOpen(storeSettings),
    [storeSettings, storeHoursTick]
  );

  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Load local data on mount
  useEffect(() => {
    loadLocalData();
    bootstrapFromCache();
    loadStoreSettings();
    fetchAllData(false);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setStoreHoursTick((t) => t + 1), STORE_HOURS_CHECK_MS);
    return () => clearInterval(timer);
  }, []);

  async function loadStoreSettings() {
    try {
      const raw = await getDocument('settings', 'store');
      setStoreSettings(parseStoreSettings(raw));
    } catch {
      setStoreSettings(DEFAULT_STORE_SETTINGS);
    }
  }

  const refreshData = useCallback(async () => {
    await fetchAllData(true);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: string) => {
      const wasBackground = /inactive|background/.test(appStateRef.current);
      appStateRef.current = nextAppState;

      if (nextAppState === 'active' && wasBackground) {
        const now = Date.now();
        if (now - lastForegroundRefreshRef.current > 20000) {
          lastForegroundRefreshRef.current = now;
          refreshData();
        }
      }
    });

    return () => subscription.remove();
  }, [refreshData]);

  // Fetch Firebase data when logged in
  useEffect(() => {
    if (isLoggedIn) {
      // Catalog already fetched on mount; only force a refresh if cache is empty.
      if (products.length === 0 && categories.length === 0) {
        fetchAllData(false);
      }
    }
  }, [isLoggedIn]);

  async function checkAuth() {
    try {
      const [loggedIn, guest, email, phone, displayName, photoUrl] = await Promise.all([
        AsyncStorage.getItem('is_logged_in'),
        AsyncStorage.getItem('is_guest'),
        AsyncStorage.getItem('auth_email'),
        AsyncStorage.getItem('auth_phone'),
        AsyncStorage.getItem('auth_display_name'),
        AsyncStorage.getItem('auth_photo_url'),
      ]);
      setIsGuest(guest === 'true');
      setUserEmail(email);
      setUserPhone(phone);
      setUserDisplayName(displayName);
      setUserPhotoUrl(photoUrl);
      setIsLoggedIn(loggedIn === 'true' && (!!email || guest === 'true'));
    } catch (e) {}
    setIsCheckingAuth(false);
  }

  async function bootstrapFromCache() {
    try {
      const [cats, prods, bans, offs] = await Promise.all([
        readCachedCollection('categories'),
        readCachedCollection('products'),
        readCachedCollection('banners'),
        readCachedCollection('offers'),
      ]);
      if (cats && cats.length) setCategories(cats as Category[]);
      if (prods && prods.length) setProducts(prods.map((p: any) => normalizeProduct(p)));
      if (bans && bans.length) setBanners(bans.map((b: any) => b.image).filter(Boolean));
      if (offs && offs.length) setOffers(offs.map((o: any) => o.image).filter(Boolean));
    } catch (e) {}
    finally {
      hasHydratedDataRef.current = true;
      setDataLoading(false);
    }
  }

  async function loadLocalData() {
    try {
      const [savedCart, savedFavs] = await Promise.all([
        AsyncStorage.getItem('cart'),
        AsyncStorage.getItem('favorites'),
      ]);
      if (savedCart) setCart(JSON.parse(savedCart));
      if (savedFavs) setFavorites(JSON.parse(savedFavs));
    } catch (e) {}
  }

  async function saveCart(newCart: CartItem[]) {
    setCart(newCart);
    try { await AsyncStorage.setItem('cart', JSON.stringify(newCart)); } catch (e) {}
  }

  async function saveFavorites(newFavs: string[]) {
    setFavorites(newFavs);
    try { await AsyncStorage.setItem('favorites', JSON.stringify(newFavs)); } catch (e) {}
  }

  async function fetchAllData(forceRefresh: boolean = false) {
    const now = Date.now();
    if (refreshInFlightRef.current) return;
    if (!forceRefresh && now - lastCatalogRefreshRef.current < CATALOG_REFRESH_THROTTLE_MS) return;

    refreshInFlightRef.current = true;
    lastCatalogRefreshRef.current = now;

    if (!hasHydratedDataRef.current) setDataLoading(true);
    try {
      if (forceRefresh) {
        await clearCollectionCache();
      }

      const cats = await fetchCollectionFresh('categories');
      if (cats.data.length) setCategories(cats.data as Category[]);
      await new Promise((r) => setTimeout(r, 200));

      const prods = await fetchCollectionFresh('products');
      if (prods.data.length) {
        setProducts(prods.data.map((p: any) => normalizeProduct(p)));
      }
      await new Promise((r) => setTimeout(r, 200));

      const bans = await fetchCollectionFresh('banners');
      if (bans.data.length) {
        setBanners(bans.data.map((b: any) => b.image).filter(Boolean));
      }
      await new Promise((r) => setTimeout(r, 200));

      const offs = await fetchCollectionFresh('offers');
      if (offs.data.length) {
        setOffers(offs.data.map((o: any) => o.image).filter(Boolean));
      }

      await loadStoreSettings();

      const serverVersion = await fetchServerVersion();
      if (serverVersion) {
        try {
          await AsyncStorage.setItem('data_version', serverVersion);
        } catch (e) {}
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      refreshInFlightRef.current = false;
      if (!hasHydratedDataRef.current) setDataLoading(false);
    }
  }

  const showToast = useCallback((message: string) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, text: message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const clearCacheAndRefresh = useCallback(async () => {
    await clearCollectionCache();
    lastCatalogRefreshRef.current = 0;
    await fetchAllData(true);
    showToast('تم تحديث البيانات من السيرفر');
  }, [showToast]);

  const completeEmailLogin = useCallback(async (email: string) => {
    const normalized = email.trim().toLowerCase();
    await AsyncStorage.multiSet([
      ['is_logged_in', 'true'],
      ['is_guest', 'false'],
      ['auth_email', normalized],
    ]);
    await AsyncStorage.multiRemove(['auth_display_name', 'auth_photo_url']);
    setIsGuest(false);
    setUserEmail(normalized);
    setUserDisplayName(null);
    setUserPhotoUrl(null);
    setIsLoggedIn(true);
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const result = await signInWithEmailPassword(email.trim().toLowerCase(), password);
    if (!result.ok) {
      showToast(result.message || 'تعذر تسجيل الدخول');
      return false;
    }
    await completeEmailLogin(email);
    showToast('تم تسجيل الدخول بنجاح');
    return true;
  }, [completeEmailLogin, showToast]);

  const registerWithEmail = useCallback(async (email: string, password: string) => {
    const result = await signUpWithEmailPassword(email.trim().toLowerCase(), password);
    if (!result.ok) {
      showToast(result.message || 'تعذر إنشاء الحساب');
      return false;
    }
    await completeEmailLogin(email);
    showToast('تم إنشاء الحساب بنجاح');
    return true;
  }, [completeEmailLogin, showToast]);

  const loginAsGuest = useCallback(async () => {
    await AsyncStorage.multiSet([
      ['is_logged_in', 'true'],
      ['is_guest', 'true'],
    ]);
    await AsyncStorage.multiRemove(['auth_display_name', 'auth_photo_url']);
    setIsGuest(true);
    setUserEmail(null);
    setUserDisplayName(null);
    setUserPhotoUrl(null);
    setIsLoggedIn(true);
    showToast('مرحباً بك كزائر');
  }, [showToast]);

  const loginWithGoogle = useCallback(async () => {
    showToast('استخدم زر Google من شاشة تسجيل الدخول');
  }, [showToast]);

  const finalizeGoogleSignIn = useCallback(async (idToken: string) => {
    const result = await signInWithGoogleToken(idToken);
    if (!result.ok) {
      console.error('[Firebase Google]', result.code, result.message);
      const message =
        __DEV__ && result.code
          ? `${result.message} (${result.code})`
          : result.message || 'تعذر تسجيل الدخول عبر Google';
      showToast(message);
      return false;
    }

    const googleProfile = parseGoogleProfileFromIdToken(idToken);
    const email = result.email || googleProfile.email;
    const displayName = resolveUserDisplayName(googleProfile.name, email);
    const photoUrl = googleProfile.picture;

    if (email) {
      const storageEntries: [string, string][] = [
        ['is_logged_in', 'true'],
        ['is_guest', 'false'],
        ['auth_email', email],
      ];
      if (displayName) storageEntries.push(['auth_display_name', displayName]);
      if (photoUrl) storageEntries.push(['auth_photo_url', photoUrl]);
      await AsyncStorage.multiSet(storageEntries);
      setIsGuest(false);
      setUserEmail(email);
      setUserDisplayName(displayName);
      setUserPhotoUrl(photoUrl);
      setIsLoggedIn(true);
    } else {
      await AsyncStorage.multiSet([
        ['is_logged_in', 'true'],
        ['is_guest', 'false'],
      ]);
      setIsGuest(false);
      setUserEmail(null);
      setIsLoggedIn(true);
    }

    showToast('تم تسجيل الدخول عبر Google');
    return true;
  }, [showToast]);

  const logout = useCallback(async () => {
    loggingOutRef.current = true;

    try {
      const storedToken = await AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY);
      if (storedToken) {
        await removePushToken(storedToken);
      }
    } catch {
      // ignore
    }

    setIsLoggedIn(false);
    setIsGuest(false);
    setUserEmail(null);
    setUserPhone(null);
    setUserDisplayName(null);
    setUserPhotoUrl(null);
    await AsyncStorage.multiRemove([
      'is_logged_in',
      'is_guest',
      'auth_email',
      'auth_phone',
      'auth_display_name',
      'auth_photo_url',
      'firebase_refresh_token',
      EXPO_PUSH_TOKEN_KEY,
    ]);

    setTimeout(() => { loggingOutRef.current = false; }, 500);
  }, []);

  const syncPushToken = useCallback(async () => {
    if (!isLoggedIn || isGuest || (!userEmail && !userPhone)) return;

    const token = await registerExpoPushToken();
    if (!token) return;

    await savePushToken({
      token,
      email: userEmail,
      phone: userPhone,
      platform: getPushPlatform(),
    });
    await AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, token);
    if (__DEV__) {
      console.log('[Push] token registered', { platform: getPushPlatform(), token: token.slice(0, 28) + '...' });
    }
  }, [isLoggedIn, isGuest, userEmail, userPhone]);

  const enablePushNotifications = useCallback(async () => {
    if (!isLoggedIn || isGuest || (!userEmail && !userPhone)) return false;
    const state = await getNotificationPermissionState();
    if (state !== 'granted') return false;
    await syncPushToken();
    return true;
  }, [isLoggedIn, isGuest, userEmail, userPhone, syncPushToken]);

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      let newCart: CartItem[];
      if (existing) {
        newCart = prev.map(item =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      } else {
        newCart = [...prev, { ...product, qty: 1 }];
      }
      AsyncStorage.setItem('cart', JSON.stringify(newCart)).catch(() => {});
      return newCart;
    });
    showToast('تمت إضافة ' + product.name);
  }, [showToast]);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => {
      const newCart = prev.filter(item => item.id !== productId);
      AsyncStorage.setItem('cart', JSON.stringify(newCart)).catch(() => {});
      return newCart;
    });
  }, []);

  const updateCartItemQty = useCallback((productId: string, change: number) => {
    setCart(prev => {
      let newCart = prev.map(item =>
        item.id === productId ? { ...item, qty: item.qty + change } : item
      ).filter(item => item.qty > 0);
      AsyncStorage.setItem('cart', JSON.stringify(newCart)).catch(() => {});
      return newCart;
    });
  }, []);

  const clearCart = useCallback(() => {
    saveCart([]);
  }, []);

  const getCartCount = useCallback(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  const getCartTotals = useCallback(() => {
    let subtotal = 0;
    let discountedTotal = 0;
    cart.forEach(item => {
      if (item.hasDiscount && item.originalPrice) {
        subtotal += item.originalPrice * item.qty;
        discountedTotal += item.price * item.qty;
      } else {
        subtotal += item.price * item.qty;
        discountedTotal += item.price * item.qty;
      }
    });
    const discount = subtotal - discountedTotal;
    const delivery = discountedTotal > 0 ? DELIVERY_COST : 0;
    const total = discountedTotal + delivery;
    return { subtotal, discount, delivery, total };
  }, [cart]);

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites(prev => {
      const newFavs = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      AsyncStorage.setItem('favorites', JSON.stringify(newFavs)).catch(() => {});
      return newFavs;
    });
  }, []);

  const isFavorite = useCallback((productId: string) => {
    return favorites.includes(productId);
  }, [favorites]);

  const loadReadNotificationIds = useCallback(async (): Promise<Set<string>> => {
    try {
      const raw = await AsyncStorage.getItem(READ_NOTIFICATION_IDS_KEY);
      if (!raw) return new Set();
      const ids = JSON.parse(raw);
      return new Set(Array.isArray(ids) ? ids : []);
    } catch {
      return new Set();
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!isLoggedIn || isGuest || (!userEmail && !userPhone)) {
      setNotifications([]);
      return;
    }
    setNotificationsLoading(true);
    try {
      const [items, readIds] = await Promise.all([
        fetchNotificationsForUser(userEmail, userPhone),
        loadReadNotificationIds(),
      ]);

      const mapped: AppNotification[] = items.map((n: any) => ({
        id: n.id,
        email: n.email,
        phone: n.phone,
        orderId: n.orderId,
        title: n.title || 'إشعار',
        body: n.body || '',
        status: n.status,
        createdAt: n.createdAt,
        read: readIds.has(n.id),
      }));
      setNotifications(mapped);

      const lastPushRaw = await AsyncStorage.getItem(LAST_NOTIFICATION_PUSH_KEY);
      if (!lastPushRaw) {
        await AsyncStorage.setItem(LAST_NOTIFICATION_PUSH_KEY, String(Date.now()));
        return;
      }

      let lastPush = Number(lastPushRaw) || 0;
      for (const n of mapped) {
        const t = new Date(n.createdAt || 0).getTime();
        if (Number.isFinite(t) && t > lastPush) {
          await showLocalNotification(n.title, n.body, {
            orderId: n.orderId || '',
            status: n.status || '',
          });
          lastPush = Math.max(lastPush, t);
        }
      }
      await AsyncStorage.setItem(LAST_NOTIFICATION_PUSH_KEY, String(lastPush));
    } catch {
      // ignore
    } finally {
      setNotificationsLoading(false);
    }
  }, [isLoggedIn, isGuest, userEmail, userPhone, loadReadNotificationIds]);

  const markNotificationsRead = useCallback(async () => {
    if (!notifications.length) return;
    const allIds = notifications.map((n) => n.id);
    try {
      await AsyncStorage.setItem(READ_NOTIFICATION_IDS_KEY, JSON.stringify(allIds));
    } catch {
      // ignore
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [notifications]);

  useEffect(() => {
    if (!isLoggedIn || isGuest || (!userEmail && !userPhone)) {
      setNotifications([]);
      return;
    }
    preparePushNotifications().catch(() => {});
    getNotificationPermissionState()
      .then((state) => {
        if (state === 'granted') syncPushToken().catch(() => {});
      })
      .catch(() => {});
    refreshNotifications();
    const timer = setInterval(refreshNotifications, NOTIFICATION_POLL_MS);
    return () => clearInterval(timer);
  }, [isLoggedIn, isGuest, userEmail, userPhone, refreshNotifications, syncPushToken]);

  useEffect(() => {
    if (!isLoggedIn || isGuest) return;
    return addNotificationListeners({
      onReceived: () => {
        refreshNotifications().catch(() => {});
      },
    });
  }, [isLoggedIn, isGuest, refreshNotifications]);

  useEffect(() => {
    if (isLoggedIn && !isGuest && (userEmail || userPhone)) {
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') refreshNotifications();
      });
      return () => sub.remove();
    }
  }, [isLoggedIn, isGuest, userEmail, userPhone, refreshNotifications]);

  const submitOrder = useCallback(async (
    name: string,
    phone: string,
    address: string,
    scheduledAt?: string | null
  ): Promise<boolean> => {
    const isScheduled = !!scheduledAt;
    if (!isScheduled && storeSettings.enabled && !checkStoreOpen(storeSettings)) {
      return false;
    }

    const totals = getCartTotals();
    const orderData: Record<string, unknown> = {
      name,
      phone,
      address,
      items: cart.map((item: CartItem) => ({
        id: item.id,
        name: item.name,
        image: item.image || '',
        qty: item.qty,
        price: item.price,
        originalPrice: item.originalPrice || item.price,
      })),
      total: totals.total,
      totalDiscount: totals.discount,
      status: 'pending',
      isScheduled,
      createdAt: new Date().toISOString(),
    };
    if (scheduledAt) orderData.scheduledAt = scheduledAt;
    if (userEmail) orderData.email = userEmail;

    const success = await addDocument('orders', orderData);
    if (success) {
      notifyAdminNewOrder({
        title: '📦 طلب جديد',
        body: `${name} — ${Number(totals.total || 0).toLocaleString('ar-IQ')} د.ع`,
      }).catch(() => {});

      const msg = getOrderStatusNotification('pending');
      const notification: Record<string, unknown> = {
        phone,
        title: msg.title,
        body: msg.body,
        status: 'pending',
      };
      if (userEmail) notification.email = userEmail;
      await addDocument('notifications', notification);
      clearCart();
      refreshNotifications();
    }
    return success;
  }, [cart, getCartTotals, clearCart, refreshNotifications, userEmail, storeSettings]);

  return (
    <AppContext.Provider
      value={{
        isLoggedIn, isCheckingAuth, isGuest, userEmail, userPhone, userDisplayName, userPhotoUrl,
        loginWithEmail, registerWithEmail, loginAsGuest, loginWithGoogle, finalizeGoogleSignIn, logout,
        categories, products, banners, offers, dataLoading, refreshData, clearCacheAndRefresh,
        cart, addToCart, removeFromCart, updateCartItemQty, clearCart, getCartCount, getCartTotals,
        favorites, toggleFavorite, isFavorite,
        submitOrder,
        storeSettings, isStoreOpen,
        notifications, unreadNotificationCount, notificationsLoading,
        refreshNotifications, markNotificationsRead, enablePushNotifications,
        toasts, showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}