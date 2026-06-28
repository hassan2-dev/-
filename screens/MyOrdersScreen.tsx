import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GlassBackground from '../components/GlassBackground';
import { AppHeader, EmptyState } from '../components/layout';
import { Colors, FontSize, Spacing, BorderRadius, Layout } from '../lib/theme';
import { ORDER_STATUS_LABELS } from '../lib/notificationMessages';
import { fetchCustomerOrders, formatOrderDateTime } from '../lib/customerOrders';
import {
  formatApartmentSummary,
  isApartmentSelectionComplete,
  parseApartmentCode,
} from '../lib/apartmentCode';
import { formatScheduledArabic } from '../lib/storeHours';

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending: 'time-outline',
  accepted: 'checkmark-circle-outline',
  preparing: 'restaurant-outline',
  on_the_way: 'bicycle-outline',
};

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.accent,
  accepted: Colors.primary,
  preparing: '#1976D2',
  on_the_way: '#7B1FA2',
};

function formatAddress(address?: string): string {
  if (!address) return '—';
  const parsed = parseApartmentCode(address);
  if (parsed && isApartmentSelectionComplete(parsed)) {
    return formatApartmentSummary(parsed);
  }
  return address;
}

function OrderCard({ order }: { order: any }) {
  const status = order.status || 'pending';
  const icon = STATUS_ICONS[status] || 'receipt-outline';
  const statusColor = STATUS_COLORS[status] || Colors.textGray;
  const items = (order.items || []) as { name?: string; qty?: number }[];
  const itemsText =
    items.map((i) => `${i.name || 'منتج'} ×${i.qty || 1}`).join(' · ') || '—';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusIcon, { backgroundColor: `${statusColor}18` }]}>
          <Ionicons name={icon} size={22} color={statusColor} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.statusTitle}>{ORDER_STATUS_LABELS[status] || status}</Text>
          <Text style={styles.dateText}>{formatOrderDateTime(order.createdAt)}</Text>
        </View>
        <Text style={styles.total}>{Number(order.total || 0).toLocaleString('ar-IQ')} د.ع</Text>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="cube-outline" size={16} color={Colors.textGray} />
        <Text style={styles.detailText} numberOfLines={2}>
          {itemsText}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="location-outline" size={16} color={Colors.textGray} />
        <Text style={styles.detailText} numberOfLines={2}>
          {formatAddress(order.address)}
        </Text>
      </View>

      {order.isScheduled && order.scheduledAt ? (
        <View style={styles.scheduledRow}>
          <Ionicons name="calendar-outline" size={16} color={Colors.primaryDark} />
          <Text style={styles.scheduledText}>
            توصيل مجدول: {formatScheduledArabic(order.scheduledAt)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function MyOrdersScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const list = await fetchCustomerOrders();
      setOrders(list);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  return (
    <GlassBackground>
      <AppHeader
        title="طلباتي"
        subtitle="متابعة حالة طلباتك"
        showBack
        showCart={false}
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + Spacing.xl },
          orders.length === 0 && styles.listEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="receipt-outline"
              title="لا توجد طلبات"
              subtitle="عندما تطلب من المتجر ستظهر طلباتك هنا"
            />
          )
        }
        renderItem={({ item }) => <OrderCard order={item} />}
      />
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: Layout.screenPadding,
    gap: Spacing.md,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  statusTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'right',
  },
  dateText: {
    fontSize: FontSize.xs,
    color: Colors.textGray,
    textAlign: 'right',
    marginTop: 2,
  },
  total: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  detailText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textGray,
    textAlign: 'right',
    lineHeight: 20,
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.xs,
  },
  scheduledText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primaryDark,
    textAlign: 'right',
  },
});
