import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearApiCatalogCache,
  createApiOrder,
  deleteMyAccount,
  fetchApiCatalogVersion,
  fetchApiCollectionCached,
  fetchApiStoreSettings,
  fetchMyApiNotifications,
  getCurrentUser,
  getStoredApiUser,
  hasApiSession,
  logoutApi,
  markApiNotificationRead,
  readApiCachedCollection,
  registerApiPushToken,
  requestPhoneOtp,
  updateMyApiProfile,
  verifyPhoneOtp,
} from '../lib/api';
import {
  preparePushNotifications,
  getNotificationPermissionState,
  showLocalNotification,
  registerExpoPushToken,
  getPushPlatform,
  addNotificationListeners,
} from '../lib/pushNotifications';
import { Category, Product, CartItem, StoreSettings } from '../lib/types';
import { normalizeProduct } from '../lib/productImage';
import { DELIVERY_COST } from '../lib/theme';
import {
  DEFAULT_STORE_SETTINGS,
  isStoreOpen as checkStoreOpen,
  parseStoreSettings,
} from '../lib/storeHours';
import { clearCustomerProfile } from '../lib/customerProfile';

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
  requestOtp: (phone: string) => Promise<{ ok: boolean; phone?: string; devCode?: string }>;
  verifyOtp: (phone: string, code: string) => Promise<boolean>;
  updateProfile: (profile: {
    name?: string;
    address?: string;
    email?: string;
    apartment?: Record<string, unknown>;
  }) => Promise<boolean>;
  logout: () => void;
  deleteAccount: () => Promise<boolean>;

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
  const prevStoreOpenRef = useRef<boolean | null>(null);
  const CATALOG_REFRESH_THROTTLE_MS = 5 * 60 * 1000;
  const NOTIFICATION_POLL_MS = 15 * 60 * 1000;
  const STORE_HOURS_CHECK_MS = 60000;
  const CATALOG_FETCH_GAP_MS = 900;
  const STARTUP_FETCH_DELAY_MS = 2500;
  const EMPTY_CATALOG_RETRY_MS = 95000;
  const FOREGROUND_REFRESH_MS = 5 * 60 * 1000;
  const STORE_SETTINGS_CACHE_KEY = 'cache_settings_store';
  const STORE_SETTINGS_TS_KEY = 'cache_ts_settings_store';
  const STORE_SETTINGS_TTL_MS = 30 * 60 * 1000;

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
    const timer = setTimeout(() => fetchAllData(false), STARTUP_FETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setStoreHoursTick((t) => t + 1), STORE_HOURS_CHECK_MS);
    return () => clearInterval(timer);
  }, []);

  // عند فتح المتجر (أوقات العمل) أعد الجلب فقط إذا الكتالوج فاضي
  useEffect(() => {
    const wasOpen = prevStoreOpenRef.current;
    prevStoreOpenRef.current = isStoreOpen;
    if (wasOpen === false && isStoreOpen && products.length === 0) {
      lastCatalogRefreshRef.current = 0;
      fetchAllData(false);
    }
  }, [isStoreOpen, products.length]);

  // إعادة محاولة تلقائية إذا فشل الجلب (429) والكتالوج فاضي
  useEffect(() => {
    if (dataLoading || products.length > 0) return;
    const timer = setTimeout(() => {
      lastCatalogRefreshRef.current = 0;
      fetchAllData(false);
    }, EMPTY_CATALOG_RETRY_MS);
    return () => clearTimeout(timer);
  }, [dataLoading, products.length]);

  async function loadStoreSettings() {
    try {
      const tsRaw = await AsyncStorage.getItem(STORE_SETTINGS_TS_KEY);
      const ts = tsRaw ? Number(tsRaw) : 0;
      if (ts > 0 && Date.now() - ts < STORE_SETTINGS_TTL_MS) {
        const cached = await AsyncStorage.getItem(STORE_SETTINGS_CACHE_KEY);
        if (cached) {
          setStoreSettings(parseStoreSettings(JSON.parse(cached)));
          return;
        }
      }

      const raw = await fetchApiStoreSettings();
      const parsed = parseStoreSettings(raw as unknown as Record<string, unknown>);
      setStoreSettings(parsed);
      await AsyncStorage.multiSet([
        [STORE_SETTINGS_CACHE_KEY, JSON.stringify(parsed)],
        [STORE_SETTINGS_TS_KEY, String(Date.now())],
      ]);
    } catch {
      setStoreSettings(DEFAULT_STORE_SETTINGS);
    }
  }

  const refreshData = useCallback(async () => {
    lastCatalogRefreshRef.current = 0;
    await fetchAllData(false);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const wasBackground = /inactive|background/.test(appStateRef.current);
      appStateRef.current = nextAppState;

      if (nextAppState === 'active' && wasBackground) {
        const now = Date.now();
        if (now - lastForegroundRefreshRef.current > FOREGROUND_REFRESH_MS) {
          lastForegroundRefreshRef.current = now;
          lastCatalogRefreshRef.current = 0;
          fetchAllData(false);
        }
      }
    });

    return () => subscription.remove();
  }, []);

  async function hasCachedCatalog(): Promise<boolean> {
    const [cats, prods] = await Promise.all([
      readApiCachedCollection('categories'),
      readApiCachedCollection('products'),
    ]);
    return Boolean((cats && cats.length) || (prods && prods.length));
  }

  async function checkAuth() {
    try {
      const hasSession = await hasApiSession();
      if (!hasSession) {
        setIsLoggedIn(false);
        return;
      }

      const cachedUser = await getStoredApiUser();
      if (cachedUser) {
        setUserEmail(cachedUser.email || null);
        setUserPhone(cachedUser.phone);
        setUserDisplayName(cachedUser.name || null);
        setIsLoggedIn(true);
      }

      const user = await getCurrentUser();
      setIsGuest(false);
      setUserEmail(user.email || null);
      setUserPhone(user.phone);
      setUserDisplayName(user.name || null);
      setUserPhotoUrl(null);
      setIsLoggedIn(true);
    } catch {
      await logoutApi();
      setIsLoggedIn(false);
    } finally {
      setIsCheckingAuth(false);
    }
  }

  async function bootstrapFromCache() {
    try {
      const [cats, prods, bans, offs] = await Promise.all([
        readApiCachedCollection('categories'),
        readApiCachedCollection('products'),
        readApiCachedCollection('banners'),
        readApiCachedCollection('offers'),
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
        await clearApiCatalogCache();
      } else {
        const serverVersion = await fetchApiCatalogVersion();
        const cachedVersion = await AsyncStorage.getItem('data_version');
        if (serverVersion && cachedVersion === serverVersion && (await hasCachedCatalog())) {
          await loadStoreSettings();
          return;
        }
      }

      const cats = await fetchApiCollectionCached('categories', forceRefresh);
      if (cats.data.length) setCategories(cats.data as Category[]);
      await new Promise((r) => setTimeout(r, CATALOG_FETCH_GAP_MS));

      const prods = await fetchApiCollectionCached('products', forceRefresh);
      if (prods.data.length) {
        setProducts(prods.data.map((p: any) => normalizeProduct(p)));
      }
      await new Promise((r) => setTimeout(r, CATALOG_FETCH_GAP_MS));

      const bans = await fetchApiCollectionCached('banners', forceRefresh);
      if (bans.data.length) {
        setBanners(bans.data.map((b: any) => b.image).filter(Boolean));
      }
      await new Promise((r) => setTimeout(r, CATALOG_FETCH_GAP_MS));

      const offs = await fetchApiCollectionCached('offers', forceRefresh);
      if (offs.data.length) {
        setOffers(offs.data.map((o: any) => o.image).filter(Boolean));
      }

      await loadStoreSettings();

      const serverVersion = await fetchApiCatalogVersion();
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
    await clearApiCatalogCache();
    lastCatalogRefreshRef.current = 0;
    await fetchAllData(true);
    showToast('تم تحديث البيانات من السيرفر');
  }, [showToast]);

  const requestOtp = useCallback(async (phone: string) => {
    try {
      const result = await requestPhoneOtp(phone.trim());
      return {
        ok: true,
        phone: result.phone,
        devCode: result.devCode,
      };
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر إرسال رمز التحقق');
      return { ok: false };
    }
  }, [showToast]);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    try {
      const user = await verifyPhoneOtp(phone.trim(), code.trim());
      setIsGuest(false);
      setUserEmail(user.email || null);
      setUserPhone(user.phone);
      setUserDisplayName(user.name || null);
      setUserPhotoUrl(null);
      setIsLoggedIn(true);
      showToast('تم تسجيل الدخول بنجاح');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'رمز التحقق غير صحيح');
      return false;
    }
  }, [showToast]);

  const updateProfile = useCallback(async (profile: {
    name?: string;
    address?: string;
    email?: string;
    apartment?: Record<string, unknown>;
  }) => {
    try {
      const user = await updateMyApiProfile(profile);
      setUserEmail(user.email || null);
      setUserPhone(user.phone);
      setUserDisplayName(user.name || null);
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر تحديث الحساب');
      return false;
    }
  }, [showToast]);

  const clearLocalSession = useCallback(async () => {
    setIsLoggedIn(false);
    setIsGuest(false);
    setUserEmail(null);
    setUserPhone(null);
    setUserDisplayName(null);
    setUserPhotoUrl(null);
    setCart([]);
    setFavorites([]);
    setNotifications([]);
    await clearCustomerProfile();
    await AsyncStorage.multiRemove([
      'is_logged_in',
      'is_guest',
      'auth_email',
      'auth_phone',
      'auth_display_name',
      'auth_photo_url',
      'firebase_refresh_token',
      'cart',
      'favorites',
      READ_NOTIFICATION_IDS_KEY,
      EXPO_PUSH_TOKEN_KEY,
    ]);
  }, []);

  const logout = useCallback(async () => {
    loggingOutRef.current = true;
    await logoutApi();
    await clearLocalSession();
    setTimeout(() => {
      loggingOutRef.current = false;
    }, 500);
  }, [clearLocalSession]);

  const deleteAccount = useCallback(async () => {
    loggingOutRef.current = true;
    try {
      await deleteMyAccount();
      await clearLocalSession();
      showToast('تم حذف حسابك نهائياً');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر حذف الحساب');
      return false;
    } finally {
      setTimeout(() => {
        loggingOutRef.current = false;
      }, 500);
    }
  }, [clearLocalSession, showToast]);

  const syncPushToken = useCallback(async () => {
    if (!isLoggedIn || isGuest || (!userEmail && !userPhone)) return;

    const token = await registerExpoPushToken();
    if (!token) return;

    await registerApiPushToken({
      token,
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
        fetchMyApiNotifications(),
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
        read: Boolean(n.read) || readIds.has(n.id),
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
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
      await Promise.allSettled(unreadIds.map((id) => markApiNotificationRead(id)));
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

    let pollTimer: ReturnType<typeof setInterval> | undefined;
    preparePushNotifications().catch(() => {});

    const pushTimer = setTimeout(() => {
      getNotificationPermissionState()
        .then((state) => {
          if (state === 'granted') syncPushToken().catch(() => {});
        })
        .catch(() => {});
    }, 20000);

    // بعد المنتجات — يقلل 429
    const startTimer = setTimeout(() => {
      refreshNotifications();
      pollTimer = setInterval(refreshNotifications, NOTIFICATION_POLL_MS);
    }, 45000);

    return () => {
      clearTimeout(pushTimer);
      clearTimeout(startTimer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [isLoggedIn, isGuest, userEmail, userPhone, refreshNotifications, syncPushToken]);

  useEffect(() => {
    if (!isLoggedIn || isGuest) return;
    return addNotificationListeners({
      onReceived: () => {
        refreshNotifications().catch(() => {});
      },
    });
  }, [isLoggedIn, isGuest, refreshNotifications]);

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
      isScheduled,
    };
    if (scheduledAt) orderData.scheduledAt = scheduledAt;
    if (userEmail) orderData.email = userEmail;

    try {
      await updateMyApiProfile({ name, address }).catch(() => null);
      await createApiOrder(orderData);
      clearCart();
      refreshNotifications();
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر إرسال الطلب');
      return false;
    }
  }, [cart, getCartTotals, clearCart, refreshNotifications, showToast, userEmail, storeSettings]);

  return (
    <AppContext.Provider
      value={{
        isLoggedIn, isCheckingAuth, isGuest, userEmail, userPhone, userDisplayName, userPhotoUrl,
        requestOtp, verifyOtp, updateProfile, logout, deleteAccount,
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