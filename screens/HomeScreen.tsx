import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Colors,
  FontSize,
  Spacing,
  BorderRadius,
  WHATSAPP_NUMBER,
  Layout,
} from '../lib/theme';
import { useApp } from '../context/AppProvider';
import { fetchCollection } from '../lib/firebase';
import GlassBackground from '../components/GlassBackground';
import SearchBarWithResults from '../components/SearchBarWithResults';
import BannerSlider from '../components/BannerSlider';
import OfferSlots from '../components/OfferSlots';
import CategoryCard from '../components/CategoryCard';
import PaginatedProductGrid from '../components/PaginatedProductGrid';
import { resolveUserDisplayName } from '../lib/authConfig';
import { SectionHeader } from '../components/layout';

const PROFILE_KEYS = ['customer_profile_v1', 'user_profile'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'طلب قيد الانتظار',
  accepted: 'تم قبول طلبك',
  preparing: 'جاري التجهيز',
  on_the_way: 'في الطريق إليك',
};
const ORDER_EXPIRE_MS = 6 * 60 * 60 * 1000;
const MAX_VISIBLE_ORDERS = 3;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    categories,
    products,
    banners,
    offers,
    dataLoading,
    refreshData,
    getCartCount,
    userPhone,
    userEmail,
    userDisplayName,
    unreadNotificationCount,
  } = useApp();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [hiddenOrderIds, setHiddenOrderIds] = useState<string[]>([]);

  const getOrderTime = useCallback((order: any) => {
    const raw = order?.statusUpdatedAt || order?.createdAt;
    const time = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const savedProfile = await Promise.all(
        PROFILE_KEYS.map((key: string) => AsyncStorage.getItem(key))
      ).then((values: (string | null)[]) => values.find(Boolean));
      if (!savedProfile) {
        setUserName(null);
        setOrders([]);
        return;
      }
      const profile = JSON.parse(savedProfile);
      setUserName(profile.name?.trim() || null);
      if (!profile?.name || !profile?.phone) {
        setOrders([]);
        return;
      }

      const fetchedOrders = await fetchCollection('orders');
      const matchedOrders = fetchedOrders
        .filter((order: any) => order.name === profile.name && order.phone === profile.phone)
        .sort((a: any, b: any) => getOrderTime(b) - getOrderTime(a))
        .filter(
          (order: any) =>
            !(order.status === 'on_the_way' && Date.now() - getOrderTime(order) > ORDER_EXPIRE_MS)
        )
        .slice(0, MAX_VISIBLE_ORDERS);

      setOrders(matchedOrders);
      setHiddenOrderIds((prev: string[]) =>
        prev.filter((id: string) => matchedOrders.some((order: any) => order.id === id))
      );
    } catch {
      setOrders([]);
    }
  }, [getOrderTime]);

  const syncData = useCallback(async () => {
    await refreshData();
    await loadOrders();
  }, [refreshData, loadOrders]);

  useEffect(() => {
    loadOrders();
    const timer = setInterval(loadOrders, 30000);
    return () => clearInterval(timer);
  }, [loadOrders]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter((p: any) =>
      q.split('').every((char: string) => p.name.toLowerCase().includes(char))
    );
  }, [products, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await syncData();
    setRefreshing(false);
  };

  const cartCount = getCartCount();
  const visibleOrders = orders.filter((o: any) => !hiddenOrderIds.includes(o.id));
  const displayName = resolveUserDisplayName(userDisplayName, userEmail) ?? 'زبون';

  return (
    <GlassBackground>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={[styles.hero, { paddingTop: insets.top + Spacing.sm }]}
      >
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.greeting}>مرحباً بك 👋</Text>
            <Text style={styles.brand}>{displayName}</Text>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.heroBtn}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={Colors.white} />
              {unreadNotificationCount > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroBtn}
              onPress={() => Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}`)}
            >
              <Ionicons name="logo-whatsapp" size={20} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroBtn}
              onPress={() => navigation.navigate('Cart')}
            >
              <Ionicons name="bag-outline" size={20} color={Colors.white} />
              {cartCount > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>
        {userEmail ? (
          <Text style={styles.phoneLine}>{userEmail}</Text>
        ) : userPhone ? (
          <Text style={styles.phoneLine}>{userPhone}</Text>
        ) : null}
      </LinearGradient>

      <View style={styles.searchSection}>
        <SearchBarWithResults
          value={search}
          onChangeText={setSearch}
          products={products}
          onSelectProduct={(productId) =>
            navigation.navigate('ProductDetail', { productId })
          }
        />
      </View>

      {visibleOrders.length > 0 ? (
        <View style={styles.ordersWrap}>
          {visibleOrders.map((order: any) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderIcon}>
                <Ionicons name="receipt" size={16} color={Colors.white} />
              </View>
              <View style={styles.orderBody}>
                <Text style={styles.orderTitle} numberOfLines={1}>
                  {STATUS_LABELS[order.status] || 'تحديث الطلب'}
                </Text>
                <Text style={styles.orderSub} numberOfLines={1}>
                  {(order.items || []).map((i: any) => i.name).filter(Boolean).join('، ') ||
                    'طلبك'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setHiddenOrderIds((prev) => [...prev, order.id])}
              >
                <Ionicons name="close" size={18} color={Colors.textLight} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {dataLoading && products.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل المتجر...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        >
          <BannerSlider banners={banners} />

          {categories.length > 0 ? (
            <View style={styles.block}>
              <SectionHeader title="تسوق حسب القسم" count={categories.length} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesRow}
              >
                {categories.map((cat: any) => (
                  <CategoryCard
                    key={cat.id}
                    category={cat}
                    onPress={() =>
                      navigation.navigate('CategoryProducts', { categoryName: cat.name })
                    }
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {offers.length > 0 ? (
            <View style={styles.block}>
              <SectionHeader
                title="عروض اليوم"
                actionLabel="المزيد"
                onAction={() => navigation.navigate('MainTabs', { screen: 'OffersTab' })}
              />
              <OfferSlots offers={offers} />
            </View>
          ) : null}

          <View style={styles.block}>
            {!search.trim() ? (
              <>
                <SectionHeader title="كل المنتجات" count={products.length} />
                <PaginatedProductGrid
                  products={products}
                  onProductPress={(productId) =>
                    navigation.navigate('ProductDetail', { productId })
                  }
                  pageSize={20}
                />
              </>
            ) : (
              <>
                <SectionHeader title="نتائج البحث" count={filteredProducts.length} />
                <PaginatedProductGrid
                  products={filteredProducts}
                  onProductPress={(productId) =>
                    navigation.navigate('ProductDetail', { productId })
                  }
                  pageSize={20}
                  emptyText="لا توجد نتائج"
                />
              </>
            )}
          </View>
        </ScrollView>
      )}
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing.xxl,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FontSize.sm,
    fontWeight: '600',
    textAlign: 'right',
  },
  brand: {
    color: Colors.white,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    textAlign: 'right',
    marginTop: 2,
  },
  phoneLine: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: FontSize.xs,
    textAlign: 'right',
    marginTop: Spacing.sm,
  },
  heroActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  heroBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  searchSection: {
    marginTop: -Spacing.lg,
    zIndex: 10,
  },
  ordersWrap: {
    paddingHorizontal: Layout.screenPadding,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  orderIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBody: { flex: 1 },
  orderTitle: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'right',
  },
  orderSub: {
    fontSize: FontSize.xs,
    color: Colors.textGray,
    textAlign: 'right',
    marginTop: 2,
  },
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Layout.tabBarHeight + Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  loadingText: {
    color: Colors.textGray,
    fontSize: FontSize.md,
  },
  block: {
    marginBottom: Spacing.lg,
  },
  categoriesRow: {
    paddingRight: Layout.screenPadding,
    paddingLeft: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
});
