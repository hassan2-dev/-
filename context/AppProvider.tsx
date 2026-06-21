import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCollectionFresh, clearCollectionCache, addDocument, fetchServerVersion, readCachedCollection } from '../lib/firebase';
import { sendPhoneOtp, verifyPhoneOtp } from '../lib/otp';
import { Category, Product, CartItem } from '../lib/types';
import { DELIVERY_COST } from '../lib/theme';

interface ToastMessage {
  id: number;
  text: string;
}

interface AppContextType {
  // Auth
  isLoggedIn: boolean;
  isCheckingAuth: boolean;
  userPhone: string | null;
  requestOtp: (phone: string) => Promise<{ ok: boolean; devCode?: string; message?: string }>;
  verifyOtpAndLogin: (phone: string, code: string) => Promise<boolean>;
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
  submitOrder: (name: string, phone: string, address: string) => Promise<boolean>;

  // Toast
  toasts: ToastMessage[];
  showToast: (message: string) => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }: { children: any }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<string[]>([]);
  const [offers, setOffers] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
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

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Load local data on mount
  useEffect(() => {
    loadLocalData();
    bootstrapFromCache();
    fetchAllData(false);
  }, []);

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
      const [loggedIn, phone] = await Promise.all([
        AsyncStorage.getItem('is_logged_in'),
        AsyncStorage.getItem('auth_phone'),
      ]);
      setIsLoggedIn(loggedIn === 'true' && !!phone);
      setUserPhone(phone);
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
      if (prods && prods.length) setProducts(prods as Product[]);
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
      if (prods.data.length) setProducts(prods.data as Product[]);
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

  const requestOtp = useCallback(async (phone: string) => {
    const result = await sendPhoneOtp(phone);
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    return { ok: true, devCode: result.code };
  }, []);

  const verifyOtpAndLogin = useCallback(async (phone: string, code: string) => {
    const result = await verifyPhoneOtp(phone, code);
    if (!result.ok || !result.phone) {
      showToast(result.message || 'رمز التحقق غير صحيح');
      return false;
    }

    await AsyncStorage.multiSet([
      ['is_logged_in', 'true'],
      ['auth_phone', result.phone],
    ]);

    try {
      const profileKey = 'customer_profile_v1';
      const legacyKey = 'user_profile';
      const saved = (await AsyncStorage.getItem(profileKey)) || (await AsyncStorage.getItem(legacyKey));
      const profile = saved ? JSON.parse(saved) : {};
      const updated = { ...profile, phone: result.phone };
      await AsyncStorage.multiSet([
        [profileKey, JSON.stringify(updated)],
        [legacyKey, JSON.stringify(updated)],
      ]);
    } catch {
      // profile sync is optional
    }

    setUserPhone(result.phone);
    setIsLoggedIn(true);
    showToast('تم تسجيل الدخول بنجاح');
    return true;
  }, [showToast]);

  const logout = useCallback(async () => {
    loggingOutRef.current = true;

    setIsLoggedIn(false);
    setUserPhone(null);
    await AsyncStorage.multiRemove([
      'is_logged_in',
      'is_guest',
      'auth_phone',
      'firebase_refresh_token',
    ]);

    setTimeout(() => { loggingOutRef.current = false; }, 500);
  }, []);

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

  const submitOrder = useCallback(async (name: string, phone: string, address: string): Promise<boolean> => {
    const totals = getCartTotals();
    const orderData = {
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
      createdAt: new Date().toISOString(),
    };
    const success = await addDocument('orders', orderData);
    if (success) {
      clearCart();
    }
    return success;
  }, [cart, getCartTotals, clearCart]);

  return (
    <AppContext.Provider
      value={{
        isLoggedIn, isCheckingAuth, userPhone, requestOtp, verifyOtpAndLogin, logout,
        categories, products, banners, offers, dataLoading, refreshData, clearCacheAndRefresh,
        cart, addToCart, removeFromCart, updateCartItemQty, clearCart, getCartCount, getCartTotals,
        favorites, toggleFavorite, isFavorite,
        submitOrder,
        toasts, showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}