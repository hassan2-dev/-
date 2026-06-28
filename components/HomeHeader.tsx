import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, Spacing, BorderRadius, Layout, Shadow } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import AppIcon, { HeaderIcons } from './AppIcon';

interface Props {
  displayName?: string;
}

export default function HomeHeader({ displayName }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { getCartCount, unreadNotificationCount } = useApp();
  const cartCount = getCartCount();

  return (
    <LinearGradient
      colors={[Colors.primary, Colors.primaryDark]}
      style={[styles.wrap, { paddingTop: insets.top + Spacing.sm }]}
    >
      <View style={styles.row}>
        <View style={styles.brandBlock}>
          <View style={styles.logoCircle}>
            <AppIcon name="leaf" size={22} color={Colors.white} />
          </View>
          <View>
            <Text style={styles.storeName}>تفاحة</Text>
            <Text style={styles.greeting} numberOfLines={1}>
              {displayName ? `مرحباً، ${displayName}` : 'مرحباً بك'}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <AppIcon name={HeaderIcons.bell} size={22} color={Colors.white} />
            {unreadNotificationCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.cartBtn]}
            onPress={() => navigation.navigate('Cart')}
          >
            <AppIcon name={HeaderIcons.cart} size={22} color={Colors.primaryDark} />
            {cartCount > 0 ? (
              <View style={[styles.badge, styles.cartBadge]}>
                <Text style={styles.badgeText}>{cartCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing.xl + 4,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeName: {
    color: Colors.white,
    fontSize: FontSize.xl,
    fontWeight: '800',
    textAlign: 'right',
  },
  greeting: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: FontSize.sm,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBtn: {
    backgroundColor: Colors.white,
    ...Shadow.sm,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.primaryDark,
  },
  cartBadge: {
    backgroundColor: Colors.danger,
    borderColor: Colors.white,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
});
