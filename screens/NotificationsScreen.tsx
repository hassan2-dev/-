import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius, Layout, getBottomSafeInset } from '../lib/theme';
import { useApp, AppNotification } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import { AppHeader } from '../components/layout';
import { ORDER_STATUS_LABELS } from '../lib/notificationMessages';

const DEFAULT_IOS_STORE =
  'https://apps.apple.com/us/app/%D9%85%D8%AA%D8%AC%D8%B1-%D8%AA%D9%81%D8%A7%D8%AD%D8%A9/id6763769377';
const DEFAULT_ANDROID_STORE =
  'https://play.google.com/store/apps/details?id=com.aboameer.tuffahastore2';

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending: 'time-outline',
  accepted: 'checkmark-circle-outline',
  preparing: 'restaurant-outline',
  on_the_way: 'bicycle-outline',
  app_update: 'cloud-download-outline',
  iphone_update: 'logo-apple',
};

function formatTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-IQ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function isStoreNotification(item: AppNotification) {
  return (
    Boolean(item.url) ||
    item.type === 'app_update' ||
    item.type === 'iphone_update'
  );
}

async function openNotificationLink(item: AppNotification) {
  const url =
    item.url ||
    (Platform.OS === 'android' ? DEFAULT_ANDROID_STORE : DEFAULT_IOS_STORE);
  try {
    await Linking.openURL(url);
  } catch {
    // ignore
  }
}

function NotificationItem({
  item,
  isUnread,
  onPress,
}: {
  item: AppNotification;
  isUnread: boolean;
  onPress?: () => void;
}) {
  const icon =
    STATUS_ICONS[item.type || ''] ||
    STATUS_ICONS[item.status || ''] ||
    'notifications-outline';
  const hasLink = isStoreNotification(item);
  const Wrapper = hasLink ? TouchableOpacity : View;
  const wrapperProps = hasLink
    ? { onPress, activeOpacity: 0.85, accessibilityRole: 'link' as const }
    : {};

  return (
    <Wrapper style={[styles.card, isUnread && styles.cardUnread]} {...wrapperProps}>
      <View style={[styles.iconWrap, isUnread && styles.iconWrapUnread]}>
        <Ionicons name={icon} size={22} color={isUnread ? Colors.primary : Colors.textGray} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={[styles.title, isUnread && styles.titleUnread]}>{item.title}</Text>
          {isUnread ? <View style={styles.dot} /> : null}
        </View>
        <Text style={styles.body}>{item.body}</Text>
        {item.status ? (
          <Text style={styles.statusTag}>
            {ORDER_STATUS_LABELS[item.status] || item.status}
          </Text>
        ) : null}
        {hasLink ? (
          <Text style={styles.linkHint}>اضغط للانتقال إلى المتجر ←</Text>
        ) : null}
        <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
      </View>
    </Wrapper>
  );
}

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {
    notifications,
    unreadNotificationCount,
    notificationsLoading,
    refreshNotifications,
    markNotificationsRead,
  } = useApp();

  return (
    <GlassBackground>
      <AppHeader
        title="الإشعارات"
        showBack
        showCart={false}
        onBack={() => navigation.goBack()}
        rightSlot={
          unreadNotificationCount > 0 ? (
            <TouchableOpacity onPress={markNotificationsRead} style={styles.markReadBtn}>
              <Text style={styles.markReadText}>قراءة الكل</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: getBottomSafeInset(insets.bottom) + Spacing.lg },
          notifications.length === 0 && styles.listEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={notificationsLoading}
            onRefresh={refreshNotifications}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={40} color={Colors.textLight} />
            </View>
            <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
            <Text style={styles.emptySub}>ستصلك هنا تحديثات حالة طلباتك</Text>
          </View>
        }
        renderItem={({ item }) => (
          <NotificationItem
            item={item}
            isUnread={!item.read}
            onPress={
              isStoreNotification(item)
                ? () => {
                    openNotificationLink(item).catch(() => {});
                  }
                : undefined
            }
          />
        )}
      />
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: Layout.screenPadding,
    gap: Spacing.sm,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardUnread: {
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.surfaceMuted,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: {
    backgroundColor: Colors.primaryLight,
  },
  cardBody: { flex: 1 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textDark,
    textAlign: 'right',
  },
  titleUnread: { color: Colors.primaryDark },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  body: {
    fontSize: FontSize.sm,
    color: Colors.textGray,
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 20,
  },
  linkHint: {
    marginTop: 6,
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '700',
    textAlign: 'right',
  },
  statusTag: {
    alignSelf: 'flex-end',
    marginTop: 6,
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  time: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'right',
    marginTop: 6,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: Spacing.xs,
  },
  emptySub: {
    fontSize: FontSize.sm,
    color: Colors.textGray,
    textAlign: 'center',
  },
  markReadBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  markReadText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
  },
});
